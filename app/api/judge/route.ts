// AI 분신 판단(기본 모드): 큰 갈림길 하나에서, 상황 칸마다 '이 사람이 각 보기를 고를 확률'과 보기별 이유를 받는다.
// 하나를 고르게 하지 않고 보기별 확률을 받는다(Meister 외 2024: 분포를 직접 말하게 해야 실제 분포에 가깝다).
// 실제 사람들의 기준 비율을 주고 "이 사람이라면 솔직히 몇 %일지"만 묻는다. 붙잡는 건 엔진이 맡는다(r, 상한 0.67~1.5배).
// 입력은 확인한 값만(이야기 원문·근거 인용 없음). 프롬프트를 고치면 JUDGE_PROMPT_VERSION(lib/judge.ts)을 올린다. 응답 검사·재요청은 lib/judge-ask.ts, 그래도 틀린 칸은 규칙 기울기로 채운다. 키가 없으면 규칙 기울기(목업).
import { NextResponse } from "next/server";
import norms from "@/data/norms.json";
import { allBuckets, baseShare, bucketLabel, stressOf } from "@/lib/base";
import { ruleJudge } from "@/lib/engine";
import type { JudgeEntry } from "@/lib/judge";
import { askJudge } from "@/lib/judge-ask";
import { generateJSON, hasLLM } from "@/lib/llm";
import { normalizeProfile } from "@/lib/profile";
import { LABEL, scrubStory } from "@/lib/story";
import type { BaseShare, Choice, LifeState, Profile } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const B5: Record<string, string> = { O: "개방성", C: "성실성", E: "외향성", A: "친화성", N: "신경성" };
const BH: Record<string, string> = { persistence: "끈기", risk: "위험 감수", coping: "스트레스 대처", social: "도움 청하기" };

const gradeText = (b: BaseShare) => (b.grade === "stat" ? "공개 통계" : b.grade === "interview" ? (b.ref ?? "현직자 인터뷰") : "가정값");

function personText(p: Profile) {
  const st = p.story ? scrubStory(p.story) : null;
  const lines = [
    `가치관(중요한 순서): ${p.values.join(" > ") || "안 고름"}`,
    `성격(1~5, 괄호는 비교 집단 평균): ${Object.entries(B5)
      .map(([k, n]) => `${n} ${p.bigFive[k as keyof typeof p.bigFive]}(${norms.bigFive.mean[k as keyof typeof norms.bigFive.mean]})`)
      .join(", ")}`,
    `상황 질문 성향(1~5, 괄호는 평균): ${Object.entries(BH)
      .map(([k, n]) => `${n} ${p.behavior[k as keyof typeof p.behavior]}(${norms.behavior.mean[k as keyof typeof norms.behavior.mean]})`)
      .join(", ")}`,
  ];
  if (p.wants?.hates?.length) lines.push(`싫은 것: ${p.wants.hates.join(", ")}`);
  lines.push(`모은 돈 ${p.life.savings}만원, 집 지원 월 ${p.life.support}만원, 생활비 월 ${p.life.livingCost}만원`);
  if (st?.decisionStyle) lines.push(`결정 방식(본인 확인): ${LABEL.decisionStyle[st.decisionStyle.value]}`);
  if (st?.familyExpectation) lines.push(`가족 기대(본인 확인): ${LABEL.familyExpectation[st.familyExpectation.value]}${st.familyExpectation.value !== "none" ? `, 신경 쓰는 정도 ${st.familyExpectation.strength}/5` : ""}`);
  if (st?.regretType) lines.push(`후회(본인 확인): ${LABEL.regretType[st.regretType.value]}`);
  if (st?.coreValues?.length) lines.push(`이야기에서 드러난 핵심 가치: ${st.coreValues.map((c) => c.value).join(", ")}`);
  if (st?.runwayMonths) lines.push(`집 지원 없이 버틸 수 있는 기간: ${st.runwayMonths.value}개월`);
  const corr = (p.corrections ?? []).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.to]: (acc[c.to] ?? 0) + 1 }), {});
  if (Object.keys(corr).length)
    lines.push(
      `시뮬레이션에서 직접 고친 선택: ${Object.entries(corr)
        .map(([t, n]) => `${t === "push" ? "밀어붙이는 쪽" : t === "change" ? "바꾸는 쪽" : "신중한 쪽"} ${n}번`)
        .join(", ")}`,
    );
  if (p.summary) lines.push(`요약: ${p.summary}`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { profile?: Profile; worldId?: string; forkId?: string } | null;
  if (!body?.profile || !body.worldId || !body.forkId) return NextResponse.json({ error: "입력이 없어요" }, { status: 400 });
  let world;
  try {
    world = getWorld(body.worldId);
  } catch {
    return NextResponse.json({ error: "없는 진로" }, { status: 400 });
  }
  const fork = world.events.find((e) => e.id === body.forkId && e.branch === "choice" && e.choices.length >= 2);
  if (!fork) return NextResponse.json({ error: "없는 갈림길" }, { status: 400 });
  const p = normalizeProfile({ ...body.profile, storyRaw: {} });
  const ids = fork.choices.map((_, i) => `c${i}`);
  const buckets = allBuckets(fork.stateKeys ?? ["stress"]);
  const baseOf = (b: string) => fork.choices.map((c) => baseShare(c.base, b) ?? 1 / fork.choices.length);
  const stateOf = (b: string): LifeState => ({ skill: 50, stress: stressOf(b), satisfaction: 50, relation: 50, money: 0 });
  const rule = (b: string) => ruleJudge(p, stateOf(b), fork.choices as Choice[], baseOf(b));

  const prompt = [
    `[이 사람]\n${personText(p)}`,
    `[진로] ${world.name}`,
    `[갈림길] ${fork.title}\n${fork.text}`,
    `[보기]\n${fork.choices.map((c, i) => `${ids[i]}: ${c.text}`).join("\n")}`,
    `[실제 사람들은 이렇게 골랐다(상황 칸별 기준 비율, 근거 등급)]\n${buckets
      .map((b) => `${b} (${bucketLabel(b)}): ${fork.choices.map((c, i) => `${ids[i]} ${Math.round((baseShare(c.base, b) ?? 0) * 100)}%`).join(", ")}`)
      .join("\n")}\n근거: ${fork.choices.map((c, i) => `${ids[i]} ${c.base ? gradeText(c.base) : "가정값"}`).join(", ")}`,
    `실제 사람들은 위처럼 골랐다. 이 사람이라면 솔직히 상황 칸마다 각 보기를 몇 % 고를까? 하나만 고르지 말고 모든 보기에 확률을 줘라(합 1).\n` +
      `JSON으로만 답해라: {"probs": {${buckets.map((b) => `"${b}": {${ids.map((id) => `"${id}": 확률`).join(", ")}}`).join(", ")}}, "reasons": {${ids.map((id) => `"${id}": "이 사람이 이걸 고른다면 그 이유"`).join(", ")}}, "shift": "보통 사람과 비교해 어느 쪽으로 기우는지 한 문장"}`,
  ].join("\n\n");
  const system =
    "너는 한 사람의 '분신'이다. 진로 갈림길에서 실제 사람들이 고른 비율을 보고, 이 사람이라면 솔직히 각 보기를 몇 % 고를지 말한다. " +
    "reasons는 보기마다 이 사람이 그걸 고른다면 그 이유만 쓴다. 보기 문장을 되풀이하지 말고 이 사람의 이야기·가치관·상황 중 하나를 근거로 쓴다. 안 고르는 이유나 망설임은 쓰지 마라. " +
    "좋은 예: '모은 돈이 적어서', '성장을 가장 중요하게 여겨서'. 나쁜 예: '일 년 더 도전해서'(보기 되풀이), '퇴사는 망설여져서'(안 고르는 이유). " +
    "'~해서', '~라서'로 끝나는 짧은 한국어(20자 안팎)로, 입력에 있는 사실만 근거로 쓴다. " +
    "shift는 보통 사람과 비교해 이 사람이 어느 쪽으로 기우는지 40자 안팎 한 문장으로, 네가 준 확률과 같은 방향으로 쓴다. 이유와 shift에 숫자·점수는 쓰지 마라.";

  const t0 = Date.now();
  let src: JudgeEntry["src"] = hasLLM() ? "ai" : "mock";
  let got: { probs: Record<string, number[]>; reasons: string[]; shift: string } = { probs: {}, reasons: ids.map(() => ""), shift: "" };
  if (hasLLM()) {
    got = await askJudge(() => generateJSON<unknown>({ tag: "judge", model: "fast", system, prompt, fallback: () => null }), ids, buckets);
    if (!Object.keys(got.probs).length) src = "fallback";
  }
  const out: Record<string, JudgeEntry> = {};
  for (const b of buckets) {
    const rb = rule(b);
    const ai = got.probs[b];
    out[b] = ai ? { probs: ai, reasons: ids.map((_, i) => got.reasons[i] || rb.reasons[i]), shift: got.shift || undefined, src: "ai" } : { ...rb, src: src === "ai" ? "fallback" : src };
  }
  return NextResponse.json({ entries: out, src, ms: Date.now() - t0 });
}

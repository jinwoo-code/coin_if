// AI 분신 판단(기본 모드): 큰 갈림길 하나에서, 상황 칸마다 '이 사람이 각 보기를 고를 확률'과 보기별 이유를 받는다.
// 하나를 고르게 하지 않고 보기별 확률을 받는다(Meister 외 2024: 분포를 직접 말하게 해야 실제 분포에 가깝다).
// 실제 사람들의 기준 비율을 예시로 주고 "이 사람이라면 얼마나 달라질지"를 묻는다. 엔진이 기준선과 상한(0.67~1.5배) 안에서만 반영한다.
// 입력은 확인한 값만(이야기 원문·근거 인용 없음). 프롬프트를 고치면 JUDGE_PROMPT_VERSION(lib/judge.ts)을 올린다. 응답이 틀리면 한 번 더 묻고, 그래도 틀린 칸은 규칙 기울기로 채운다. 키가 없으면 규칙 기울기(목업).
import { NextResponse } from "next/server";
import norms from "@/data/norms.json";
import { allBuckets, baseShare, bucketLabel, stressOf } from "@/lib/base";
import { ruleJudge } from "@/lib/engine";
import type { JudgeEntry } from "@/lib/judge";
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

// 그 보기를 안 고르는 이유·망설임이 섞인 표현
const NEGATIVE = /망설|안 ?하|싫|꺼려|꺼리|내키지/;

// 응답 검사: 상황 칸마다 모든 보기에 0 이상 숫자, 합이 0보다 크면 합 1로 정규화. 이유는 보기마다 50자 이내 문자열(아니면 규칙 이유), 부정 표현이 있으면 rejected로 세고 비운다.
function parse(raw: unknown, ids: string[], buckets: string[]) {
  const r = (raw ?? {}) as { probs?: Record<string, Record<string, unknown>>; reasons?: Record<string, unknown>; shift?: unknown };
  const probs: Record<string, number[]> = {};
  for (const b of buckets) {
    const row = r.probs?.[b];
    const xs = ids.map((id) => Number(row?.[id]));
    const sum = xs.reduce((a, c) => a + c, 0);
    if (xs.every((x) => Number.isFinite(x) && x >= 0) && sum > 0) probs[b] = xs.map((x) => x / sum);
  }
  let rejected = 0;
  const reasons = ids.map((id) => {
    const t = r.reasons?.[id];
    if (typeof t !== "string" || !t.trim() || t.trim().length > 50) return "";
    if (NEGATIVE.test(t)) {
      rejected++;
      return "";
    }
    return t.trim();
  });
  const shift = typeof r.shift === "string" && r.shift.trim().length <= 80 ? r.shift.trim() : "";
  return { probs, reasons, shift, rejected };
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
    `이 사람이라면 상황 칸마다 각 보기를 고를 확률이 기준에서 얼마나 달라질지 판단해라. 하나만 고르지 말고 모든 보기에 확률을 줘라(합 1).\n` +
      `JSON으로만 답해라: {"probs": {${buckets.map((b) => `"${b}": {${ids.map((id) => `"${id}": 확률`).join(", ")}}`).join(", ")}}, "reasons": {${ids.map((id) => `"${id}": "이 사람이 이걸 고른다면 그 이유"`).join(", ")}}, "shift": "보통 사람과 비교해 어느 쪽으로 기우는지 한 문장"}`,
  ].join("\n\n");
  const system =
    "너는 한 사람의 '분신'이다. 진로 갈림길에서 이 사람이 각 보기를 고를 확률을 추정한다. " +
    "실제 사람들의 기준 비율에서 출발하고, 이 사람의 성향·가치관·확인한 이야기 값이 평균과 다른 만큼만 움직인다. " +
    "사람은 생각보다 일관적이지 않다. 성격 하나로 극단적인 확률(90% 넘게, 5% 밑으로)을 주지 마라. 정보가 없거나 평균과 비슷하면 기준 비율 가까이 둔다. " +
    "reasons는 보기마다 이 사람이 그걸 고른다면 그 이유만 쓴다. 확률이 낮은 보기라도 고르게 되는 이유를 쓰고, 안 고르는 이유나 망설임(망설여서, 안 하고 싶어서, 싫어서)은 절대 쓰지 마라. " +
    "'~해서', '~라서'로 끝나는 짧은 한국어(20자 안팎)로, 입력에 있는 사실만 근거로 쓴다. " +
    "shift는 보통 사람과 비교해 이 사람이 어느 쪽으로 기우는지 40자 안팎 한 문장으로, 네가 준 확률과 같은 방향으로 쓴다. 이유와 shift에 숫자·점수는 쓰지 마라.";

  const t0 = Date.now();
  let src: JudgeEntry["src"] = hasLLM() ? "ai" : "mock";
  let got = { probs: {} as Record<string, number[]>, reasons: ids.map(() => ""), shift: "" };
  if (hasLLM()) {
    // 확률 형식이 틀리거나 이유에 부정 표현이 있으면 한 번 더 묻는다. 두 번째에도 부정 표현이면 그 이유는 비운다(규칙 이유로).
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await generateJSON<unknown>({ tag: "judge", model: "fast", system, prompt, fallback: () => null });
      if (raw === null) break; // 모든 모델 실패(한도 등)
      const next = parse(raw, ids, buckets);
      got = { probs: { ...got.probs, ...next.probs }, reasons: ids.map((_, i) => next.reasons[i] || got.reasons[i]), shift: next.shift || got.shift };
      if (buckets.every((b) => got.probs[b]) && !next.rejected) break; // 길이만 틀린 이유는 다시 묻지 않고 규칙 이유로 채운다
    }
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

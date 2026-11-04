// AI 분신 판단(기본 모드): 큰 갈림길 하나에서, 상황 칸마다 '이 사람이 각 보기를 고를 확률'과 보기별 이유를 받는다.
// 하나를 고르게 하지 않고 보기별 확률을 받는다(Meister 외 2024: 분포를 직접 말하게 해야 실제 분포에 가깝다).
// 실제 사람들의 기준 비율을 주고 "이 사람이라면 솔직히 몇 %일지"만 묻는다. 붙잡는 건 엔진이 맡는다(r, 상한 0.67~1.5배).
// 입력은 확인한 값만(이야기 원문·근거 인용 없음). 프롬프트를 고치면 JUDGE_PROMPT_VERSION(lib/judge.ts)을 올린다. 응답 검사·재요청은 lib/judge-ask.ts, 그래도 틀린 칸은 규칙 기울기로 채운다. 키가 없으면 규칙 기울기(목업).
import { NextResponse } from "next/server";
import { allBuckets, baseShare, bucketLabel, stressOf } from "@/lib/base";
import { ruleJudge, withFamilyPull } from "@/lib/engine";
import type { JudgeEntry } from "@/lib/judge";
import { askJudge } from "@/lib/judge-ask";
import { personText } from "@/lib/judge-person";
import { generateJSON, hasLLM } from "@/lib/llm";
import { normalizeProfile } from "@/lib/profile";
import type { BaseShare, Choice, LifeState, Profile, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const gradeText = (b: BaseShare) => (b.grade === "stat" ? "공개 통계" : b.grade === "interview" ? (b.ref ?? "현직자 인터뷰") : "가정값");

// 실시간 판단 모드: 상황 칸 대신 그때까지의 흐름을 준다. 큰 일 이름은 진로 데이터에서 찾는다(브라우저가 보낸 글을 프롬프트에 넣지 않는다).
interface LiveInput {
  month: number;
  status?: string;
  bucket: string;
  state: LifeState;
  recent?: { month: number; eventId: string; choice: number }[];
}
const num = (x: unknown) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0);
function flowText(world: WorldTemplate, live: LiveInput) {
  const s = live.state ?? ({} as LifeState);
  const recent = (live.recent ?? [])
    .slice(-5)
    .map((r) => {
      const e = world.events.find((x) => x.id === r.eventId);
      if (!e) return null;
      const c = e.choices[num(r.choice)];
      return `${num(r.month) + 1}개월째: ${e.title}${c && e.choices.length >= 2 ? ` → ${c.text}` : ""}`;
    })
    .filter(Boolean);
  return [
    `${num(live.month) + 1}개월째. 스트레스 ${num(s.stress)}/100, 만족도 ${num(s.satisfaction)}/100, 역량 ${num(s.skill)}/100, 지금 가진 돈 ${num(s.money)}만원.`,
    recent.length ? `최근 큰 일:\n${recent.join("\n")}` : "아직 큰 일은 없었다.",
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { profile?: Profile; worldId?: string; forkId?: string; live?: LiveInput } | null;
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
  const live = body.live;
  // 실시간 판단은 칸 하나("now"), 기준 비율은 그때 상황 칸의 값
  const buckets = live ? ["now"] : allBuckets(fork.stateKeys ?? ["stress"]);
  const shareBucket = (b: string) => (live ? String(live.bucket) : b);
  const baseOf = (b: string) => fork.choices.map((c) => baseShare(c.base, shareBucket(b)) ?? 1 / fork.choices.length);
  const stateOf = (b: string): LifeState =>
    live
      ? { skill: num(live.state?.skill), stress: num(live.state?.stress), satisfaction: num(live.state?.satisfaction), relation: num(live.state?.relation), money: num(live.state?.money) }
      : { skill: 50, stress: stressOf(b), satisfaction: 50, relation: 50, money: 0 };
  const rule = (b: string) => ruleJudge(withFamilyPull(p, world), stateOf(b), fork.choices as Choice[], baseOf(b));

  const prompt = [
    `[이 사람]\n${personText(p)}`,
    `[진로] ${world.name}`,
    ...(live ? [`[지금까지의 흐름]\n${flowText(world, live)}`] : []),
    `[갈림길] ${fork.title}\n${fork.text}`,
    `[보기]\n${fork.choices.map((c, i) => `${ids[i]}: ${c.text}`).join("\n")}`,
    `[실제 사람들은 이렇게 골랐다(${live ? "비슷한 상황의 기준 비율" : "상황 칸별 기준 비율"}, 근거 등급)]\n${buckets
      .map((b) => `${live ? "지금 상황" : `${b} (${bucketLabel(b)})`}: ${fork.choices.map((c, i) => `${ids[i]} ${Math.round((baseShare(c.base, shareBucket(b)) ?? 0) * 100)}%`).join(", ")}`)
      .join("\n")}\n근거: ${fork.choices.map((c, i) => `${ids[i]} ${c.base ? gradeText(c.base) : "가정값"}`).join(", ")}`,
    `실제 사람들은 위처럼 골랐다. 이 사람이라면 ${live ? "지금까지의 흐름을 겪은 지금" : "솔직히 상황 칸마다"} 각 보기를 몇 % 고를까? 하나만 고르지 말고 모든 보기에 확률을 줘라(합 1).\n` +
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
    got = await askJudge(() => generateJSON<unknown>({ tag: live ? "judge_live" : "judge", model: "fast", system, prompt, fallback: () => null, pace: true }), ids, buckets);
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

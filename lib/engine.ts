// 규칙 엔진. AI 없이 숫자만으로 한 사람의 한 진로를 '한 달씩' 처음부터 끝까지 굴린다.
// 같은 엔진으로 100번을 돌려 세계선 나무를 만들고(multiverse.ts), 그중 한 줄을 AI가 이야기로 풀어 준다(sim.ts).
// 브라우저에서도 쓸 수 있도록 서버 전용 코드를 import하지 않는다.
import { ymAt } from "./calendar";
import { factorMult, startSkill } from "./factors";
import { eulReul } from "./josa";
import { blendPersistence, blendValueFit, storyReason } from "./story";
import { W, WA } from "./weights";
import type { Choice, EventCard, LifeState, MonthLog, Path, Profile, ValueKey, WorldTemplate } from "./types";

// ---------- 작은 도구들 ----------

// 같은 시드면 같은 결과가 나오는 난수
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const SCORE_KEYS = ["skill", "stress", "satisfaction", "relation"] as const;

export function applyDelta(state: LifeState, delta: Partial<LifeState>): LifeState {
  const next = { ...state };
  for (const k of SCORE_KEYS) next[k] = clamp(Math.round(next[k] + (delta[k] ?? 0)), 0, 100);
  next.money = Math.round(next.money + (delta.money ?? 0));
  return next;
}

function addDelta(a: Partial<LifeState>, b: Partial<LifeState> | undefined): Partial<LifeState> {
  const out: Partial<LifeState> = { ...a };
  if (!b) return out;
  (Object.keys(b) as (keyof LifeState)[]).forEach((k) => {
    out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  });
  return out;
}

// 시간이 지나면 스트레스와 만족도는 '지금 처지의 평소 수준'으로 조금씩 돌아온다.
// 일하는 중: 만족도 60(공무원 직무만족 5점 중 3.43 ≈ 60점, 한국행정연구원 2025), 스트레스는 근무시간이 길수록 높게.
// 준비 중: 오래 준비할수록 만족도 평소 수준이 내려간다(가정).
function drift(state: LifeState, target: { sat: number; stress: number }): LifeState {
  return {
    ...state,
    stress: Math.round(state.stress + (target.stress - state.stress) * 0.08),
    satisfaction: Math.round(state.satisfaction + (target.sat - state.satisfaction) * 0.06),
  };
}

// 2026년 최저시급 10,320원(최저임금위원회). 알바 수입 계산에 쓴다(만원/시간).
const MIN_WAGE = 1.032;
// 세금·4대보험을 떼고 받는 비율(대략값, 가정)
const NET_RATE = 0.85;
// 육군 복무 18개월(병무청)
const SERVICE_MONTHS = 18;

// ---------- 엔진이 직접 만드는 공통 사건(모든 진로에 같음) ----------

const ENLIST: EventCard = {
  id: "enlist",
  title: "입대했다",
  kind: "neutral",
  weight: 0,
  text: "머리를 짧게 자르고 훈련소에 들어갔다. 준비하던 일은 잠시 멈췄다.",
  choices: [
    { text: "복무 중에 틈틈이 공부를 이어 간다", tone: "push", effect: { skill: 3 } },
    { text: "일단 복무에만 집중한다", tone: "safe" },
  ],
  effect: { stress: 10, relation: -6 },
  evidence: { label: "육군 복무 기간 18개월", source: "병무청" },
};

const DISCHARGE: EventCard = {
  id: "discharge",
  title: "전역했다",
  kind: "good",
  weight: 0,
  text: "1년 반 만에 다시 민간인이 됐다. 그동안 바뀐 게 많았다.",
  choices: [
    { text: "바로 하던 준비를 다시 시작한다", tone: "push", effect: { skill: 2, stress: 3 } },
    { text: "한두 달 쉬면서 방향을 다시 본다", tone: "safe", effect: { stress: -6 } },
  ],
  effect: { satisfaction: 8, stress: -8 },
};

const BROKE: EventCard = {
  id: "broke",
  title: "모아 둔 돈이 바닥났다",
  kind: "bad",
  weight: 0,
  branch: "choice",
  branchLabel: "생활비가 떨어짐",
  text: "통장 잔고가 0원이 됐다. 다음 달 월세와 생활비를 어떻게 할지 정해야 했다.",
  choices: [
    { text: "알바를 늘려 생활비를 직접 번다", tone: "push", sets: "more-work", label: "알바를 늘림", effect: { stress: 8 } },
    { text: "집에 도움을 요청한다", tone: "safe", sets: "family-help", label: "집에 도움 요청", effect: { stress: 5, relation: -4, money: 150 } },
  ],
  effect: { stress: 10, satisfaction: -6 },
};

export function valueFit(world: WorldTemplate, p: Profile) {
  return blendValueFit(
    p.values.reduce((s, v, i) => s + (WA("value.fitRank")[i] ?? 0) * (world.fitValues[v] ?? 0.5), 0),
    world.fitValues,
    p.story,
  );
}

// ---------- ① '나'의 선택: 성향으로 정한다 ----------

type Tone = Choice["tone"];
interface Push {
  tone: Tone;
  value: number;
  reason: string;
}

function rankOf(p: Profile, v: ValueKey) {
  const i = p.values.indexOf(v);
  return i < 0 ? -1 : i;
}

// 가치관 순위가 높을수록 크게(value.rank: 1순위 1, 2순위 0.6, 3순위 0.35, 4순위 0.15, 없으면 0)
function vw(p: Profile, v: ValueKey) {
  return WA("value.rank")[rankOf(p, v)] ?? 0;
}

// 가치관이 미는 쪽(data/weights.json value.*)
const VALUE_PUSH: [ValueKey, Tone][] = [
  ["성장", "push"],
  ["인정", "push"],
  ["돈", "change"],
  ["자율", "change"],
  ["안정", "safe"],
  ["여유", "safe"],
  ["관계", "safe"],
  ["기여", "push"],
];

function pushes(p: Profile, state: LifeState): Push[] {
  const b = p.bigFive;
  const h = p.behavior;
  const r = (v: ValueKey) => `${eulReul(v)} ${rankOf(p, v) + 1}순위로 꼽아서`;
  const out: Push[] = [];
  for (const [v, tone] of VALUE_PUSH) if (vw(p, v)) out.push({ tone, value: W(`value.${v}.${tone}`) * vw(p, v), reason: r(v) });
  out.push({ tone: "push", value: W("trait.C.push") * (b.C - 3), reason: b.C >= 3 ? "일을 끝까지 해내는 편이라서" : "" });
  const grit = blendPersistence(h.persistence, p.story);
  out.push({ tone: "push", value: W("trait.persistence.push") * (grit - 3), reason: grit >= 3 ? "잘 안 풀려도 버티는 편이라서" : "" });
  out.push({ tone: "change", value: W("trait.risk.change") * (h.risk - 3), reason: h.risk >= 3 ? "불확실해도 일단 움직이는 편이라서" : "" });
  out.push({ tone: "change", value: W("trait.O.change") * (b.O - 3), reason: b.O >= 3 ? "새로운 걸 좋아하는 편이라서" : "" });
  out.push({ tone: "safe", value: W("trait.N.safe") * (b.N - 3), reason: b.N >= 3 ? "쉽게 긴장하는 편이라서" : "" });
  out.push({ tone: "safe", value: W("trait.lowRisk.safe") * (3 - h.risk), reason: h.risk < 3 ? "확실하지 않으면 움직이지 않는 편이라서" : "" });
  // 이야기에서 사용자가 '맞아요'로 확인한 값(lib/story.ts). 무게는 가정값이고, 이유에 그 사람이 쓴 문장을 그대로 인용한다.
  const st = p.story;
  if (st?.decisionStyle) out.push({ tone: st.decisionStyle.value === "impulsive" ? "change" : "safe", value: W("story.decisionStyle"), reason: storyReason(st.decisionStyle.evidence) });
  if (st?.familyExpectation?.value === "stable") out.push({ tone: "safe", value: W("story.familyStable") * st.familyExpectation.strength, reason: storyReason(st.familyExpectation.evidence) });
  if (st?.regretType?.value === "inaction") {
    out.push({ tone: "push", value: W("story.regretInaction.push"), reason: storyReason(st.regretType.evidence) });
    out.push({ tone: "change", value: W("story.regretInaction.change"), reason: storyReason(st.regretType.evidence) });
  }
  if (st?.regretType?.value === "action") out.push({ tone: "safe", value: W("story.regretAction.safe"), reason: storyReason(st.regretType.evidence) });
  // 계속 닮아 가기: 내가 직접 고친 선택·체크인에서 말한 실제 선택. 한 번에 correction.step, tone마다 최대 correction.cap(가정값)
  for (const t of ["push", "change", "safe"] as const) {
    const n = (p.corrections ?? []).filter((c) => c.to === t).length;
    if (n) out.push({ tone: t, value: Math.min(W("correction.cap"), W("correction.step") * n), reason: "내가 직접 고친 선택을 반영해서" });
  }
  // 지쳐 있으면 쉬거나 바꾸고 싶어진다.
  const tired = (state.stress - 50) / 100;
  if (tired > 0) {
    out.push({ tone: "safe", value: tired * (W("state.tired.safe") - W("state.tired.copingRelief") * (h.coping - 3)), reason: "스트레스가 많이 쌓여 있어서" });
    out.push({ tone: "change", value: tired * W("state.tired.change"), reason: "지금 상황에 지쳐서" });
  } else {
    out.push({ tone: "push", value: -tired * W("state.rested.push"), reason: "아직 여유가 있어서" });
  }
  return out.filter((x) => x.value > 0 && x.reason);
}

// 보기(tone)마다 고를 무게. decide와 분신 채점(lib/twin.ts)이 같은 식을 쓴다.
const scoreOf = (ps: Push[], t: Tone) => ps.filter((x) => x.tone === t).reduce((s, x) => s + x.value, 0);
function weightsOf(ps: Push[], tones: Tone[]) {
  const temp = W("decide.temperature");
  return tones.map((t) => Math.exp(temp * scoreOf(ps, t)));
}

// 온도를 곱하기 전 tone 점수(가중치 보정 scripts/fit-weights.ts용)
export function toneScores(p: Profile, state: LifeState, tones: Tone[]) {
  const ps = pushes(p, state);
  return tones.map((t) => scoreOf(ps, t));
}

// 이 상태에서 '나'가 각 보기를 고를 확률(합 1)
export function toneProbs(p: Profile, state: LifeState, tones: Tone[]) {
  const w = weightsOf(pushes(p, state), tones);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

export function decide(p: Profile, state: LifeState, choices: Choice[], rand: () => number) {
  const ps = pushes(p, state);
  const tones = choices.map((c) => c.tone);
  const weights = weightsOf(ps, tones);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  let index = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      index = i;
      break;
    }
  }
  const mine = ps.filter((x) => x.tone === tones[index]);
  let reason = tones[index] === "safe" ? "무리하지 않으려고" : tones[index] === "change" ? "다른 길도 봐야 할 것 같아서" : "해 볼 만하다고 생각해서";
  if (mine.length) {
    const sum = mine.reduce((s, x) => s + x.value, 0);
    let r = rand() * sum;
    for (const x of mine) {
      r -= x.value;
      if (r <= 0) {
        reason = x.reason;
        break;
      }
    }
  }
  return { index, reason, chance: Math.round((weights[index] / total) * 100) };
}

// 선택의 성격에 따른 추가 변화
const TONE_EFFECT: Record<Tone, Partial<LifeState>> = {
  push: { skill: 2, stress: 3 },
  change: { stress: 1, satisfaction: 1 },
  safe: { skill: -1, stress: -3 },
};

// ---------- ② 한 진로를 한 달씩 ----------

export interface Force {
  eventId: string;
  choiceIndex?: number; // 내 선택을 바꿈
  outcome?: "happen" | "skip"; // 운을 바꿈(관문을 반드시 통과/통과 못 함)
}

interface Sim {
  state: LifeState;
  used: Set<string>; // 일어난 사건 + 켜진 상태
  employedSince: number | null;
  salary: number;
  tier: string;
  tierId: string;
  idle: number;
  gradIn: number; // 일 없이 준비한 개월 수
}

const BIG_PER_MONTH = 0.22;
const ROUTINE_PER_MONTH = 0.18;

function has(sim: Sim, ids?: string[]) {
  return !ids || ids.every((id) => sim.used.has(id));
}
function none(sim: Sim, ids?: string[]) {
  return !ids || ids.every((id) => !sim.used.has(id));
}

function eligible(e: EventCard, sim: Sim, month: number, calMonth: number) {
  const employed = sim.employedSince !== null;
  return (
    (e.minMonth ?? 0) <= month &&
    (!e.afterGrad || month >= sim.gradIn - (e.gradGrace ?? 0)) &&
    (e.maxMonth ?? Infinity) >= month &&
    (!e.calendar || e.calendar.includes(calMonth)) &&
    has(sim, e.requires) &&
    none(sim, e.excludes) &&
    (!e.needsJob || employed) &&
    (!e.needsNoJob || !employed) &&
    (!e.minTenure || (employed && month - (sim.employedSince ?? month) >= e.minTenure)) &&
    (e.maxTenure === undefined || (employed && month - (sim.employedSince ?? month) <= e.maxTenure)) &&
    (!e.onlyTier || (employed && e.onlyTier.includes(sim.tierId)))
  );
}

function weightedPick<T>(items: T[], weightOf: (x: T) => number, rand: () => number): T {
  const ws = items.map((x) => Math.max(0.05, weightOf(x)));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function gateChance(e: EventCard, p: Profile, sim: Sim, world: WorldTemplate, month: number) {
  if ((e.chance ?? 0) >= 1) return 1; // 반드시 일어나는 일(시작, 불합격 통보 등)
  let pr = (e.chance ?? 0) * factorMult(p, world, e.factors);
  if (e.warmup) pr *= Math.min(1, (month + 1) / e.warmup);
  // 준비가 쌓일수록(역량) 조금씩 유리해진다.
  pr *= clamp(0.55 + sim.state.skill / 90, 0.55, 1.5);
  // 생활비 때문에 알바를 늘렸으면 준비 시간이 줄어든다.
  if (sim.used.has("more-work") && sim.employedSince === null) pr *= 0.75;
  // 입대를 앞둔 미필자는 회사 채용에서 불리하다(가정: 절반).
  if (e.hires && world.archetype !== "exam" && p.life.military === "미필" && p.life.enlistIn !== null && month < p.life.enlistIn) pr *= W("factor.military.preEnlistHire");
  void world;
  return clamp(pr, 0, 0.95);
}

function pickEvent(world: WorldTemplate, p: Profile, sim: Sim, month: number, calMonth: number, rand: () => number, force?: Force) {
  const open = world.events.filter((e) => eligible(e, sim, month, calMonth));

  // 1) 관문: 확률이 낮은 것부터(합격 → 안 되면 불합격)
  const gates = open.filter((e) => e.chance !== undefined && (e.repeatable || !sim.used.has(e.id))).toSorted((a, b) => (a.chance ?? 0) - (b.chance ?? 0));
  for (const g of gates) {
    if (force?.eventId === g.id && force.outcome === "happen") return g;
    const hit = rand() < gateChance(g, p, sim, world, month);
    // 운을 바꿈: 처음으로 붙었어야 할 그 순간 한 번만 떨어뜨린다(이후는 원래 확률대로).
    if (hit && force?.eventId === g.id && force.outcome === "skip" && !sim.used.has("skipped")) {
      sim.used.add("skipped");
      continue;
    }
    if (hit) return g;
  }

  // 2) 큰 사건 / 3) 일상 / 4) 조용한 달
  const big = open.filter((e) => e.chance === undefined && !e.repeatable && !sim.used.has(e.id));
  const routine = open.filter((e) => e.chance === undefined && e.repeatable);
  const roll = rand();
  const weight = (e: EventCard) => {
    let w = e.weight;
    if (sim.used.has(e.id)) w *= 0.4;
    if (e.kind === "bad") w *= 1 + (sim.state.stress - 50) / 100;
    if (e.kind === "good") w *= 1 + (sim.state.satisfaction - 50) / 200;
    return w;
  };
  if (big.length && roll < BIG_PER_MONTH) return weightedPick(big, weight, rand);
  if (routine.length && roll < BIG_PER_MONTH + ROUTINE_PER_MONTH) return weightedPick(routine, weight, rand);
  return null;
}

function hateHit(p: Profile, e: EventCard) {
  return (e.tags ?? []).filter((t) => p.wants.hates.includes(t)).length;
}

function statusOf(world: WorldTemplate, sim: Sim, month: number, inService: boolean) {
  if (inService) return "군 복무 중";
  if (sim.employedSince !== null) return `${sim.tier} ${month - sim.employedSince + 1}개월차`;
  if (sim.used.has("switched")) return "다른 길 준비 중";
  if (sim.used.has("quit")) return "그만두고 다시 찾는 중";
  const student = month < sim.gradIn;
  switch (world.archetype) {
    case "exam":
      return student ? "학교 다니며 시험 준비" : "수험생";
    case "license":
      return student ? "졸업 앞두고 국가시험 준비" : sim.used.has("licensed") ? "면허 따고 구직 중" : "국가시험 준비 중";
    case "grad":
      return sim.used.has("admitted") ? "입학 기다리는 중" : "대학원 입시 준비 중";
    case "startup":
      return "창업 준비 중";
    case "portfolio":
      return student ? "학교 다니며 포트폴리오 준비" : sim.used.has("freelance") ? "프리랜서로 일감 찾는 중" : "포트폴리오 들고 구직 중";
    default:
      return student ? "학교 다니며 취업 준비" : sim.used.has("discharge") ? "전역 후 취업 준비 중" : "취업 준비 중";
  }
}

// 인생 방향을 바꾸는 선택만 세계선 나무의 갈림길로 쓴다(작은 선택까지 넣으면 세계선이 잘게 쪼개진다).
const MAJOR_SETS = new Set(["switched", "moved", "bootcamp", "lowered", "private", "mkt-intern"]);
export function isMajor(c: Choice | undefined) {
  return Boolean(c && (c.quits || (c.sets && MAJOR_SETS.has(c.sets))));
}

export function signatureKey(e: EventCard, choiceIndex: number, tierId?: string) {
  if (e.branch === "choice") return `${e.id}:${choiceIndex}`;
  return tierId ? `${e.id}@${tierId}` : e.id;
}

export function simulatePath(p: Profile, world: WorldTemplate, months: number, startYm: string, seed: string, force?: Force): Path {
  const rand = seededRandom(seed);
  const sim: Sim = {
    state: { skill: startSkill(p, world), stress: 40, satisfaction: 50, relation: 50, money: p.life.savings },
    used: new Set(),
    employedSince: null,
    salary: 0,
    tier: "",
    tierId: "",
    idle: 0,
    gradIn: p.spec.gradIn,
  };
  const enlist = p.life.military === "미필" && p.life.enlistIn !== null ? p.life.enlistIn : null;
  const runway = p.story?.runwayMonths?.value ?? null;
  // 일하는 중의 평소 만족도: 이 일이 내 가치관을 얼마나 채우는지에 따라 45~75
  const jobSat = Math.round(48 + W("value.jobSat") * valueFit(world, p));
  const log: MonthLog[] = [];
  const signature: string[] = [];
  const sigMonths: number[] = [];
  const choiceKeys: string[] = [];
  let employedAt: number | null = null;

  for (let month = 0; month < months; month++) {
    const cal = ymAt(startYm, month).month;
    const inService = enlist !== null && month >= enlist && month < enlist + SERVICE_MONTHS;

    // 사건 고르기
    let event: EventCard | null = null;
    if (enlist !== null && month === enlist) {
      event = ENLIST;
      // 회사원은 보통 입대 전에 퇴사한다(공무원은 군 휴직으로 자리가 유지됨).
      if (sim.employedSince !== null && world.archetype !== "exam") {
        sim.employedSince = null;
        sim.salary = 0;
        sim.used.add("quit");
      }
    } else if (enlist !== null && month === enlist + SERVICE_MONTHS) event = DISCHARGE;
    // 생활비 바닥: 모은 돈이 바닥나거나, 이야기에서 말한 '집 지원 없이 버틸 수 있는 기간'이 졸업 뒤 지났을 때(더 이른 쪽)
    else if (!inService && sim.employedSince === null && !sim.used.has("broke") && (sim.state.money < 0 || (runway !== null && month >= sim.gradIn + runway))) event = BROKE;
    else if (!inService) event = pickEvent(world, p, sim, month, cal, rand, force);

    let delta: Partial<LifeState> = {};
    let choiceIndex = 0;
    let reason = "";
    let tierLabel: string | undefined;

    if (event) {
      sim.used.add(event.id);
      const d = decide(p, sim.state, event.choices, rand);
      choiceIndex = force?.eventId === event.id && force.choiceIndex !== undefined ? Math.min(force.choiceIndex, event.choices.length - 1) : d.index;
      reason = force?.eventId === event.id && force.choiceIndex !== undefined ? "다른 세계에서는 이렇게 골랐어요" : d.reason;
      const choice = event.choices[choiceIndex];
      delta = addDelta(addDelta(event.effect, choice?.effect), choice ? TONE_EFFECT[choice.tone] : undefined);
      // 싫다고 한 일에 걸리면 만족도가 더 깎인다.
      const hits = hateHit(p, event);
      if (hits) delta = addDelta(delta, { satisfaction: -4 * hits, stress: 3 * hits });

      // 일 시작
      let tierId: string | undefined;
      if (event.hires) {
        const ready = factorMult(p, world, event.factors);
        const tiers = event.tiers ?? [{ id: "job", group: "job", label: "회사", salary: 3000, weight: 1 }];
        const t = weightedPick(tiers, (x) => x.weight * (x === tiers[0] ? ready ** 1.5 : 1), rand);
        tierId = t.group;
        tierLabel = t.label;
        sim.tierId = t.id;
        sim.employedSince = month;
        sim.salary = t.salary;
        sim.tier = t.label;
        employedAt ??= month;
        sim.used.delete("quit");
      }
      if (choice?.sets) sim.used.add(choice.sets);
      if (choice?.raise) {
        sim.salary = Math.round(sim.salary * (1 + choice.raise / 100));
        if (choice.sets === "moved") sim.employedSince = month;
      }
      if (choice?.quits) {
        sim.employedSince = null;
        sim.salary = 0;
        sim.used.add("quit");
      }
      if (event.branch === "choice") choiceKeys.push(signatureKey(event, choiceIndex));
      if (event.branch === "luck" || (event.branch === "choice" && isMajor(choice))) {
        signature.push(signatureKey(event, choiceIndex, tierId));
        sigMonths.push(month);
      }
    }

    // 이번 달 돈의 흐름
    let flow: number;
    if (inService)
      flow = 60; // 병 봉급에서 쓰고 남는 돈(가정)
    else if (sim.employedSince !== null) flow = (sim.salary / 12) * NET_RATE - p.life.livingCost;
    else {
      const work = p.life.partTimeHours + (sim.used.has("more-work") ? 20 : 0);
      flow = p.life.support + work * 4.345 * MIN_WAGE - p.life.livingCost - (sim.used.has("quit") ? 0 : world.prepCost);
    }
    delta = addDelta(delta, { money: Math.round(flow) });
    if (sim.employedSince !== null && world.hoursPerWeek > 45) delta = addDelta(delta, { stress: 1 });

    const target = inService
      ? { sat: 45, stress: 50 }
      : sim.used.has("switched") && sim.employedSince === null
        ? { sat: 50, stress: 45 } // 다른 노선으로 갈아탐: 이 진로의 시계는 멈춘다
        : sim.employedSince !== null
          ? { sat: jobSat, stress: 38 + Math.max(0, world.hoursPerWeek - 40) * 1.5 }
          : { sat: Math.max(35, 52 - sim.idle * 0.6), stress: 48 };
    if (!inService && sim.employedSince === null && !sim.used.has("switched")) sim.idle += 1;
    sim.state = applyDelta(drift(sim.state, target), delta);
    log.push({ month, event, choiceIndex, reason, tierLabel, delta, state: sim.state, status: statusOf(world, sim, month, inService), salary: sim.salary });
  }

  return { seed, months: log, signature, sigMonths, choiceKeys, final: sim.state, employedAt, salary: sim.salary };
}

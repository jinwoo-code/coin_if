// 갈림길 기준 비율(docs/선택-설계-근거.md '핵심 원칙: 통계가 기준선, 분신은 기울기').
// 같은 상황에서 실제 사람들이 각 보기를 고른 비율. 값은 data/base-shares.json 한 곳에 두고(scripts/measure-base.ts가 만듦),
// 진로를 만들 때 보기(Choice.base)와 갈림길(EventCard.stateKeys)에 붙인다.
// 브라우저에서도 쓰므로 서버 전용 코드를 import하지 않는다.
import shares from "@/data/base-shares.json";
import type { BasePopulation, BaseShare, EventCard, Profile, LifeState, StateKey, WorldTemplate } from "./types";

// 갈림길에서의 상황(엔진이 decide 직전에 넘김)
export interface ForkCtx {
  state: LifeState;
  idle: number; // 일하지 않고 준비한 개월 수
  tenure: number; // 지금 직장에서 다닌 개월 수(일 안 하면 0)
}

// 상황 키마다 두 칸(스트레스만 세 칸). 경계는 가정값.
const BANDS: Record<StateKey, (c: ForkCtx) => string> = {
  stress: (c) => (c.state.stress < 45 ? "low" : c.state.stress < 65 ? "mid" : "high"),
  money: (c) => (c.state.money < 100 ? "low" : "ok"), // 모은 돈 100만원 미만 = 바닥
  prep: (c) => (c.idle < 12 ? "short" : "long"), // 준비 12개월 미만/이상
  tenure: (c) => (c.tenure < 12 ? "new" : "settled"), // 지금 직장 1년 미만/이상
};

export const BAND_LABEL: Record<string, string> = {
  "stress:low": "여유 있음",
  "stress:mid": "보통",
  "stress:high": "지침",
  "money:low": "저축 바닥",
  "money:ok": "저축 있음",
  "prep:short": "준비 1년 미만",
  "prep:long": "준비 1년 이상",
  "tenure:new": "입사 1년 미만",
  "tenure:settled": "입사 1년 이상",
};

// 상황 칸 이름. 예: "stress:mid|money:ok"
export function bucketOf(keys: StateKey[] | undefined, c: ForkCtx) {
  return (keys ?? []).map((k) => `${k}:${BANDS[k](c)}`).join("|");
}

// 상황 키들로 나올 수 있는 모든 칸(예: stress 3칸 × money 2칸 = 6칸)
export function allBuckets(keys: StateKey[]) {
  const bands: Record<StateKey, string[]> = { stress: ["low", "mid", "high"], money: ["low", "ok"], prep: ["short", "long"], tenure: ["new", "settled"] };
  return keys.reduce<string[]>((out, k) => out.flatMap((pre) => bands[k].map((b) => (pre ? `${pre}|` : "") + `${k}:${b}`)), [""]);
}
// 칸의 스트레스 가운데 값(엔진 선택은 상태 중 스트레스만 본다)
export const STRESS_MID: Record<string, number> = { low: 35, mid: 55, high: 75 };
export const stressOf = (bucket: string) => STRESS_MID[/stress:(\w+)/.exec(bucket)?.[1] ?? "mid"] ?? 55;
export const bucketLabel = (bucket: string) =>
  bucket
    .split("|")
    .filter(Boolean)
    .map((b) => BAND_LABEL[b] ?? b)
    .join(", ");

// 이 상황 칸에서의 기준 비율(칸 값이 없으면 전체 비율)
export function baseShare(b: BaseShare | undefined, bucket: string) {
  return b ? (b.byState?.[bucket] ?? b.share) : undefined;
}

// 갈림길마다 상황 키 1~2개. 지금 엔진의 선택은 스트레스에 따라 크게 달라져서 모두 stress를 넣고,
// 내 선택으로 갈리는 큰 갈림길(branch "choice")에는 그 갈림길에서 가장 중요한 상황을 하나 더 넣는다.
export function defaultStateKeys(e: EventCard): StateKey[] {
  if (e.choices.length < 2) return [];
  if (e.branch !== "choice") return ["stress"];
  if (/keep-going|long-prep|phd-or-job/.test(e.id)) return ["stress", "prep"];
  if (/offer|burnout|quit-thought|own-shop/.test(e.id)) return ["stress", "tenure"];
  return ["stress", "money"]; // 긴 구직, 부트캠프, 프리랜서, 피벗, 인턴, 생활비 바닥
}

// data/base-shares.json 모양: { [묶음]: { [갈림길 id]: { stateKeys, choices: BaseShare[] } } }
// 묶음 = 상세판은 진로 id, 유형 틀로 만든 진로는 유형(archetype), 엔진 공통 사건은 "_global"
export interface ForkBase {
  stateKeys: StateKey[];
  choices: BaseShare[];
}
export const BASE = shares as unknown as Record<string, Record<string, ForkBase>>;

export const groupOf = (w: Pick<WorldTemplate, "id" | "archetype" | "curated">) => (w.curated ? w.id : w.archetype);

export function attachBase(e: EventCard, group: string): EventCard {
  if (e.choices.length < 2) return e;
  const fb = BASE[group]?.[e.id];
  if (!fb || fb.choices.length !== e.choices.length) return { ...e, stateKeys: e.stateKeys ?? defaultStateKeys(e) };
  return { ...e, stateKeys: fb.stateKeys, choices: e.choices.map((c, i) => ({ ...c, base: fb.choices[i] })) };
}

export function withBase(w: WorldTemplate): WorldTemplate {
  const g = groupOf(w);
  return { ...w, events: w.events.map((e) => attachBase(e, g)) };
}

// 통계의 대상 집단과 이 사람이 다른지. 다르거나 확인할 수 없으면 그 까닭, 같으면 null.
export function populationGap(p: Profile, pop: BasePopulation): string | null {
  if (pop.noWork && p.spec.workMonths + p.spec.internMonths > 0) return "나는 일 경험이 있어요.";
  if (pop.unchecked?.length) return `앱이 ${pop.unchecked.join("·")}를 묻지 않아 같은 집단인지 확인하지 못했어요.`;
  return null;
}

// 이 진로의 기준선 보기 중 등급별 비율(%)
export function baseSummary(w: WorldTemplate) {
  const all = w.events.flatMap((e) => (e.choices.length >= 2 ? e.choices.map((c) => c.base?.grade ?? "assumed") : []));
  const pct = (g: string) => (all.length ? (all.filter((x) => x === g).length / all.length) * 100 : 0);
  const text = (x: number) => (x > 0 && x < 1 ? "1% 미만" : `${Math.round(x)}%`);
  return { total: all.length, stat: text(pct("stat")), interview: text(pct("interview")), calibrated: text(pct("calibrated")), assumed: text(pct("assumed")) };
}

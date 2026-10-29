// 진로 세계 목록과 '얼마나 맞는지' 계산.
// 새 진로를 추가하려면 data/worlds/에 JSON을 하나 만들고 아래 WORLDS 배열에 넣으면 된다.
import developer from "@/data/worlds/developer.json";
import civilServant from "@/data/worlds/civil-servant.json";
import dataAnalyst from "@/data/worlds/data-analyst.json";
import marketer from "@/data/worlds/marketer.json";
import extraFacts from "@/data/jobdata/extra-facts.json";
import { JOBS } from "@/data/jobs";
import { buildWorld } from "./archetypes";
import type { BigFive, Fact, Interests, Profile, WorldStats, WorldTemplate } from "./types";

// scripts/sync-jobdata.ts가 고용24에서 받아 온 사실을 진로별 근거에 더한다.
const extra = extraFacts as Record<string, Fact[]>;
// 사람이 사건을 하나하나 쓴 진로 4개 + 직업 목록에서 유형 틀로 만든 진로들
const CURATED = [developer, civilServant, dataAnalyst, marketer] as unknown as WorldTemplate[];
const GENERATED = JOBS.map((j, i) => buildWorld(j, i + 4));
export const WORLDS: WorldTemplate[] = [...CURATED, ...GENERATED].map((w) => ({ ...w, facts: [...w.facts, ...(extra[w.id] ?? [])] }));

export const FAMILIES = Array.from(new Set(WORLDS.map((w) => w.family)));

// 전공 이름과 진로의 관련 전공 키워드가 겹치는지(0~1)
export function majorMatch(world: WorldTemplate, major: string): number {
  const m = major.replace(/\s/g, "");
  if (!m) return 0;
  const hits = world.majors.filter((k) => m.includes(k));
  return hits.length ? Math.min(1, 0.7 + 0.15 * hits.length) : 0;
}

// 내 전공과 가치관으로 추천 순서를 정한다.
export function recommend(profile: Profile, limit = 6, extraMajors: string[] = []): WorldTemplate[] {
  const majorText = [profile.major, ...extraMajors].join(" ");
  // 전공이 직접 맞는 진로와 같은 계열의 진로도 조금 올려 준다.
  const families = new Set(WORLDS.filter((w) => majorMatch(w, majorText) > 0).map((w) => w.family));
  return WORLDS.map((w) => ({ w, score: 0.55 * majorMatch(w, majorText) + (families.has(w.family) ? 0.2 : 0) + 0.45 * preFit(w, profile) }))
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.w);
}

export function getWorld(id: string): WorldTemplate {
  const world = WORLDS.find((w) => w.id === id);
  if (!world) throw new Error(`없는 진로 세계: ${id}`);
  return world;
}

// 리포트의 '이번 주 할 일' 기본값(목업 모드와 AI 실패 시 사용)
export function todoFor(w: WorldTemplate): string {
  return DEFAULT_TODOS[w.id] ?? `현직 ${w.short} 1명에게 하루 일과를 물어보기`;
}

export const DEFAULT_TODOS: Record<string, string> = {
  developer: "현직 개발자 커피챗 1회 신청하기",
  "civil-servant": "9급 행정직 기출문제 1회분 시간 재고 풀어 보기",
  "data-analyst": "ADsP 시험 일정 확인하고 접수하기",
  marketer: "관심 브랜드의 SNS 캠페인 3개 분석해 보기",
};

// 1순위 가치에 가장 큰 가중치
const RANK_WEIGHTS = [0.4, 0.3, 0.2, 0.1];

export function valueFit(world: WorldTemplate, profile: Profile): number {
  return profile.values.reduce((sum, v, i) => sum + (RANK_WEIGHTS[i] ?? 0) * (world.fitValues[v] ?? 0.5), 0);
}

function traitFit(world: WorldTemplate, bigFive: BigFive): number {
  const keys = Object.keys(world.fitTraits) as (keyof BigFive)[];
  if (keys.length === 0) return 0.5;
  const gap = keys.reduce((sum, k) => sum + Math.abs(bigFive[k] - (world.fitTraits[k] ?? 3)), 0) / keys.length;
  return 1 - gap / 4;
}

function interestFit(world: WorldTemplate, interests: Interests | null): number {
  if (!interests) return 0.5;
  const keys = Object.keys(world.fitInterests) as (keyof Interests)[];
  if (keys.length === 0) return 0.5;
  const gap = keys.reduce((sum, k) => sum + Math.max(0, (world.fitInterests[k] ?? 3) - interests[k]), 0) / keys.length;
  return 1 - gap / 4;
}

// 시뮬레이션 전: 이 길이 나와 얼마나 맞아 보이는지(0~1)
export function preFit(world: WorldTemplate, profile: Profile): number {
  return 0.6 * valueFit(world, profile) + 0.25 * traitFit(world, profile.bigFive) + 0.15 * interestFit(world, profile.interests);
}

// 시뮬레이션 후: 리포트에 보여 줄 부합도(0~100). 100번 살아본 결과를 함께 반영한다.
export function finalFit(world: WorldTemplate, profile: Profile, stats: WorldStats): number {
  const outcome = (stats.satisfiedShare / 100) * 0.5 + ((stats.gate?.share ?? 0) / 100) * 0.3 + (1 - stats.stressedShare / 100) * 0.2;
  const score = 0.45 * valueFit(world, profile) + 0.15 * traitFit(world, profile.bigFive) + 0.1 * interestFit(world, profile.interests) + 0.3 * outcome;
  return Math.round(score * 100);
}

// 고르지 않은 진로 중 가장 잘 맞는 하나를 '제3의 길'로 제안
export function suggestThirdPath(profile: Profile, chosen: string[]): WorldTemplate | null {
  const rest = WORLDS.filter((w) => !chosen.includes(w.id));
  if (rest.length === 0) return null;
  return rest.toSorted((a, b) => preFit(b, profile) - preFit(a, profile))[0];
}

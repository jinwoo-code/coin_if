// AI 분신 판단 캐시(docs/선택-설계-근거.md '두 가지 시뮬레이션 모드' 기본 모드).
// 내 선택으로 갈리는 큰 갈림길(branch "choice")마다, 상황 칸(lib/base.ts)별로 AI가 말한 보기별 확률과 보기별 이유를 profile.judges에 둔다.
// 키 = 프롬프트 버전 | 프로필 해시 | 진로 id | 갈림길 id | 상황 칸. 프로필이나 프롬프트가 바뀌면 키가 바뀌어 예전 판단은 안 쓰이고, 다음 미리 불러오기 때 지운다.
// 엔진(lib/engine.ts)이 갈림길에서 읽으므로 엔진을 import하지 않는다. 브라우저·서버 둘 다 쓴다.
import { allBuckets } from "./base";
import { scrubStory } from "./story";
import type { EventCard, Profile, WorldTemplate } from "./types";

// 프롬프트(app/api/judge/route.ts)를 고치면 올린다. 판단 캐시 키에 들어가서 다시 판단하게 된다.
export const JUDGE_PROMPT_VERSION = "3";

export interface JudgeEntry {
  probs: number[]; // 보기 순서대로(합 1)
  reasons: string[]; // 보기 순서대로, 이 사람이 그 보기를 고른다면 그 이유
  shift?: string; // 보통 사람과 비교해 어느 쪽으로 기우는지 한 문장
  src: "ai" | "mock" | "fallback"; // ai = AI 판단, mock = 키 없음(규칙 기울기), fallback = AI 실패(규칙 기울기)
}
export type JudgeMap = Record<string, JudgeEntry>;

// 판단에 들어가는 값만으로 해시(FNV-1a). 이야기 원문·근거 인용·판단 캐시 자체는 넣지 않는다.
export function profileHash(p: Profile) {
  const corr = (p.corrections ?? []).map((c) => c.to).toSorted();
  const src = JSON.stringify([p.values, p.bigFive, p.behavior, p.story ? scrubStory(p.story) : null, p.summary, corr, p.wants, p.major, p.life.savings, p.life.support, p.life.livingCost]);
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// 같은 프로필 객체는 해시를 한 번만(엔진이 1,000번 × 갈림길마다 부른다)
const hashes = new WeakMap<Profile, string>();
const hashOf = (p: Profile) => hashes.get(p) ?? (hashes.set(p, profileHash(p)), hashes.get(p)!);

export const judgeKey = (hash: string, worldId: string, forkId: string, bucket: string) => `${JUDGE_PROMPT_VERSION}|${hash}|${worldId}|${forkId}|${bucket}`;

// AI가 판단하는 갈림길: 내 선택으로 갈리는 큰 갈림길만(팀장 결정 2026-11-03, 호출 수를 줄이려고)
export const judgeForks = (w: WorldTemplate) => w.events.filter((e) => e.branch === "choice" && e.choices.length >= 2);

export function judgeFor(p: Profile, worldId: string, e: EventCard, bucket: string): JudgeEntry | null {
  if (e.branch !== "choice" || !p.judges) return null;
  const j = p.judges[judgeKey(hashOf(p), worldId, e.id, bucket)];
  return j && j.src === "ai" && j.probs.length === e.choices.length ? j : null;
}

// AI 판단을 받으려다 실패해서 규칙 기울기로 처리되는 칸인지(작은 갈림길·키 없음은 실패가 아니다)
export function judgeFailed(p: Profile, worldId: string, e: EventCard, bucket: string) {
  return e.branch === "choice" && p.judges?.[judgeKey(hashOf(p), worldId, e.id, bucket)]?.src === "fallback";
}

// 호출 자체가 실패했을 때 남기는 표시(다음 미리 불러오기 때 다시 묻는다)
export function failedEntries(e: EventCard): Record<string, JudgeEntry> {
  return Object.fromEntries(allBuckets(e.stateKeys ?? []).map((b) => [b, { probs: [], reasons: [], src: "fallback" as const }]));
}

// 아직 AI 판단이 없는 (진로, 갈림길)들(지난번에 실패한 곳 포함). 한 갈림길의 상황 칸은 한 번의 호출로 같이 받는다.
export function missingJudges(p: Profile, worlds: WorldTemplate[]) {
  const h = profileHash(p);
  return worlds.flatMap((w) =>
    judgeForks(w)
      .filter((e) => allBuckets(e.stateKeys ?? []).some((b) => p.judges?.[judgeKey(h, w.id, e.id, b)]?.src !== "ai"))
      .map((e) => ({ world: w, fork: e })),
  );
}

// 새 판단을 합치고, 지금 프로필과 해시가 다른(예전 프로필의) 판단은 버린다.
export function withJudges(p: Profile, worldId: string, forkId: string, byBucket: Record<string, JudgeEntry>): Profile {
  const h = profileHash(p);
  const kept = Object.fromEntries(Object.entries(p.judges ?? {}).filter(([k]) => k.startsWith(`${JUDGE_PROMPT_VERSION}|${h}|`)));
  for (const [b, j] of Object.entries(byBucket)) kept[judgeKey(h, worldId, forkId, b)] = j;
  return { ...p, judges: kept };
}

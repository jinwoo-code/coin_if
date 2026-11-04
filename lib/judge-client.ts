// 시뮬레이션 전에 고른 진로들의 큰 갈림길 판단을 미리 받아 profile.judges에 넣는다(lib/judge.ts).
// 한 번에 최대 8개씩 /api/judge를 부르고, 갈림길 하나가 끝날 때마다 진행을 알린다. 실패한 갈림길은 비워 두고(엔진이 규칙 기울기로 고름) 다음에 다시 묻는다.
// 이야기 원문·근거 인용·판단 캐시는 보내지 않는다.
import { missingJudges, withJudges, type JudgeEntry } from "./judge";
import { scrubStory } from "./story";
import type { Profile, WorldTemplate } from "./types";

export const JUDGE_CONCURRENCY = 8;

export interface JudgeReport {
  worldId: string;
  calls: number;
  ai: number; // AI가 판단한 갈림길 수(나머지는 규칙 기울기)
  ms: number; // 이 진로의 판단을 모두 받는 데 걸린 시간
}

export async function prefetchJudges(profile: Profile, worlds: WorldTemplate[], onProgress?: (done: number, total: number) => void) {
  const todo = missingJudges(profile, worlds);
  const sendable = scrubStory({ ...profile, storyRaw: {}, judges: {} });
  const report: Record<string, JudgeReport> = Object.fromEntries(worlds.map((w) => [w.id, { worldId: w.id, calls: 0, ai: 0, ms: 0 }]));
  const started = Date.now();
  let p = profile;
  let done = 0;
  onProgress?.(0, todo.length);
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const { world, fork } = todo[next++];
      try {
        const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: sendable, worldId: world.id, forkId: fork.id }) });
        if (res.ok) {
          const body = (await res.json()) as { entries: Record<string, JudgeEntry>; src: JudgeEntry["src"] };
          // 키가 없으면(목업) 저장하지 않는다: 엔진의 규칙 기울기와 같은 값이라 저장할 필요가 없고, 키가 생기면 그때 AI에게 묻는다.
          if (body.src !== "mock" && body.src !== "fallback") p = withJudges(p, world.id, fork.id, body.entries);
          if (body.src === "ai") report[world.id].ai++;
        }
      } catch {
        // 네트워크 실패: 이 갈림길은 규칙 기울기로
      }
      report[world.id].calls++;
      report[world.id].ms = Date.now() - started;
      onProgress?.(++done, todo.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(JUDGE_CONCURRENCY, todo.length) }, worker));
  return { profile: p, report: Object.values(report), total: todo.length };
}

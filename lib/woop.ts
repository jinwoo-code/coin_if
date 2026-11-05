// WOOP 장애물의 근거: 시뮬레이션에서 그 사람에게 자주 나온 큰 갈림길(엔진 값, AI 없음).
import { getWorld } from "./worlds";
import type { Multiverse, WoopFork } from "./types";

export function topForks(mvs: Record<string, Multiverse>, n = 2): WoopFork[] {
  const out: WoopFork[] = [];
  for (const [id, mv] of Object.entries(mvs)) {
    const w = getWorld(id);
    for (const e of w.events) {
      const hit = mv.stats.events[e.id];
      if (e.branch !== "choice" || !hit || !e.branchLabel) continue;
      out.push({ worldId: id, worldName: w.short, label: e.branchLabel, share: Math.round((hit.count / mv.stats.runs) * 100) });
    }
  }
  return out.toSorted((a, b) => b.share - a.share).slice(0, n);
}

// 규칙 문장. AI 문장이 갈림길을 말하지 않으면 이걸 쓴다.
export function ruleObstacle(forks: WoopFork[], old: string) {
  if (!forks.length) return old;
  return `${forks.map((f) => `'${f.label}'`).join(", ")} 같은 갈림길이 오면 마음이 흔들려 하던 일을 미루게 됨`;
}

export const obstacleUsesFork = (text: string, forks: WoopFork[]) => !forks.length || forks.some((f) => text.replace(/\s/g, "").includes(f.label.replace(/\s/g, "")));

export interface WeekEntry {
  id: string;
  when: string;
  where: string;
  what: string;
  done?: boolean;
  example?: boolean; // AI가 채운 예시. 고치면 내 것이 된다
}
export const shortText = (x: unknown, n = 30) => (typeof x === "string" ? x.trim().slice(0, n) : "");

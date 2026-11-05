// 항목을 갖췄다고 가정하고 200번 다시 돌린 목표 도달률 차이('바꿀 수 있는 것'과 같은 방식, 같은 회차끼리 비교).
// 같은 조건을 바꾸는 항목은 한 번만 돌린다. Web Worker에서 부른다(lib/levers-client.ts).
import { tweakOf, type GapItem } from "./gap";
import { LEVER_RUNS, runAll, statsOf } from "./multiverse";
import type { Profile, WorldTemplate } from "./types";

export function gapDeltas(p: Profile, w: WorldTemplate, months: number, startYm: string, gaps: GapItem[], n = LEVER_RUNS): Record<string, number> {
  const base = statsOf(p, w, runAll(p, w, months, startYm, undefined, n)).gate?.share ?? 0;
  const out: Record<string, number> = {};
  for (const g of gaps) {
    if (g.status === "have") continue;
    const t = tweakOf(g.item, w);
    if (!t || out[t.key] !== undefined) continue;
    const q = t.apply(p);
    if (!q) continue;
    out[t.key] = (statsOf(q, w, runAll(q, w, months, startYm, undefined, n)).gate?.share ?? 0) - base;
  }
  return out;
}

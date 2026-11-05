// 화면을 멈추지 않게 따로 계산한다. '바꿀 수 있는 것'(lib/multiverse.ts levers)은 조건을 바꿔 200번씩 여러 번, 세계선은 1,000번 다시 산다.
import { gapDeltas } from "../gap-sim";
import type { GapItem } from "../gap";
import { buildMultiverse, levers } from "../multiverse";
import { planRerun, type PlanInput } from "../plan-sim";
import type { Profile } from "../types";
import { getWorld } from "../worlds";

self.onmessage = (e: MessageEvent<{ id: number; kind?: "levers" | "multiverse" | "gap" | "plan"; plan?: PlanInput; profile: Profile; worldId: string; months: number; startYm: string; gaps?: GapItem[] }>) => {
  const { id, kind, profile, worldId, months, startYm, gaps, plan } = e.data;
  try {
    const world = getWorld(worldId);
    if (kind === "gap") {
      self.postMessage({ id, deltas: gapDeltas(profile, world, months, startYm, gaps ?? []) });
      return;
    }
    if (kind === "plan" && plan) {
      self.postMessage({ id, rerun: planRerun(profile, world, months, startYm, plan) });
      return;
    }
    const { mv, paths } = buildMultiverse(profile, world, months, startYm);
    if (kind === "multiverse") self.postMessage({ id, multiverse: mv });
    else self.postMessage({ id, levers: levers(profile, world, months, startYm, paths) });
  } catch (err) {
    self.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};

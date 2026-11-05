// 화면을 멈추지 않게 따로 계산한다. '바꿀 수 있는 것'(lib/multiverse.ts levers)은 조건을 바꿔 200번씩 여러 번, 세계선은 1,000번 다시 산다.
import { buildMultiverse, levers } from "../multiverse";
import type { Profile } from "../types";
import { getWorld } from "../worlds";

self.onmessage = (e: MessageEvent<{ id: number; kind?: "levers" | "multiverse"; profile: Profile; worldId: string; months: number; startYm: string }>) => {
  const { id, kind, profile, worldId, months, startYm } = e.data;
  try {
    const world = getWorld(worldId);
    const { mv, paths } = buildMultiverse(profile, world, months, startYm);
    if (kind === "multiverse") self.postMessage({ id, multiverse: mv });
    else self.postMessage({ id, levers: levers(profile, world, months, startYm, paths) });
  } catch (err) {
    self.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};

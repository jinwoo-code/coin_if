// '바꿀 수 있는 것'(lib/multiverse.ts levers)을 화면을 멈추지 않게 따로 계산한다.
// 조건을 바꿔 200번씩 여러 번 다시 사는 일이라 화면을 멈추지 않게 따로 돌린다(LEVER_RUNS).
import { buildMultiverse, levers } from "../multiverse";
import type { Profile } from "../types";
import { getWorld } from "../worlds";

self.onmessage = (e: MessageEvent<{ id: number; profile: Profile; worldId: string; months: number; startYm: string }>) => {
  const { id, profile, worldId, months, startYm } = e.data;
  try {
    const world = getWorld(worldId);
    const { paths } = buildMultiverse(profile, world, months, startYm);
    self.postMessage({ id, levers: levers(profile, world, months, startYm, paths) });
  } catch (err) {
    self.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};

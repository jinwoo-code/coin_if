// '바꿀 수 있는 것'(lib/multiverse.ts levers)을 화면을 멈추지 않게 따로 계산한다.
// 조건을 바꿔 1,000번씩 여러 번 다시 사는 일이라 휴대폰에서는 수십 초 걸릴 수 있다(docs 결정 기록 2026-11-03 4단계).
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

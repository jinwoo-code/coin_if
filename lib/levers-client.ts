// 브라우저에서 '바꿀 수 있는 것'을 Web Worker로 계산한다(진로마다 Worker 하나, 끝나면 닫음 → 진로 여러 개를 나란히).
// Worker를 못 쓰는 환경이면 화면 스레드에서 계산한다.
import { buildMultiverse, levers } from "./multiverse";
import type { Lever, Profile } from "./types";
import { getWorld } from "./worlds";

export function computeLevers(profile: Profile, worldId: string, months: number, startYm: string): Promise<Lever[]> {
  let worker: Worker | null = null;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(new URL("./workers/levers.worker.ts", import.meta.url));
  } catch {
    worker = null;
  }
  if (!worker) {
    const world = getWorld(worldId);
    const { paths } = buildMultiverse(profile, world, months, startYm);
    return Promise.resolve(levers(profile, world, months, startYm, paths));
  }
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ levers?: Lever[]; error?: string }>) => {
      w.terminate();
      if (e.data.levers) resolve(e.data.levers);
      else reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({ id: 0, profile, worldId, months, startYm });
  });
}

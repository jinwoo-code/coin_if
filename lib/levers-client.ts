// 브라우저에서 무거운 계산을 Web Worker로 한다(진로마다 Worker 하나, 끝나면 닫음 → 진로 여러 개를 나란히).
// Worker를 못 쓰는 환경이면 화면 스레드에서 계산한다.
import { buildMultiverse, levers } from "./multiverse";
import type { Lever, Multiverse, Profile } from "./types";
import { getWorld } from "./worlds";

function inWorker<T>(kind: "levers" | "multiverse", profile: Profile, worldId: string, months: number, startYm: string, fallback: () => T): Promise<T> {
  let worker: Worker | null = null;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(new URL("./workers/levers.worker.ts", import.meta.url));
  } catch {
    worker = null;
  }
  if (!worker) return Promise.resolve(fallback());
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ levers?: Lever[]; multiverse?: Multiverse; error?: string }>) => {
      w.terminate();
      const out = kind === "levers" ? e.data.levers : e.data.multiverse;
      if (out) resolve(out as T);
      else reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({ id: 0, kind, profile, worldId, months, startYm });
  });
}

export function computeLevers(profile: Profile, worldId: string, months: number, startYm: string): Promise<Lever[]> {
  return inWorker("levers", profile, worldId, months, startYm, () => {
    const world = getWorld(worldId);
    return levers(profile, world, months, startYm, buildMultiverse(profile, world, months, startYm).paths);
  });
}

export function computeMultiverse(profile: Profile, worldId: string, months: number, startYm: string): Promise<Multiverse> {
  return inWorker("multiverse", profile, worldId, months, startYm, () => buildMultiverse(profile, getWorld(worldId), months, startYm).mv);
}

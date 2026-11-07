// 브라우저에서 무거운 계산을 Web Worker로 한다(진로마다 Worker 하나, 끝나면 닫음 → 진로 여러 개를 나란히).
// Worker를 못 쓰는 환경이면 화면 스레드에서 계산한다.
import { checkinRerun, planRerun, type CheckinRerun, type PlanInput, type PlanRerun } from "./plan-sim";
import type { GapItem } from "./gap";
import { gapDeltas } from "./gap-sim";
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

// 항목별 시뮬레이션 효과. 진로 하나에 Worker 하나.
export function computeGapDeltas(profile: Profile, worldId: string, months: number, startYm: string, gaps: GapItem[]): Promise<Record<string, number>> {
  const fallback = () => gapDeltas(profile, getWorld(worldId), months, startYm, gaps);
  let w: Worker | null = null;
  try {
    w = typeof Worker === "undefined" ? null : new Worker(new URL("./workers/levers.worker.ts", import.meta.url));
  } catch {
    w = null;
  }
  if (!w) return Promise.resolve(fallback());
  const worker = w;
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ deltas?: Record<string, number>; error?: string }>) => {
      worker.terminate();
      if (e.data.deltas) resolve(e.data.deltas);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ id: 0, kind: "gap", profile, worldId, months, startYm, gaps });
  });
}

export function computePlanRerun(profile: Profile, worldId: string, months: number, startYm: string, plan: PlanInput): Promise<PlanRerun | null> {
  const fallback = () => planRerun(profile, getWorld(worldId), months, startYm, plan);
  let w: Worker | null = null;
  try {
    w = typeof Worker === "undefined" ? null : new Worker(new URL("./workers/levers.worker.ts", import.meta.url));
  } catch {
    w = null;
  }
  if (!w) return Promise.resolve(fallback());
  const worker = w;
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ rerun?: PlanRerun | null; error?: string }>) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.rerun ?? null);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ id: 0, kind: "plan", profile, worldId, months, startYm, plan });
  });
}

export function computeCheckinRerun(before: Profile, after: Profile, worldId: string, months: number, startYm: string): Promise<CheckinRerun> {
  const fallback = () => checkinRerun(before, after, getWorld(worldId), months, startYm);
  let w: Worker | null = null;
  try {
    w = typeof Worker === "undefined" ? null : new Worker(new URL("./workers/levers.worker.ts", import.meta.url));
  } catch {
    w = null;
  }
  if (!w) return Promise.resolve(fallback());
  const worker = w;
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ checkin?: CheckinRerun; error?: string }>) => {
      worker.terminate();
      if (e.data.checkin) resolve(e.data.checkin);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ id: 0, kind: "checkin", profile: before, after, worldId, months, startYm });
  });
}

export function computeMultiverse(profile: Profile, worldId: string, months: number, startYm: string): Promise<Multiverse> {
  return inWorker("multiverse", profile, worldId, months, startYm, () => buildMultiverse(profile, getWorld(worldId), months, startYm).mv);
}

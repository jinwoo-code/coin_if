// 로그인했을 때 브라우저 저장(lib/store.ts)을 계정(/api/sync)에 올리고, 빈 기기에서는 계정 기록을 내려받는다.
// 로그인 안 했거나 Supabase 키가 없으면 아무것도 안 한다(앱은 브라우저 저장만으로 돈다).
"use client";
import { store } from "./store";
import type { Multiverse, Profile, SimEvent } from "./types";

export interface SyncStatus {
  user: { id: string; email?: string } | null;
  consented?: boolean;
  profile?: Profile | null;
  simulations?: SimRow[];
}

interface SimRow {
  run_key: string;
  career: string;
  months: number;
  start_month: string;
  summary: Multiverse;
  chosen_line: string | null;
  scenes: Record<string, SimEvent[]>;
}

export async function fetchStatus(): Promise<SyncStatus> {
  try {
    const res = await fetch("/api/sync", { cache: "no-store" });
    return res.ok ? ((await res.json()) as SyncStatus) : { user: null };
  } catch {
    return { user: null };
  }
}

// 같은 결과는 같은 키(엔진은 같은 입력이면 같은 결과를 낸다) → 여러 번 올려도 한 행
function runKey(m: Multiverse) {
  const s = `${m.worldId}|${m.startYm}|${m.months}|${m.stats.runs}|${JSON.stringify(m.stats.final)}|${m.lines.map((l) => `${l.id}:${l.count}`).join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return `${m.worldId}-${h.toString(36)}`;
}

export function localSnapshot() {
  const profile = store.getProfile();
  const mvs = store.getMultiverses() ?? {};
  const lines = store.getLines();
  const active = store.getActive();
  const simulations: SimRow[] = Object.values(mvs).map((m) => ({
    run_key: runKey(m),
    career: m.worldId,
    months: m.months,
    start_month: m.startYm,
    summary: m,
    chosen_line: active[m.worldId] ?? null,
    scenes: lines[m.worldId] ?? {},
  }));
  return { profile, simulations };
}

export function hasLocalResults() {
  return !store.isLocalOnly() && Boolean(store.getProfile());
}

export async function pushNow() {
  if (store.isLocalOnly()) return false;
  const snap = localSnapshot();
  if (!snap.profile && !snap.simulations.length) return false;
  try {
    const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snap) });
    return res.ok;
  } catch {
    return false;
  }
}

// 계정에 저장된 가장 최근 묶음(같은 시작 연월·기간)을 브라우저에 깐다. 브라우저에 이미 결과가 있으면 건드리지 않는다.
export function restore(status: SyncStatus) {
  if (store.getProfile() || !status.profile) return false;
  store.onWrite(null);
  store.setProfile(status.profile);
  const sims = status.simulations ?? [];
  if (sims.length) {
    const head = sims[0];
    const batch = sims.filter((s) => s.start_month === head.start_month && s.months === head.months);
    const seen = new Set<string>();
    const mvs: Record<string, Multiverse> = {};
    for (const s of batch) {
      if (seen.has(s.career)) continue;
      seen.add(s.career);
      mvs[s.career] = s.summary;
      for (const [lineId, scenes] of Object.entries(s.scenes ?? {})) store.setLine(s.career, lineId, scenes);
      if (s.chosen_line) store.setActive(s.career, s.chosen_line);
    }
    store.setMultiverses(mvs);
    store.setSelection({ worldIds: Object.keys(mvs), months: head.months, startYm: head.start_month });
  }
  return true;
}

// 저장할 때마다 1.5초 모았다가 올린다.
let timer: ReturnType<typeof setTimeout> | null = null;
export function startAutoSync() {
  store.onWrite(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void pushNow(), 1500);
  });
}
export function stopAutoSync() {
  if (timer) clearTimeout(timer);
  store.onWrite(null);
}

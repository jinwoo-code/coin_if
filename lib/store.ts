// 브라우저에 진행 상황을 저장한다(로그인 없이 데모가 돌도록).
// 로그인하면 lib/sync.ts가 onWrite로 저장을 듣고 계정에도 올린다. 이 파일은 브라우저 저장만 맡는다.
"use client";
import { normalizeProfile } from "./profile";
import type { Multiverse, Profile, Report, Selection, SimEvent } from "./types";

// 저장 형식이 바뀌면 VERSION을 올린다. 옛 데이터와 섞이지 않는다.
const VERSION = "v4";
const KEYS = {
  profile: `cr:${VERSION}:profile`,
  selection: `cr:${VERSION}:selection`,
  multiverses: `cr:${VERSION}:multiverses`,
  lines: `cr:${VERSION}:lines`,
  active: `cr:${VERSION}:active`,
  report: `cr:${VERSION}:report`,
  localOnly: `cr:${VERSION}:localOnly`, // true면 계정에 올리지 않는다(예시 인물, 또는 '옮기지 않기'를 고른 결과)
} as const;

// 저장할 때마다 부르는 함수(계정 동기화). 하나만 둔다.
let onWrite: (() => void) | null = null;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막힌 환경(시크릿 창 등)에서는 조용히 넘어간다.
  }
  onWrite?.();
}

// 세계선별 장면: { [worldId]: { [lineId]: SimEvent[] } }
type LineCache = Record<string, Record<string, SimEvent[]>>;

export const store = {
  getProfile: () => {
    const p = read<Profile>(KEYS.profile);
    return p ? normalizeProfile(p) : null;
  },
  setProfile: (p: Profile) => write(KEYS.profile, p),
  getSelection: () => read<Selection>(KEYS.selection),
  setSelection: (s: Selection) => write(KEYS.selection, s),
  getMultiverses: () => read<Record<string, Multiverse>>(KEYS.multiverses),
  setMultiverses: (m: Record<string, Multiverse> | null) => write(KEYS.multiverses, m),
  getLines: () => read<LineCache>(KEYS.lines) ?? {},
  getLine: (worldId: string, lineId: string) => read<LineCache>(KEYS.lines)?.[worldId]?.[lineId] ?? null,
  setLine: (worldId: string, lineId: string, scenes: SimEvent[]) => {
    const all = read<LineCache>(KEYS.lines) ?? {};
    all[worldId] = { ...(all[worldId] ?? {}), [lineId]: scenes };
    write(KEYS.lines, all);
  },
  // 진로마다 지금 보고 있는 세계선(대화·리포트가 이 세계선을 기준으로 한다)
  getActive: () => read<Record<string, string>>(KEYS.active) ?? {},
  setActive: (worldId: string, lineId: string) => write(KEYS.active, { ...(read<Record<string, string>>(KEYS.active) ?? {}), [worldId]: lineId }),
  getReport: () => read<Report>(KEYS.report),
  setReport: (r: Report | null) => write(KEYS.report, r),
  isLocalOnly: () => read<boolean>(KEYS.localOnly) === true,
  setLocalOnly: (on: boolean) => write(KEYS.localOnly, on ? true : null),
  onWrite: (fn: (() => void) | null) => {
    onWrite = fn;
  },
  // 시뮬레이션 결과만 지운다(프로필·선택은 남김)
  clearResults: () => {
    write(KEYS.multiverses, null);
    write(KEYS.lines, null);
    write(KEYS.active, null);
    write(KEYS.report, null);
  },
  reset: () => {
    try {
      Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // 무시
    }
  },
};

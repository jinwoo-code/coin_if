// 브라우저에 진행 상황을 저장한다(로그인 없이 데모가 돌도록).
// 로그인하면 lib/sync.ts가 onWrite로 저장을 듣고 계정에도 올린다. 이 파일은 브라우저 저장만 맡는다.
"use client";
import { normalizeProfile } from "./profile";
import type { Multiverse, PremiumItem, Profile, Report, Selection, SimEvent } from "./types";

// 저장 형식이 바뀌면 VERSION을 올린다. 옛 데이터와 섞이지 않는다.
// v5(2026-11 검사 개편): profile에 depthMode·answers·holdout·holdoutPicks·story·storyRaw 추가. v4는 처음 읽을 때 옮긴다(migrate).
const VERSION = "v5";
const PREV = "v4";
const KEYS = {
  profile: `cr:${VERSION}:profile`,
  selection: `cr:${VERSION}:selection`,
  multiverses: `cr:${VERSION}:multiverses`,
  lines: `cr:${VERSION}:lines`,
  active: `cr:${VERSION}:active`,
  report: `cr:${VERSION}:report`,
  premium: `cr:${VERSION}:premium`, // 프리미엄 리포트(산 뒤에 다시 열 때)
  localOnly: `cr:${VERSION}:localOnly`, // true면 계정에 올리지 않는다(예시 인물, 또는 '옮기지 않기'를 고른 결과)
} as const;

// 저장할 때마다 부르는 함수(계정 동기화). 하나만 둔다.
let onWrite: (() => void) | null = null;

// v4 → v5: 키 이름만 바꿔 옮긴다. 새 프로필 칸은 normalizeProfile이 기본값(빠르게, 채점용 없음, 이야기 없음)으로 채운다.
// 예전 프로필은 원답이 없어서, 깊이를 올리면 이미 한 검사는 depth 개수로 판단한다(lib/assessment.ts isAnswered).
let migrated = false;
function migrate() {
  if (migrated) return;
  migrated = true;
  try {
    const ls = window.localStorage;
    for (const name of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
      const old = `cr:${PREV}:${KEYS[name].split(":")[2]}`;
      const raw = ls.getItem(old);
      if (raw === null) continue;
      if (ls.getItem(KEYS[name]) === null) ls.setItem(KEYS[name], raw);
      ls.removeItem(old);
    }
  } catch {
    // 저장이 막힌 환경이면 옮기지 않는다
  }
}

function read<T>(key: string): T | null {
  migrate();
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
  getPremium: () => read<PremiumItem[]>(KEYS.premium),
  setPremium: (p: PremiumItem[] | null) => write(KEYS.premium, p),
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
    write(KEYS.premium, null);
  },
  reset: () => {
    try {
      Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // 무시
    }
  },
};

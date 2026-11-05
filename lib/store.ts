// 브라우저에 진행 상황을 저장한다(로그인 없이 데모가 돌도록).
// 로그인하면 lib/sync.ts가 onWrite로 저장을 듣고 계정에도 올린다. 이 파일은 브라우저 저장만 맡는다.
"use client";
import type { SkillAnswers } from "./gap";
import type { EvidenceSaved } from "./evidence";
import type { PlanRerun } from "./plan-sim";
import type { PlanEdits } from "./schedule";
import { normalizeProfile } from "./profile";
import type { LiveEntries } from "./live";
import type { Multiverse, PremiumItem, Profile, Report, Selection, SimEvent } from "./types";

// 저장 형식이 바뀌면 VERSION을 올린다. 옛 데이터와 섞이지 않는다.
// v5(2026-11 검사 개편): profile에 depthMode·answers·holdout·holdoutPicks·story·storyRaw 추가.
// v6(2026-11-03 분신 작업): profile에 since·corrections·checkins 추가, storyRaw에 인생 이야기 장. 예전 판은 처음 읽을 때 옮긴다(migrate).
// v7(2026-11-03 파일럿): profile에 pilot 추가, holdoutPicks에 파일럿 답(p1~p20).
// v8(2026-11-03 선택 개편): profile에 judges(AI 분신 판단 캐시) 추가.
// v9(2026-11-04 실시간 판단 모드): selection에 mode, 진행 저장 live 추가.
const VERSION = "v9";
const PREVS = ["v8", "v7", "v6", "v5", "v4"]; // 최근 판부터 찾는다
const KEYS = {
  profile: `cr:${VERSION}:profile`,
  selection: `cr:${VERSION}:selection`,
  multiverses: `cr:${VERSION}:multiverses`,
  lines: `cr:${VERSION}:lines`,
  active: `cr:${VERSION}:active`,
  report: `cr:${VERSION}:report`,
  live: `cr:${VERSION}:live`, // 실시간 판단 모드 진행(이 기기에만)
  liveResults: `cr:${VERSION}:liveResults`, // 끝난 실시간 판단 30개의 삶(1,000번 결과와 따로, 이 기기에만)
  gapAnswers: `cr:${VERSION}:gapAnswers`, // 능력 묶음 답(이 기기에만)
  planEdits: `cr:${VERSION}:planEdits`, // 월별 일정 수정(이 기기에만)
  evidence: `cr:${VERSION}:evidence`, // 증거물 주제·체크·모의고사 기록(이 기기에만)
  planReruns: `cr:${VERSION}:planReruns`, // 계획 넣고 다시 살아 본 결과(이 기기에만)
  premium: `cr:${VERSION}:premium`, // 프리미엄 리포트(산 뒤에 다시 열 때)
  localOnly: `cr:${VERSION}:localOnly`,
  pilotInvite: `cr:${VERSION}:pilotInvite`, // /interview?pilot=1로 들어온 기기 // true면 계정에 올리지 않는다(예시 인물, 또는 '옮기지 않기'를 고른 결과)
} as const;

export interface LiveResults {
  mvs: Record<string, Multiverse>;
  scenes: Record<string, Record<string, SimEvent[]>>; // 진로 > 삶 갈래 > 장면(그 삶 그대로)
  active: Record<string, string | null>; // 대화 상대로 고른 갈래
}

// 저장할 때마다 부르는 함수(계정 동기화). 하나만 둔다.
let onWrite: (() => void) | null = null;

// 예전 판 → 지금 판: 키 이름만 바꿔 옮긴다. 새 프로필 칸은 normalizeProfile이 기본값(빠르게, 채점용 없음, 이야기 없음, 고친 선택·체크인 없음)으로 채운다.
// 예전 프로필은 원답이 없어서, 깊이를 올리면 이미 한 검사는 depth 개수로 판단한다(lib/assessment.ts isAnswered).
let migrated = false;
function migrate() {
  if (migrated) return;
  migrated = true;
  try {
    const ls = window.localStorage;
    for (const name of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
      for (const prev of PREVS) {
        const old = `cr:${prev}:${KEYS[name].split(":")[2]}`;
        const raw = ls.getItem(old);
        if (raw === null) continue;
        if (ls.getItem(KEYS[name]) === null) ls.setItem(KEYS[name], raw);
        ls.removeItem(old);
      }
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

// 실시간 판단 모드 진행. 입력이 바뀌면 key가 바뀌어 처음부터.
export interface LiveRun {
  key: string;
  entries: LiveEntries;
  ruleRest: boolean; // 남은 건 규칙 계산으로 끝내기
  charged: boolean;
}

// 세계선별 장면: { [worldId]: { [lineId]: SimEvent[] } }
type LineCache = Record<string, Record<string, SimEvent[]>>;

export const store = {
  getProfile: () => {
    const p = read<Profile>(KEYS.profile);
    return p ? normalizeProfile(p) : null;
  },
  setProfile: (p: Profile) => write(KEYS.profile, p),
  getGapAnswers: () => read<Record<string, SkillAnswers>>(KEYS.gapAnswers) ?? {},
  setGapAnswers: (a: Record<string, SkillAnswers>) => write(KEYS.gapAnswers, a),
  getPlanEdits: () => read<Record<string, PlanEdits>>(KEYS.planEdits) ?? {},
  setPlanEdits: (a: Record<string, PlanEdits>) => write(KEYS.planEdits, a),
  getPlanReruns: () => read<Record<string, { sig: string; result: PlanRerun }>>(KEYS.planReruns) ?? {},
  setPlanReruns: (a: Record<string, { sig: string; result: PlanRerun }>) => write(KEYS.planReruns, a),
  getEvidence: () => read<Record<string, EvidenceSaved>>(KEYS.evidence) ?? {},
  setEvidence: (a: Record<string, EvidenceSaved>) => write(KEYS.evidence, a),
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
  getLive: () => read<LiveRun>(KEYS.live),
  // 답이 올 때마다 저장한다. 계정에는 안 올려서 onWrite를 부르지 않는다.
  getLiveResults: () => read<LiveResults>(KEYS.liveResults),
  setLiveResults: (r: LiveResults | null) => write(KEYS.liveResults, r),
  // 대화 상대를 30개의 삶에서 고른다. null이면 1,000번 쪽 세계선으로 돌아간다.
  setLiveActive: (worldId: string, lineId: string | null) => {
    const r = read<LiveResults>(KEYS.liveResults);
    if (r) write(KEYS.liveResults, { ...r, active: { ...r.active, [worldId]: lineId } });
  },
  setLive: (r: LiveRun) => {
    try {
      window.localStorage.setItem(KEYS.live, JSON.stringify(r));
    } catch {
      // 저장이 막힌 환경이면 이번 창에서만 이어진다
    }
  },
  getReport: () => read<Report>(KEYS.report),
  setReport: (r: Report | null) => write(KEYS.report, r),
  getPremium: () => read<PremiumItem[]>(KEYS.premium),
  setPremium: (p: PremiumItem[] | null) => write(KEYS.premium, p),
  isLocalOnly: () => read<boolean>(KEYS.localOnly) === true,
  setLocalOnly: (on: boolean) => write(KEYS.localOnly, on ? true : null),
  isPilotInvited: () => read<boolean>(KEYS.pilotInvite) === true,
  setPilotInvited: () => write(KEYS.pilotInvite, true),
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
    write(KEYS.liveResults, null);
  },
  reset: () => {
    try {
      Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // 무시
    }
  },
};

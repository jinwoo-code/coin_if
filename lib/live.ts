// 실시간 판단 모드(docs/선택-설계-근거.md '두 가지 시뮬레이션 모드'): 삶을 하나씩 살면서, 큰 갈림길에 닿을 때마다 그때 상황으로 AI에게 묻는다.
// 엔진은 멈출 수 없어서, 판단이 없으면 LivePause를 던지고 판단을 받은 뒤 처음부터 다시 돈다. 시드가 같아서 앞부분은 똑같이 되풀이된다.
// 그래서 받은 판단만 저장해 두면 창을 닫았다 열어도 이어지고, 다시 열면 같은 인생이 나온다. 브라우저·서버·스크립트 모두에서 돈다.
import { keyLabel, isSatisfied, multiverseOf, seedFor, statsOf } from "./multiverse";
import { simulatePath, type LiveCtx } from "./engine";
import { JUDGE_PROMPT_VERSION, judgeForks, type JudgeEntry } from "./judge";
import { scenesOf } from "./scenes";
import type { EventCard, Multiverse, Path, Profile, SimEvent, WorldStats, WorldTemplate } from "./types";

export const LIVE_RUNS = 30; // 팀장 결정(2026-11-04). 50% 결과의 95% 구간이 ±18%p라 화면은 횟수로 보여 준다.

export type LiveEntries = Record<string, JudgeEntry>;
export const liveEntryKey = (worldId: string, run: number, month: number, eventId: string) => `${worldId}|${run}|${month}|${eventId}`;

export class LivePause extends Error {
  constructor(
    public world: WorldTemplate,
    public run: number,
    public event: EventCard,
    public ctx: LiveCtx,
  ) {
    super("판단이 필요해요");
  }
}

const FAILED: JudgeEntry = { probs: [], reasons: [], src: "fallback" };

// 삶 하나. 받은 판단으로 갈 수 있는 데까지 가고, 판단이 없는 큰 갈림길에서 LivePause를 던진다. ruleRest면 멈추지 않고 규칙 기울기로 고른다('AI 판단 실패' 표시).
export function liveLife(p: Profile, world: WorldTemplate, months: number, startYm: string, run: number, entries: LiveEntries, ruleRest = false): Path {
  const forks = new Set(judgeForks(world).map((e) => e.id));
  return simulatePath(p, world, months, startYm, seedFor(p, world.id, run), undefined, undefined, (event, ctx) => {
    if (!forks.has(event.id)) return null;
    const got = entries[liveEntryKey(world.id, run, ctx.month, event.id)];
    if (got) return got;
    if (ruleRest) return FAILED;
    throw new LivePause(world, run, event, ctx);
  });
}

// 이 입력의 실행을 가리키는 이름. 입력이 하나라도 바뀌면 처음부터. 판단 캐시·이야기 원문은 넣지 않는다.
export function liveRunKey(p: Profile, worldIds: string[], months: number, startYm: string) {
  const src = JSON.stringify([{ ...p, judges: undefined, storyRaw: undefined, checkinMail: undefined }, worldIds, months, startYm, LIVE_RUNS, JUDGE_PROMPT_VERSION]);
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface LiveGroup {
  label: string;
  runs: number[]; // 이 갈래로 간 삶 번호
}
export interface LiveSummary {
  n: number;
  hired: number;
  satisfied: number;
  stressedOut: number;
  typicalMonth: number | null;
  groups: LiveGroup[];
  ai: number; // AI가 판단한 갈림길 수
  rule: number; // 규칙으로 고른 큰 갈림길 수
  stats: WorldStats;
}

// 끝난 삶들 요약. 큰 갈림길 앞 두 개로 묶는다(세계선 나무는 1,000번 기준이라 30번에는 쓰지 않는다).
export function liveSummary(p: Profile, world: WorldTemplate, lives: { run: number; path: Path }[]): LiveSummary {
  const paths = lives.map((l) => l.path);
  const hired = paths.filter((x) => x.employedAt !== null);
  const months = hired.map((x) => x.employedAt!).toSorted((a, b) => a - b);
  const byKey = new Map<string, LiveGroup>();
  for (const { run, path } of lives) {
    const keys = path.signature.slice(0, 2);
    const id = keys.join(">");
    const g = byKey.get(id) ?? { label: keys.length ? keys.map((k) => keyLabel(world, k).label).join(" → ") : "큰 갈림길 없이 지나감", runs: [] };
    g.runs.push(run);
    byKey.set(id, g);
  }
  const forks = new Set(judgeForks(world).map((e) => e.id));
  const picks = paths.flatMap((x) => x.months).filter((m) => m.event && forks.has(m.event.id) && m.pick);
  const ai = picks.filter((m) => m.pick!.byAi).length;
  return {
    n: paths.length,
    hired: hired.length,
    satisfied: paths.filter(isSatisfied).length,
    stressedOut: paths.filter((x) => x.final.stress >= 65).length,
    typicalMonth: months.length ? months[Math.floor((months.length - 1) / 2)] : null,
    groups: [...byKey.values()].toSorted((a, b) => b.runs.length - a.runs.length),
    ai,
    rule: picks.length - ai,
    stats: statsOf(p, world, paths),
  };
}

// 끝난 실시간 판단을 세계선 지도·대화·리포트의 별도 칸으로 잇는다. 1,000번 통계와 섞지 않는다. 장면은 그 삶을 그대로 쓴다(/api/line은 규칙으로 다시 살아서 다른 인생이 된다).
export function liveMultiverse(p: Profile, world: WorldTemplate, months: number, startYm: string, lives: { run: number; path: Path }[]) {
  const paths = lives.map((l) => l.path);
  const base = multiverseOf(p, world, months, startYm, paths, 2);
  // 1,000번 세계선과 겹치지 않게 갈래 id에 live:를 붙인다(대화 저장 키에도 쓰인다)
  const mv: Multiverse = { ...base, live: true, lines: base.lines.map((l) => ({ ...l, id: `live:${l.id}` })) };
  const scenes: Record<string, SimEvent[]> = {};
  for (const line of mv.lines) {
    const path = paths.find((x) => x.seed === line.repSeed);
    if (path) scenes[line.id] = scenesOf(world, path, line.id, months, startYm, mv.stats);
  }
  return { mv, scenes };
}

// 규칙으로 끝까지 살 때 만나는 큰 갈림길 수. 환불 계산의 전체 수(AI로 살았을 때와 조금 다를 수 있다).
export function liveForkCount(p: Profile, world: WorldTemplate, months: number, startYm: string) {
  const forks = new Set(judgeForks(world).map((e) => e.id));
  let n = 0;
  for (let run = 0; run < LIVE_RUNS; run++) {
    n += liveLife(p, world, months, startYm, run, {}, true).months.filter((m) => m.event && forks.has(m.event.id)).length;
  }
  return n;
}

// AI가 판단하지 못한 몫만큼 돌려준다(내림). AI 호출 수에는 재요청이 섞여 있어 조금 적게 돌려줄 수 있다.
export function liveRefundTokens(cost: number, aiCalls: number, total: number) {
  if (cost <= 0 || total <= 0) return 0;
  return Math.floor(cost * Math.max(0, 1 - aiCalls / total));
}

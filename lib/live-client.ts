// 실시간 판단 모드의 실행 순서는 브라우저가 맡는다. 서버 함수 하나를 몇 분씩 돌리면 시간 제한에 걸려서, 갈림길마다 /api/judge를 짧게 부른다.
// 받은 판단은 답이 올 때마다 이 기기에 저장한다(lib/store.ts). 계정에는 안 올린다. 이야기 원문·근거 인용·판단 캐시는 보내지 않는다.
import { LIVE_RUNS, liveEntryKey, liveLife, LivePause, liveRunKey, type LiveEntries } from "./live";
import type { JudgeEntry } from "./judge";
import { store, type LiveRun } from "./store";
import { scrubStory } from "./story";
import type { Path, Profile, Selection } from "./types";
import { getWorld } from "./worlds";

const CONCURRENCY = { free: 1, paid: 6 }; // 무료 키 간격과 429 재시도는 서버가 맡는다(lib/llm.ts)

export async function keyTier(): Promise<"free" | "paid"> {
  try {
    const body = (await (await fetch("/api/status")).json()) as { tier?: string };
    return body.tier === "free" ? "free" : "paid";
  } catch {
    return "paid";
  }
}

export function loadRun(profile: Profile, sel: Selection): LiveRun {
  const key = liveRunKey(profile, sel.worldIds, sel.months, sel.startYm);
  const saved = store.getLive();
  return saved?.key === key ? saved : { key, entries: {}, ruleRest: false, charged: false };
}

export interface LiveLives {
  done: Record<string, { run: number; path: Path }[]>; // 진로별 끝난 삶
  doneCount: number;
  total: number;
  firstOpen: number | null; // 아직 안 끝난 첫 삶의 전체 번호(1부터)
}

// 저장된 판단으로 갈 수 있는 데까지 다시 산다. 진로마다 앞에서부터 이어서 끝난 삶만 돌려준다.
export function replayAll(profile: Profile, sel: Selection, run: LiveRun): LiveLives {
  const done: LiveLives["done"] = {};
  let doneCount = 0;
  let firstOpen: number | null = null;
  sel.worldIds.forEach((id, w) => {
    const world = getWorld(id);
    done[id] = [];
    for (let i = 0; i < LIVE_RUNS; i++) {
      try {
        done[id].push({ run: i, path: liveLife(profile, world, sel.months, sel.startYm, i, run.entries, run.ruleRest) });
        doneCount++;
      } catch (e) {
        if (!(e instanceof LivePause)) throw e;
        firstOpen ??= w * LIVE_RUNS + i + 1;
        break; // 앞에서부터 끝난 삶만 보여 준다(큰 갈림길이 없어 저절로 끝나는 뒤쪽 삶을 먼저 세지 않게)
      }
    }
  });
  return { done, doneCount, total: sel.worldIds.length * LIVE_RUNS, firstOpen };
}

export type LiveStop = "done" | "failed" | "aborted";

// 끝까지 돌리거나, AI가 답을 못 주면(한도·네트워크) 멈춘다. 멈춘 데까지는 저장돼 있어서 나중에 이어서 할 수 있다.
export async function runLive(profile: Profile, sel: Selection, start: LiveRun, opts: { signal: AbortSignal; tier: "free" | "paid"; onChange: (r: LiveRun) => void }): Promise<LiveStop> {
  const sendable = scrubStory({ ...profile, storyRaw: {}, judges: {} });
  const entries: LiveEntries = { ...start.entries };
  const snapshot = (): LiveRun => ({ ...start, entries });
  const tasks = sel.worldIds.flatMap((id) => Array.from({ length: LIVE_RUNS }, (_, i) => ({ world: getWorld(id), run: i })));
  let next = 0;
  let stop: LiveStop = "done";

  async function worker() {
    while (next < tasks.length && stop === "done") {
      const { world, run } = tasks[next++];
      for (;;) {
        if (opts.signal.aborted) {
          stop = "aborted";
          return;
        }
        let pause: LivePause;
        try {
          liveLife(profile, world, sel.months, sel.startYm, run, entries);
          break; // 이 삶은 끝
        } catch (e) {
          if (!(e instanceof LivePause)) throw e;
          pause = e;
        }
        try {
          const { ctx, event } = pause;
          const res = await fetch("/api/judge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: opts.signal,
            body: JSON.stringify({ profile: sendable, worldId: world.id, forkId: event.id, live: { month: ctx.month, status: ctx.status, bucket: ctx.bucket, state: ctx.state, recent: ctx.recent } }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as { entries: Record<string, JudgeEntry>; src: JudgeEntry["src"] };
          // 키가 없으면(mock) 규칙 기울기로 그대로 간다. AI 실패면 저장하지 않고 멈춘다(이어서 할 때 다시 묻는다).
          if (body.src === "fallback") throw new Error("AI 실패");
          entries[liveEntryKey(world.id, run, ctx.month, event.id)] = body.entries.now;
          const snap = snapshot();
          store.setLive(snap);
          opts.onChange(snap);
        } catch {
          if (opts.signal.aborted) stop = "aborted";
          else if (stop === "done") stop = "failed";
          return;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY[opts.tier], tasks.length) }, worker));
  return stop;
}

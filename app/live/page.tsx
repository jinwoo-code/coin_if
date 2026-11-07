"use client";
// 실시간 판단 모드: 삶을 하나씩 살면서 큰 갈림길마다 AI가 그때 상황으로 판단한다. 30번이라 확률이 아니라 횟수로 보여 준다.
// 끝난 삶부터 바로 보여 주고, 창을 닫았다 열면 이어서 한다. 숫자를 1,000번 결과와 나란히 놓지 않는다.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ci, Odds, Screen } from "@/components/ui";
import { durationLabel } from "@/lib/calendar";
import { keyTier, loadRun, replayAll, runLive, type LiveStop } from "@/lib/live-client";
import { LIVE_RUNS, liveMultiverse, liveSummary } from "@/lib/live";
import { gateLabel } from "@/lib/multiverse";
import { choiceLine, scenesOf } from "@/lib/scenes";
import { computeMultiverse } from "@/lib/levers-client";
import { store, type LiveResults, type LiveRun } from "@/lib/store";
import { scrubStory } from "@/lib/story";
import type { Path, Profile, Selection, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";
import { T } from "@/lib/copy";

const monthsText = (m: number | null) => (m === null ? "" : m < 12 ? `보통 ${m}개월 뒤` : `보통 ${Math.floor(m / 12)}년${m % 12 ? ` ${m % 12}개월` : ""} 뒤`);

function Life({ profile, sel, world, run, path, stats }: { profile: Profile; sel: Selection; world: WorldTemplate; run: number; path: Path; stats: ReturnType<typeof liveSummary>["stats"] }) {
  const scenes = useMemo(() => scenesOf(world, path, `live-${run}`, sel.months, sel.startYm, stats).filter((e) => e.eventId !== "quiet" && !e.routine), [world, path, run, sel, stats]);
  void profile;
  return (
    <ol className="mt-2 space-y-3 border-l-2 border-hair pl-3">
      {scenes.length === 0 ? <li className="text-sm text-muted">큰일 없이 지나갔어요.</li> : null}
      {scenes.map((e) => (
        <li key={`${e.station}-${e.eventId}`}>
          <p className="num text-cap text-muted">{e.label}</p>
          <p className="text-sm font-semibold">{e.title}</p>
          {e.choice ? <p className="text-sm">→ {e.choice}</p> : null}
          {e.odds ? <p className="mt-0.5 text-cap text-muted">{choiceLine(e)}</p> : null}
          {e.odds ? <Odds odds={e.odds} /> : null}
        </li>
      ))}
      <li className="num text-cap text-muted">
        끝날 때 {path.months.at(-1)?.status} · 만족도 {Math.round(path.final.satisfaction)} · 스트레스 {Math.round(path.final.stress)}
      </li>
    </ol>
  );
}

function WorldResult({ profile, sel, world, lives }: { profile: Profile; sel: Selection; world: WorldTemplate; lives: { run: number; path: Path }[] }) {
  const s = useMemo(() => liveSummary(profile, world, lives), [profile, world, lives]);
  const [open, setOpen] = useState<number | null>(null);
  if (!s.n) return null;
  const pct = (x: number) => (x / s.n) * 100;
  return (
    <section aria-label={`${world.short} 결과`} className="mt-6 rounded-2xl border border-hair bg-surface p-4">
      <h2 className="text-lg font-bold">{world.short}</h2>
      <p className="num mt-1 text-sm text-muted">
        {s.n === LIVE_RUNS ? `${LIVE_RUNS}번 다 살아봤어요.` : `지금까지 ${s.n}번 살아봤어요.`} AI 판단 {s.ai}번{s.rule ? `, 규칙 계산 ${s.rule}번` : ""}
      </p>
      <ul className="num mt-3 space-y-1 text-sm">
        <li>
          {durationLabel(sel.months)} 안에 {gateLabel(world)}:{" "}
          <b>
            {s.n}번 중 {s.hired}번
          </b>{" "}
          <Ci pct={pct(s.hired)} n={s.n} /> {monthsText(s.typicalMonth)}
        </li>
        <li>
          끝날 때 만족:{" "}
          <b>
            {s.n}번 중 {s.satisfied}번
          </b>{" "}
          <Ci pct={pct(s.satisfied)} n={s.n} />
        </li>
        <li>
          끝날 때 지침:{" "}
          <b>
            {s.n}번 중 {s.stressedOut}번
          </b>{" "}
          <Ci pct={pct(s.stressedOut)} n={s.n} />
        </li>
      </ul>
      <p className="mt-2 text-cap text-muted">괄호는 오차 범위예요. {LIVE_RUNS}번이라 범위가 넓어요. 모델 자체가 틀릴 가능성은 들어 있지 않아요.</p>
      <h3 className="mt-4 text-sm font-bold">어떤 갈래로 갔나요</h3>
      <ul className="mt-2 space-y-3">
        {s.groups.map((g) => (
          <li key={g.label}>
            <p className="num text-sm">
              {g.label} <span className="text-muted">· {g.runs.length}번</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {g.runs.map((r) => (
                <button
                  key={r}
                  aria-expanded={open === r}
                  aria-label={`${r + 1}번째 삶 ${open === r ? "접기" : "읽기"}`}
                  onClick={() => setOpen(open === r ? null : r)}
                  className={`num h-11 min-w-11 rounded-full border border-hair px-2 text-cap ${open === r ? "bg-ink font-bold text-white" : "text-muted hover:text-ink"}`}
                >
                  {r + 1}
                </button>
              ))}
            </div>
            {open !== null && g.runs.includes(open) ? <Life profile={profile} sel={sel} world={world} run={open} path={lives.find((l) => l.run === open)!.path} stats={s.stats} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LivePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [run, setRun] = useState<LiveRun | null>(null);
  const [state, setState] = useState<"running" | LiveStop | "denied">("running");
  const [message, setMessage] = useState("");
  const [linking, setLinking] = useState(false);
  const [tier, setTier] = useState<"free" | "paid">("paid");
  const abort = useRef<AbortController | null>(null);

  async function go(p: Profile, s: Selection, r: LiveRun) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState("running");
    setMessage("");
    let cur = r;
    const t = await keyTier();
    setTier(t);
    if (!cur.charged) {
      try {
        const res = await fetch("/api/live/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: cur.key }), signal: ctl.signal });
        if (res.status === 402) {
          router.push("/tokens?for=simulate");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setMessage(body.error ?? "시작하지 못했어요.");
          setState("denied");
          return;
        }
        cur = { ...cur, charged: true };
        store.setLive(cur);
        setRun(cur);
        window.dispatchEvent(new Event("cr:tokens"));
      } catch {
        if (ctl.signal.aborted) return;
        setState("failed");
        return;
      }
    }
    const stop = await runLive(p, s, cur, { signal: ctl.signal, tier: t, onChange: setRun });
    if (stop !== "aborted") setState(stop);
  }

  useEffect(() => {
    const p = store.getProfile();
    const s = store.getSelection();
    if (!p || !s) {
      router.replace(p ? "/choose" : "/interview");
      return;
    }
    const r = loadRun(p, s);
    setProfile(p);
    setSel(s);
    setRun(r);
    go(p, s, r);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lives = useMemo(() => (profile && sel && run ? replayAll(profile, sel, run) : null), [profile, sel, run]);

  function finishWithRules() {
    if (!profile || !sel || !run) return;
    const next = { ...run, ruleRest: true };
    store.setLive(next);
    setRun(next);
    setState("done");
    // AI가 판단하지 못한 몫의 토큰을 돌려준다(로그인 안 했거나 대학 계약이면 뺀 게 없어서 0)
    fetch("/api/live/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: run.key, profile: scrubStory({ ...profile, storyRaw: {}, judges: {} }), worldIds: sel.worldIds, months: sel.months, startYm: sel.startYm }),
    })
      .then((r) => r.json())
      .then((b: { refunded?: number }) => {
        if (!b.refunded) return;
        setMessage(`AI가 판단하지 못한 몫으로 토큰 ${b.refunded}개를 돌려줬어요.`);
        window.dispatchEvent(new Event("cr:tokens"));
      })
      .catch(() => undefined);
  }
  // 세계선 지도·리포트는 1,000번 결과를 읽고, 이 30개의 삶은 별도 칸으로 붙는다. 1,000번 결과가 없으면 이 기기에서 계산한다(토큰 없음).
  async function continueWith() {
    if (!profile || !sel || !lives || linking) return;
    setLinking(true);
    try {
      const saved = store.getMultiverses();
      const hasBasic = saved && sel.worldIds.every((id) => saved[id]?.months === sel.months && saved[id]?.startYm === sel.startYm);
      if (!hasBasic) {
        store.clearResults();
        const built = await Promise.all(sel.worldIds.map((id) => computeMultiverse(profile, id, sel.months, sel.startYm)));
        store.setMultiverses(Object.fromEntries(built.map((m) => [m.worldId, m])));
        // 본선 장면(대화·리포트가 읽는다). 실패해도 세계선 지도에서 다시 받는다.
        await Promise.all(
          built.map(async (m) => {
            const main = m.lines.find((l) => l.isMain);
            if (!main) return;
            store.setActive(m.worldId, main.id);
            const res = await fetch("/api/line", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, selection: { ...sel, mode: "basic" }, worldId: m.worldId, lineId: main.id }) }).catch(() => null);
            const data = (await res?.json().catch(() => null)) as { scenes?: SimEvent[] } | null;
            if (data?.scenes) store.setLine(m.worldId, main.id, data.scenes);
          }),
        );
      }
      const results: LiveResults = { mvs: {}, scenes: {}, active: {} };
      for (const id of sel.worldIds) {
        const { mv, scenes } = liveMultiverse(profile, getWorld(id), sel.months, sel.startYm, lives.done[id] ?? []);
        results.mvs[id] = mv;
        results.scenes[id] = scenes;
      }
      store.setLiveResults(results);
      router.push(`/multiverse?world=${sel.worldIds[0]}`);
    } finally {
      setLinking(false);
    }
  }
  function basicMode() {
    if (!sel) return;
    store.setSelection({ ...sel, mode: "basic" });
    router.push("/simulate");
  }

  if (!profile || !sel || !run || !lives)
    return (
      <Screen title={T.liveMode} back="/choose">
        {null}
      </Screen>
    );
  const finished = lives.doneCount === lives.total;
  const start = `${sel.startYm.slice(0, 4)}년 ${Number(sel.startYm.slice(5))}월`;

  return (
    <Screen
      title={T.liveMode}
      back="/choose"
      footer={
        <div className="flex flex-col gap-2">
          {finished ? (
            <button className="btn-primary w-full" onClick={continueWith} disabled={linking}>
              {linking ? "1,000번 결과와 같이 준비하는 중…" : `${T.lineMap}·대화·리포트에서 이어 보기`}
            </button>
          ) : null}
          <button className="btn-secondary w-full" onClick={basicMode}>
            기본 모드로 1,000번 살아보기
          </button>
        </div>
      }
    >
      <p className="mt-2 text-sm text-muted">
        큰 갈림길마다 AI가 그때 상황을 보고 직접 판단해요. 진로마다 {LIVE_RUNS}번, {start}부터 {durationLabel(sel.months)} 살아요.
      </p>

      <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-hair bg-surface p-4">
        {finished ? (
          <p className="num font-bold">다 살아봤어요. 다시 열어도 같은 인생이 나와요.</p>
        ) : state === "running" ? (
          <p className="num font-bold">지금 {lives.firstOpen ?? lives.doneCount + 1}번째 삶을 사는 중이에요</p>
        ) : (
          <p className="num font-bold">{lives.doneCount}번째 삶까지 살고 멈췄어요</p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-hair" aria-hidden="true">
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(lives.doneCount / lives.total) * 100}%` }} />
        </div>
        <p className="num mt-2 text-cap text-muted">
          {lives.doneCount}/{lives.total}번 끝 · 창을 닫아도 여기까지 저장돼요
        </p>
        {tier === "free" && !finished ? <p className="mt-2 text-cap text-muted">무료 키라 오래 걸리고 한도에 걸릴 수 있어요.</p> : null}
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
        {finished ? <p className="mt-2 text-cap text-muted">{T.lineMap}·리포트에는 1,000번 통계와 따로 'AI가 직접 살아 본 30개의 삶' 칸으로 나와요.</p> : null}
        {state === "failed" && !finished ? (
          <div className="mt-3">
            <p className="text-sm">AI가 답을 못 줬어요. 한도에 걸렸을 수 있어요. 나중에 이어서 할 수 있어요.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => go(profile, sel, run)}>
                이어서 하기
              </button>
              <button className="btn-secondary" onClick={finishWithRules}>
                남은 건 규칙 계산으로 끝내기
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {sel.worldIds.map((id) => (
        <WorldResult key={id} profile={profile} sel={sel} world={getWorld(id)} lives={lives.done[id] ?? []} />
      ))}
      <p className="mt-4 text-cap text-muted">이 결과를 기본 모드의 1,000번 숫자와 바로 비교하지 마세요. 횟수가 달라 차이가 나도 우연일 수 있어요.</p>
    </Screen>
  );
}

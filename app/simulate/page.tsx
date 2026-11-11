"use client";
// 3. 체험: 진로마다 1,000번 살아 보고, AI가 먼저 간 '본선'을 노선도 타임라인으로 보여 준다.
import { DemoGuide } from "@/components/demo-guide";
import { MascotFace } from "@/components/mascot";
import { SpecNotice, specMissing } from "@/components/spec-notice";
import { BarChart3, ChevronDown, CornerDownRight, GitBranch, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { textColor } from "@/lib/color";
import { showsOutcome } from "@/components/outcome-split";
import { Buddy, Ci, freqWord, LineBadge, MockNotice, Narration, Odds, repeatedInYear, RouteProgress, Screen, STATE_META, won } from "@/components/ui";
import { times } from "@/lib/ci";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { CorrectChoice } from "@/components/correct";
import { missingJudges } from "@/lib/judge";
import { prefetchJudges } from "@/lib/judge-client";
import { choiceLine } from "@/lib/scenes";
import { store } from "@/lib/store";
import type { LifeState, LineNode, Multiverse, Profile, Selection, SimEvent, WorldStats, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";
import { iGa } from "@/lib/josa";
import { T, plain } from "@/lib/copy";

interface Row {
  station: number;
  label: string;
  events: SimEvent[];
}

// 상태 변화 중 큰 것 두 개만 보여 준다. 스트레스는 오르면 나쁜 변화다.
function DeltaChips({ delta }: { delta: Partial<LifeState> }) {
  const items = STATE_META.filter((m) => m.key !== "money")
    .map((m) => ({ ...m, v: Math.round(delta[m.key] ?? 0) }))
    .filter((x) => Math.abs(x.v) >= 2)
    .toSorted((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 2);
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.map((x) => {
        const good = x.key === "stress" ? x.v < 0 : x.v > 0;
        return (
          <span key={x.key} className={`num rounded-md px-1.5 py-0.5 text-cap font-semibold ${good ? "bg-[#E7F6EF] text-[#0B6B4B]" : "bg-[#FDECE7] text-[#A3311A]"}`}>
            {x.label} {x.v > 0 ? `+${x.v}` : x.v}
          </span>
        );
      })}
    </div>
  );
}

// 본선 경로에서 이 장면의 갈림길 마디를 찾는다.
function forkAt(mv: Multiverse, ev: SimEvent): { node: LineNode; parent: LineNode } | null {
  if (!ev.branch && !ev.tierLabel) return null;
  const main = mv.lines.find((l) => l.isMain);
  if (!main) return null;
  let parent = mv.tree;
  for (const id of main.path.slice(1)) {
    const node = parent.children.find((c) => c.id === id);
    if (!node) break;
    if (node.key.split(/[:@]/)[0] === ev.eventId) return { node, parent };
    parent = node;
  }
  return null;
}

function ForkNote({ mv, ev, world }: { mv: Multiverse; ev: SimEvent; world: WorldTemplate }) {
  const fork = forkAt(mv, ev);
  if (!fork) return null;
  const others = fork.parent.count - fork.node.count;
  if (others <= 0) return null;
  return (
    <Link href={`/multiverse?world=${world.id}`} className="mt-2.5 flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-cap font-medium transition-colors hover:brightness-95" style={{ background: `${world.color}14` }}>
      <GitBranch aria-hidden="true" size={14} className="mt-0.5 flex-none" style={{ color: world.color }} />
      <span>
        갈림길 · {ev.branch === "choice" ? "내 선택" : "운"}으로 갈림
        <span className="block font-normal text-muted">
          여기서 {times(fork.parent.count)}번 중 {times(others)}번은 다른 길로 갔어요
        </span>
      </span>
    </Link>
  );
}

function EventCard({ ev, world, current, mv, animate, repeated }: { ev: SimEvent; world: WorldTemplate; current: boolean; mv: Multiverse; animate: boolean; repeated: boolean }) {
  const quiet = ev.eventId === "quiet";
  // 큰 갈림길(내 선택으로 갈리는 곳, 또는 보기 3개 이상)은 고치기 버튼을 접지 않고 선택 바로 아래에 둔다.
  const bigFork = ev.branch === "choice" || (world.events.find((e) => e.id === ev.eventId)?.choices.length ?? 0) >= 3;
  const pct = Math.round((ev.freq / mv.stats.runs) * 100);
  const hasDetail = !quiet || ev.minor.length > 0 || Boolean(ev.evidence);
  return (
    <article
      className={`${animate ? "animate-rise" : ""} rounded-2xl border p-3 sm:p-3.5 ${quiet ? "bg-transparent" : "bg-surface"}`}
      style={{ borderColor: current ? world.color : "#E3E6EB", boxShadow: current ? `0 0 0 1px ${world.color}` : undefined, borderStyle: quiet ? "dashed" : "solid" }}
    >
      <p className="num mb-1 text-cap font-semibold text-muted">{ev.label}</p>
      <p className="mb-1.5 text-cap font-semibold" style={{ color: textColor(world.color) }}>
        {/* 장면의 큰 사건이 난 달의 처지. 역 끝 처지를 쓰면 '병원 2개월차'에 '자리를 못 잡았다'가 같이 보인다 */}
        {ev.eventStatus ?? ev.status}
      </p>
      <h3 className={`text-[15px] font-bold leading-snug ${quiet ? "text-muted" : ""}`}>{ev.title}</h3>
      <Narration ev={ev} repeated={repeated} className="mt-1.5 text-sm text-muted" />
      {ev.choice ? (
        <p className="mt-2 flex gap-1.5 text-sm font-medium">
          <CornerDownRight aria-hidden="true" size={16} className="mt-[3px] flex-none" style={{ color: world.color }} />
          <span>
            <span className="sr-only">나의 선택: </span>
            {ev.choice}
          </span>
        </p>
      ) : null}
      {bigFork ? <CorrectChoice ev={ev} world={world} /> : null}
      {hasDetail ? (
        <details className="group/detail mt-1" data-testid="event-detail">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-cap font-semibold text-muted [&::-webkit-details-marker]:hidden">
            자세히 <ChevronDown aria-hidden="true" size={14} className="transition-transform group-open/detail:rotate-180" />
          </summary>
          {!quiet && !ev.routine ? (
            <p className="num text-cap text-muted">
              {freqWord(pct)} · {times(mv.stats.runs)}번 중 {times(ev.freq)}번
            </p>
          ) : null}
          {choiceLine(ev) ? <p className="mt-1 text-cap text-muted">{choiceLine(ev)}</p> : null}
          {ev.choice && ev.odds ? <Odds odds={ev.odds} /> : null}
          {bigFork ? null : <CorrectChoice ev={ev} world={world} />}
          <DeltaChips delta={ev.delta} />
          {ev.reactions?.length ? (
            <ul className="mt-2 space-y-1 text-cap text-muted">
              {ev.reactions.map((r) => (
                <li key={r.name}>
                  <b className="font-semibold">{r.name}</b> &quot;{r.line}&quot;
                </li>
              ))}
            </ul>
          ) : null}
          {ev.minor.length ? <p className="mt-2 text-cap text-muted">그 밖에: {ev.minor.join(", ")}</p> : null}
          <ForkNote mv={mv} ev={ev} world={world} />
          {ev.evidence ? (
            <p className="mt-2.5 flex gap-1.5 border-t border-hair pt-2.5 text-cap text-muted">
              <BarChart3 aria-hidden="true" size={14} className="mt-0.5 flex-none" />
              <span>
                근거: {plain(ev.evidence.label)} ({plain(ev.evidence.source)})
              </span>
            </p>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

// 그해의 큰 사건: 합격·입사(등급 있는 관문) > 갈림길 > 상태가 크게 움직인 일. 접힌 줄에는 이 중 둘만, 일어난 순서대로 보여 준다.
// 합격처럼 되풀이되는(routine) 관문도 큰 일이라 routine만으로 빼지 않는다. 15는 표시를 고르는 데만 쓰는 기준이다.
function bigEvents(events: SimEvent[]) {
  const swing = (e: SimEvent) => Math.max(0, ...STATE_META.filter((m) => m.key !== "money").map((m) => Math.abs(e.delta[m.key] ?? 0)));
  const score = (e: SimEvent) => (e.tierLabel ? 400 : 0) + (e.branch ? 300 : 0) + swing(e);
  return events
    .filter((e) => e.eventId !== "quiet" && (!e.routine || e.branch || e.tierLabel || swing(e) >= 15))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => score(b.e) - score(a.e))
    .slice(0, 2)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.e);
}

// 맨 위 한 줄 결론: 진로 2개 이상을 1,000번 통계로 견준다(아래 '한눈에 비교' 표와 같은 값).
function Verdict({ ids, mvs, months }: { ids: string[]; mvs: Record<string, Multiverse>; months: number }) {
  const ws = ids.filter((id) => mvs[id]).map((id) => ({ w: getWorld(id), st: mvs[id].stats }));
  if (ws.length < 2) return null;
  const g = (x: (typeof ws)[number]) => x.st.gate?.share ?? 0;
  const byGate = ws.toSorted((a, b) => g(b) - g(a));
  const bySat = ws.toSorted((a, b) => b.st.satisfiedShare - a.st.satisfiedShare);
  const gateTie = g(byGate[0]) === g(byGate[1]);
  const satTie = bySat[0].st.satisfiedShare === bySat[1].st.satisfiedShare;
  const gateText = gateTie ? "자리 잡는 비율은 비슷하고" : `자리 잡는 비율은 ${iGa(byGate[0].w.short)} 가장 높고(${byGate[0].st.gate?.label} ${g(byGate[0])}%)`;
  const satText = satTie ? "만족하며 끝난 비율도 비슷해요." : !gateTie && bySat[0].w.id === byGate[0].w.id ? `만족하며 끝난 비율도 가장 높아요(${bySat[0].st.satisfiedShare}%).` : `만족하며 끝난 비율은 ${iGa(bySat[0].w.short)} 가장 높아요(${bySat[0].st.satisfiedShare}%).`;
  return (
    <p className="mt-2 font-semibold">
      한 줄로: {durationLabel(months)} 안에 {gateText}, {satText}
    </p>
  );
}

// 맨 위 요약: 전부 지금 보는 가장 흔한 길의 값이다(시기 포함). 1,000번 값은 아래 '한눈에 비교' 표에 모은다.
// 예전에 저장한 장면(jobSince 없음)만 시기를 1,000번 값으로 보여 주고 그렇게 적는다.
function SummaryCard({ world, ev, mv, done, scenes }: { world: WorldTemplate; ev: SimEvent | undefined; mv: Multiverse | undefined; done: boolean; scenes: SimEvent[] }) {
  const gate = mv?.stats.gate;
  const legacy = scenes.some((s) => /개월차$/.test(s.status) && s.jobSince === undefined);
  const hired = scenes.map((s) => s.jobSince).filter((m): m is number => typeof m === "number");
  const first = hired.length ? Math.min(...hired) : null;
  const when = legacy
    ? gate?.typicalMonth !== null && gate?.typicalMonth !== undefined && mv
      ? monthLabel(mv.startYm, gate.typicalMonth)
      : "기간 안에 드물어요"
    : first !== null && mv
      ? monthLabel(mv.startYm, first)
      : done
        ? "기간 안에 못 했어요"
        : "아직이에요";
  return (
    <section aria-label={`${world.name} 요약`} className="card p-3.5 sm:p-4" data-testid="sim-summary">
      <div className="mb-1 flex items-center gap-2">
        <LineBadge world={world} size={22} />
        <h2 className="min-w-0 text-lg font-bold">{world.name}</h2>
      </div>
      <p className="mb-4 text-sm text-muted">{ev ? (done ? `끝날 때: ${ev.status}` : ev.status) : "출발 전"}</p>
      {ev ? (
        <p className="mb-2 text-cap text-muted" data-testid="summary-basis">
          {T.basisMain}
          {mv ? <span className="num"> · {times(mv.stats.runs)}번 중 {times(mv.lines.find((l) => l.isMain)?.count ?? 0)}번이 이 길로 갔어요</span> : null}
        </p>
      ) : null}
      {ev ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="min-w-0 rounded-xl bg-ground p-3 sm:p-4">
              <dt className="text-sm font-medium text-muted">{gate?.label ?? "합격·취업"} 시기</dt>
              <dd className="num mt-1 break-keep text-lg font-extrabold">{when}</dd>
              {legacy ? <dd className="num mt-0.5 text-cap text-muted">{T.basisAll(times(mv?.stats.runs ?? 1000))}</dd> : null}
            </div>
            <div className="min-w-0 rounded-xl bg-ground p-3 sm:p-4">
              <dt className="text-sm font-medium text-muted">이 삶의 만족도</dt>
              <dd className="num mt-1 text-lg font-extrabold">
                {ev.state.satisfaction}점
                <span className="ml-1 text-sm font-normal text-muted">/ 100점</span>
              </dd>
            </div>
            <div className="min-w-0 rounded-xl bg-ground p-3 sm:p-4">
              <dt className="text-sm font-medium text-muted">모은 돈</dt>
              <dd className="num mt-1 break-words text-lg font-extrabold">{won(ev.state.money)}</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-ground p-3 sm:p-4">
              <dt className="text-sm font-medium text-muted">연봉</dt>
              <dd className="num mt-1 break-words text-lg font-extrabold">{ev.salary ? won(ev.salary) : "아직 없어요"}</dd>
            </div>
          </dl>
          <details className="mt-2 text-cap text-muted">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">자세히</summary>
            <p className="num">
              스트레스 {ev.state.stress} / 100 · 역량 {ev.state.skill} / 100
            </p>
            <p className="mt-1">위 숫자는 모두 지금 보는 {T.mainLine} 한 번의 값이에요. 만족도는 끝날 때 점수(0~100)이고, {times(mv?.stats.runs ?? 1000)}번 중 만족하며 끝난 비율(%)은 아래 &apos;진로를 한눈에 비교해요&apos; 표에 있어요.</p>
          </details>
        </>
      ) : null}
    </section>
  );
}

// 시험형 칸: 합격자 중 만족을 크게, 준비 중·다른 길은 작게(전부 끝 상태 비율)
function OutcomeCell({ st }: { st: WorldStats }) {
  const o = st.outcome!;
  return (
    <span className="flex flex-col gap-0.5">
      <span>합격 {o.gate.share}%</span>
      <span className="text-cap font-medium text-muted">
        합격자 중 만족 {o.gate.satisfied}% · 준비 중 {o.preparing.share}% · 다른 길 {o.switched.share}%
      </span>
    </span>
  );
}

// 진로를 하나씩 본 뒤 한눈에 비교한다. 숫자는 전부 엔진 값이고, 진로가 하나면 안 그린다.
// 휴대폰에서 항목 이름이 좁은 왼쪽 칸에서 줄바꿈되지 않게, 항목 이름을 값 위 한 줄에 둔다(표 역할은 ARIA로 유지).
function CompareAll({ worlds, mvs, onPick }: { worlds: WorldTemplate[]; mvs: Record<string, Multiverse>; onPick: (id: string) => void }) {
  const list = worlds.filter((w) => mvs[w.id]);
  if (list.length < 2) return null;
  const runs = times(mvs[list[0].id].stats.runs);
  const exam = list.some((w) => showsOutcome(w, mvs[w.id].stats));
  const rows: { label: string; note?: string; value: (mv: Multiverse) => React.ReactNode }[] = [
    { label: "합격·취업", value: (mv) => `${mv.stats.gate?.share ?? 0}%` },
    { label: "만족하며 끝난 비율", note: exam ? "시험형은 끝날 때 상태로 나눠요" : undefined, value: (mv) => (showsOutcome(list.find((w) => w.id === mv.worldId)!, mv.stats) ? <OutcomeCell st={mv.stats} /> : `${mv.stats.satisfiedShare}%`) },
    { label: "스트레스 높게 끝남", value: (mv) => `${mv.stats.stressedShare}%` },
    { label: "모은 돈", note: T.basisAll(runs), value: (mv) => won(mv.stats.final.money.p50) },
    { label: "가장 흔한 길 비율", value: (mv) => `${Math.round(((mv.lines.find((l) => l.isMain)?.count ?? 0) / mv.stats.runs) * 100)}%` },
    { label: `갈라진 ${T.line}`, value: (mv) => `${mv.lines.length}개` },
  ];
  const cols = { gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` };
  return (
    <section className="card mt-6 p-4 sm:p-6" aria-labelledby="compare-all" data-testid="compare-all">
      <h2 id="compare-all" className="text-lg font-bold">
        진로를 한눈에 비교해요
      </h2>
      <p className="mt-1 text-sm text-muted">진로마다 {runs}번 살아본 결과예요. 이름을 누르면 그 진로를 봐요.</p>
      <div role="table" aria-labelledby="compare-all" className="num mt-4">
        <div role="rowgroup">
          <div role="row" className="grid gap-x-3 pb-2" style={cols}>
            {list.map((w) => (
              <div key={w.id} role="columnheader" className="min-w-0">
                <button type="button" onClick={() => onPick(w.id)} className="flex min-h-11 w-full items-center gap-2 text-left font-bold underline-offset-4 hover:underline">
                  <LineBadge world={w} size={24} />
                  <span className="min-w-0 break-keep">{w.short}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((r) => (
            <div key={r.label} role="row" className="grid gap-x-3 border-t border-hair py-3" style={cols}>
              <div role="rowheader" className="col-span-full mb-1 text-cap font-medium text-muted">
                {r.label}
                {r.note ? <span className="font-normal"> · {r.note}</span> : null}
              </div>
              {list.map((w) => (
                <div key={w.id} role="cell" className="min-w-0 break-words text-lg font-bold">
                  {r.value(mvs[w.id])}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <details className="mt-2 text-cap text-muted" data-testid="compare-basis">
        <summary className="min-h-11 cursor-pointer py-2">숫자 기준 · {T.assumed} 포함</summary>
        <p>{T.basisAll(runs)}과 비율이에요. 위 요약 카드는 {T.basisMain}이라 다를 수 있어요.</p>
        <p className="mt-1">합격·취업의 뜻은 진로마다 달라요. 확률 배수 대부분은 {T.assumedFull}이라 예측이 아니라 비교용이에요.</p>
      </details>
    </section>
  );
}

function rowsOf(lines: Record<string, SimEvent[]>, labels: string[]): Row[] {
  return labels.map((label, station) => ({ station, label, events: Object.values(lines).flatMap((evs) => evs.filter((e) => e.station === station)) }));
}

export default function SimulatePage() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldTemplate[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  // 저장된 결과로 돌아오면 등장 효과 없이 타임라인 전체를 바로 보여 준다.
  const [animateTimeline, setAnimateTimeline] = useState(false);
  const [mvs, setMvs] = useState<Record<string, Multiverse>>({});
  const [error, setError] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [judging, setJudging] = useState<{ done: number; total: number } | null>(null);
  const [noSpec, setNoSpec] = useState(false);
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const profile = store.getProfile();
    const sel = store.getSelection();
    setNoSpec(specMissing(profile));
    if (!profile || !sel) {
      router.replace("/choose");
      return;
    }
    setSelection(sel);
    setWorlds(sel.worldIds.map(getWorld));
    const savedMv = store.getMultiverses();
    const lines = store.getLines();
    // 세계선 지도에서 다른 세계선을 열면 active가 바뀐다. 이 화면은 늘 본선을 복원한다.
    // 갈림길이 없는 본선의 id는 빈 문자열이라 참거짓으로 보면 저장된 결과를 버리고 다시 돈다.
    const mainIds = Object.fromEntries(sel.worldIds.map((id) => [id, savedMv?.[id]?.lines.find((l) => l.isMain)?.id]));
    const saved = savedMv && sel.worldIds.every((id) => mainIds[id] !== undefined && Boolean(lines[id]?.[mainIds[id]!]?.length));
    if (saved) {
      const shown = Object.fromEntries(sel.worldIds.map((id) => [id, lines[id][mainIds[id]!]]));
      const labels = Array.from(
        new Set(
          Object.values(shown)
            .flat()
            .map((e) => e.label),
        ),
      );
      setMvs(savedMv);
      setRows(rowsOf(shown, labels));
      setTotal(labels.length);
      setDone(true);
    } else run(profile, sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rows.length > 0 && !done) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length, done]);

  async function run(start: Profile, sel: Selection) {
    setAnimateTimeline(true);
    setError("");
    setRows([]);
    setDone(false);
    let profile = start;
    // 큰 갈림길마다 AI 분신 판단을 먼저 받는다(이미 받은 건 다시 안 물음). 실패한 갈림길은 엔진이 규칙 기울기로 고른다.
    const ws = sel.worldIds.map(getWorld);
    if (missingJudges(profile, ws).length) {
      const r = await prefetchJudges(profile, ws, (d, t) => setJudging({ done: d, total: t }));
      console.info("[분신 판단]", r.report.map((x) => `${x.worldId} ${x.calls}회(AI ${x.ai}) ${(x.ms / 1000).toFixed(1)}초`).join(", "));
      profile = r.profile;
      if (profile !== start) store.setProfile(profile);
      setJudging(null);
    }
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, selection: sel }),
      });
      if (res.status === 402) {
        router.push("/tokens?for=simulate");
        return;
      }
      if (!res.ok || !res.body) throw new Error(`${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let ended = false; // '끝'(done)이나 '오류'(error) 신호를 받았는지
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "plan") {
            setTotal(msg.labels.length);
            const map = Object.fromEntries((msg.multiverses as Multiverse[]).map((m) => [m.worldId, m]));
            setMvs(map);
            store.setMultiverses(map);
            window.dispatchEvent(new Event("cr:tokens")); // 토큰 칩 다시 읽기
          }
          if (msg.type === "step") setRows((r) => [...r, { station: msg.station, label: msg.label, events: msg.events }]);
          if (msg.type === "done") {
            const lines = msg.lines as Record<string, SimEvent[]>;
            for (const [wid, evs] of Object.entries(lines)) {
              store.setLine(wid, evs[0]?.lineId ?? "", evs);
              store.setActive(wid, evs[0]?.lineId ?? "");
            }
            store.setReport(null);
            setAnimateTimeline(false);
            setDone(true);
            ended = true;
          }
          if (msg.type === "error") {
            setError(msg.message);
            ended = true;
          }
        }
      }
      // 서버가 신호 없이 응답을 닫으면(함수 시간 제한 등) '살아보는 중'에 갇히지 않게 실패로 본다.
      if (!ended) throw new Error("stream ended early");
    } catch {
      setError("서버와 연결이 끊겼어요. 다시 살아보기를 눌러 주세요.");
    }
  }

  function rerun() {
    const profile = store.getProfile();
    const sel = store.getSelection();
    if (!profile || !sel) return;
    store.clearResults();
    run(profile, sel);
  }

  const current = rows.at(-1);
  // 서버가 실패하면 멈춘 상태: 다시 살아보기를 누를 수 있어야 한다(안 그러면 뒤로 가기밖에 없다).
  const stopped = Boolean(error) && !done;
  const years = rows.reduce<{ year: string; rows: Row[] }[]>((acc, r) => {
    const year = r.label.match(/\d+년/)?.[0] ?? r.label;
    const last = acc.at(-1);
    if (last?.year === year) last.rows.push(r);
    else acc.push({ year, rows: [r] });
    return acc;
  }, []);
  const selectedWorld = worlds.find((w) => w.id === selectedWorldId) ?? worlds[0];
  const visibleWorlds = selectedWorld ? [selectedWorld] : [];
  function pickWorld(id: string) {
    setSelectedWorldId(id);
    document.getElementById("world-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const latest = (wid: string) =>
    rows
      .flatMap((r) => r.events)
      .filter((e) => e.worldId === wid)
      .at(-1);

  return (
    <Screen
      wide
      title={done ? `${T.mainLine}을 다 살아봤어요` : stopped ? "살아보다 멈췄어요" : "살아보는 중"}
      back="/choose"
      right={
        <span aria-live="polite" className="num pr-2 text-sm font-bold">
          {/* 진행 표시: 살아보는 중에만. 끝난 뒤 마지막 칸(예: 2029년 9~11월)이 남으면 보고 있는 장면의 날짜처럼 보인다 */}
          {stopped || done ? "" : current ? current.label : "출발 준비 중…"}
        </span>
      }
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-none px-4" onClick={rerun} disabled={!done && !stopped} aria-label="다시 살아보기">
            <RotateCcw aria-hidden="true" size={18} />
            <span className="hidden sm:inline">다시 살아보기</span>
          </button>
          {done ? (
            <Link href={`/multiverse?world=${selectedWorld?.id ?? ""}`} className="btn-primary flex-1">
              <GitBranch aria-hidden="true" size={18} /> 다른 {T.line} 보기
            </Link>
          ) : stopped ? (
            <button className="btn-primary flex-1" onClick={rerun}>
              <RotateCcw aria-hidden="true" size={18} /> 다시 살아보기
            </button>
          ) : (
            <button className="btn-primary flex-1" disabled>
              살아보는 중…
            </button>
          )}
        </div>
      }
    >
      <MockNotice />
      <DemoGuide />
      {Object.keys(mvs).length > 0 && selection ? (
        <div className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_#E3E6EB]">
          <p>
            {monthLabel(selection.startYm, 0)}부터 {durationLabel(selection.months)}을 진로마다 <strong>내 조건과 성향으로 {times(Object.values(mvs)[0]?.stats.runs ?? 1000)}번</strong> 살아봤어요.
          </p>
          <Verdict ids={selection.worldIds} mvs={mvs} months={selection.months} />
        </div>
      ) : null}

      {worlds.length > 1 ? (
        <section className="mt-5" aria-labelledby="world-picker">
          <h2 id="world-picker" className="scroll-mt-20 text-base font-bold">
            살펴볼 진로를 선택하세요
          </h2>
          <div role="group" aria-labelledby="world-picker" className="mt-3 flex flex-wrap gap-2">
            {worlds.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={selectedWorld?.id === w.id}
                aria-controls="selected-world-content"
                onClick={() => setSelectedWorldId(w.id)}
                className="flex min-h-12 min-w-0 max-w-full items-center gap-2 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold sm:text-base"
                style={{ borderColor: selectedWorld?.id === w.id ? w.color : "#E3E6EB", background: selectedWorld?.id === w.id ? `${w.color}12` : "#FFFFFF" }}
              >
                <LineBadge world={w} size={24} />
                <span className="min-w-0">{w.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div id="selected-world-content" role="region" aria-label={selectedWorld ? `${selectedWorld.name} ${T.mainLine} 결과` : `${T.mainLine} 결과`} className="min-w-0">
        {noSpec ? <div className="mt-3"><SpecNotice /></div> : null}
        <div className="mt-3">{selectedWorld ? <SummaryCard world={selectedWorld} ev={latest(selectedWorld.id)} mv={mvs[selectedWorld.id]} done={done} scenes={rows.flatMap((r) => r.events).filter((e) => e.worldId === selectedWorld.id)} /> : null}</div>
      </div>

      {judging ? (
        <div className="mt-5" aria-live="polite">
          <Buddy size={56} chatter={[`큰 갈림길 ${judging.done}/${judging.total}곳 판단했어요!`, "나라면 어떻게 할지 고민 중…", "조금만요, 거의 다 왔어요."]} />
          <RouteProgress total={Math.max(1, judging.total)} current={judging.done} label="분신 판단 진행" />
          <p className="num mt-2 text-cap text-muted">
            분신이 큰 갈림길에서 나라면 어떻게 할지 판단하는 중이에요 ({judging.done}/{judging.total})
          </p>
          <p className="mt-1 text-cap text-muted">갈림길 하나에 몇 초씩 걸려요. 이 화면을 닫지 말고 기다려 주세요.</p>
        </div>
      ) : null}

      {total > 0 ? (
        <div className="mt-5">
          <RouteProgress total={total} current={done ? total : rows.length} label="시뮬레이션 진행" />
        </div>
      ) : null}

      {/* 노선도 타임라인: 연도별로 접고, 접혀 있어도 그해의 큰 사건은 보인다. 살아보는 중에는 지금 해만 펼친다. */}
      <div className="mt-6 min-w-0">
        <ol className="flex min-w-0 flex-col">
          {years.map((y, yi) => {
            const w = selectedWorld;
            if (!w) return null;
            const events = y.rows.flatMap((r) => r.events.filter((e) => e.worldId === w.id));
            const big = bigEvents(events);
            const live = !done && yi === years.length - 1;
            return (
              <li key={y.year} className="relative min-w-0 pb-3 pl-6 sm:pl-7">
                <span aria-hidden="true" className={`absolute bottom-0 left-[9px] top-0 w-1 origin-top rounded-full ${animateTimeline && live ? "animate-draw" : ""}`} style={{ background: w.color }} />
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-3 h-[22px] w-[22px] rounded-full border-[4px]"
                  style={{ borderColor: w.color, background: live || events.some((e) => e.branch) ? w.color : "#fff", boxShadow: live ? `0 0 0 5px ${w.color}26` : undefined }}
                />
                <details open={live} className="group rounded-2xl border border-hair bg-surface" data-testid="year">
                  <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-2 rounded-2xl p-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="num block text-base font-bold">{y.year}</span>
                      {big.length ? (
                        big.map((e) => (
                          <span key={e.station + e.eventId} className="mt-0.5 block text-sm">
                            {e.title}
                          </span>
                        ))
                      ) : (
                        <span className="mt-0.5 block text-sm text-muted">큰 일 없이 지나갔어요</span>
                      )}
                    </span>
                    <ChevronDown aria-hidden="true" size={18} className="mt-1 flex-none text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-2 px-2 pb-2 sm:px-3 sm:pb-3">
                    {(() => {
                      const rep = repeatedInYear(y.rows.flatMap((r) => r.events.filter((e) => e.worldId === w.id)));
                      return y.rows.map((row) => {
                      const ev = row.events.find((e) => e.worldId === w.id);
                      const isCurrent = !done && row === rows.at(-1);
                      return ev && mvs[w.id] ? <EventCard key={row.station} ev={ev} world={w} current={isCurrent} mv={mvs[w.id]} animate={animateTimeline && isCurrent} repeated={rep.has(ev.station)} /> : null;
                      });
                    })()}
                  </div>
                </details>
              </li>
            );
          })}

          {done ? (
            <li className="min-w-0">
              {visibleWorlds.map((w) => {
                const mv = mvs[w.id];
                const main = mv?.lines.find((l) => l.isMain);
                return (
                  <div key={w.id} className="relative min-w-0 pl-7">
                    <span aria-hidden="true" className="absolute left-[9px] top-0 h-3 w-1 rounded-full" style={{ background: w.color }} />
                    <span aria-hidden="true" className="absolute left-[-3px] top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: w.color }}>
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    </span>
                    {mv && main ? (
                      <section className="rounded-2xl p-3.5 sm:p-4" style={{ background: `${w.color}12` }}>
                        <h3 className="text-sm font-bold">
                          {times(mv.stats.runs)}번 중 이 길로 온 건 {times(main.count)}번
                        </h3>
                        <p className="mt-1 text-sm">{main.title}</p>
                        <p className="num mt-2 text-cap text-muted">
                          {times(mv.stats.runs)}번 전체로 보면 {mv.stats.gate?.label} {mv.stats.gate?.share}% <Ci pct={mv.stats.gate?.share ?? 0} n={mv.stats.runs} />
                          {mv.stats.gate?.typicalMonth !== null && mv.stats.gate?.typicalMonth !== undefined ? `, 가운데 ${monthLabel(mv.startYm, mv.stats.gate.typicalMonth)}` : ""}
                        </p>
                        <Link href={`/multiverse?world=${w.id}`} className="btn-ghost mt-3 h-auto min-h-[44px] w-full min-w-0 gap-1.5 px-2 py-2.5 text-center text-sm">
                          <GitBranch aria-hidden="true" size={16} className="shrink-0" /> 나머지 {T.line} {mv.lines.length - 1}개 보기
                        </Link>
                      </section>
                    ) : null}
                  </div>
                );
              })}
            </li>
          ) : null}
        </ol>
      </div>
      <div ref={endRef} />
      {done ? <CompareAll worlds={worlds} mvs={mvs} onPick={pickWorld} /> : null}

      {rows.length === 0 && !error ? <div className="mt-8"><Buddy text="1,000번 살아보고 첫 번째 역으로 출발하는 중…" sub="보통 1분 안팎 걸려요." chatter={["한 삶, 또 한 삶… 영차!", "갈림길을 하나씩 지나는 중…", "지금 열심히 살아 보는 중이에요!"]} /></div> : null}
      {error ? (
        <div role="alert" className="mt-4 flex items-center gap-3 rounded-2xl bg-[#FDECE7] px-4 py-3 text-sm text-[#A3311A]">
          <MascotFace mood="dizzy" size={44} />
          <p className="min-w-0">{error}</p>
        </div>
      ) : null}
      <p className="mt-8 text-cap text-muted">사건이 일어날 확률과 내 선택은 내 조건·가치관·성격과 공개 통계를 바탕으로 정해져요. 확률 배수 중 일부는 아직 {T.assumedFull}이에요.</p>
    </Screen>
  );
}

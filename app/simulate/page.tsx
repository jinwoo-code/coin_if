"use client";
// 3. 체험: 진로마다 100번 살아 보고, AI가 먼저 간 '본선'을 노선도 타임라인으로 보여 준다.
import { BarChart3, CornerDownRight, GitBranch, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { freqWord, LineBadge, MockNotice, RouteProgress, Screen, StateMeters, STATE_META, won } from "@/components/ui";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { store } from "@/lib/store";
import type { LifeState, LineNode, Multiverse, Profile, Selection, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

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
    <Link
      href={`/multiverse?world=${world.id}`}
      className="mt-2.5 flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-cap font-medium transition-colors hover:brightness-95"
      style={{ background: `${world.color}14` }}
    >
      <GitBranch aria-hidden="true" size={14} className="mt-0.5 flex-none" style={{ color: world.color }} />
      <span>
        갈림길 · {ev.branch === "choice" ? "내 선택" : "운"}으로 갈림
        <span className="block font-normal text-muted">
          여기서 {fork.parent.count}번 중 {others}번은 다른 세계로 갔어요
        </span>
      </span>
    </Link>
  );
}

function EventCard({ ev, world, current, mv }: { ev: SimEvent; world: WorldTemplate; current: boolean; mv: Multiverse }) {
  const quiet = ev.eventId === "quiet";
  const pct = Math.round((ev.freq / mv.stats.runs) * 100);
  return (
    <article
      className={`animate-rise rounded-2xl border p-3 sm:p-3.5 ${quiet ? "bg-transparent" : "bg-surface"}`}
      style={{ borderColor: current ? world.color : "#E3E6EB", boxShadow: current ? `0 0 0 1px ${world.color}` : undefined, borderStyle: quiet ? "dashed" : "solid" }}
    >
      <p className="num mb-1 text-cap font-semibold text-muted sm:hidden">{ev.label}</p>
      <p className="mb-1.5 text-cap font-semibold" style={{ color: world.color }}>
        {ev.status}
      </p>
      {!quiet && !ev.routine ? (
        <p className="num mb-1.5 text-cap text-muted">
          {freqWord(pct)} · 100번 중 {ev.freq}번
        </p>
      ) : null}
      <h3 className={`text-[15px] font-bold leading-snug ${quiet ? "text-muted" : ""}`}>{ev.title}</h3>
      <p className="mt-1.5 text-sm text-muted">{ev.narration}</p>
      {ev.choice ? (
        <p className="mt-2 flex gap-1.5 text-sm font-medium">
          <CornerDownRight aria-hidden="true" size={16} className="mt-[3px] flex-none" style={{ color: world.color }} />
          <span>
            <span className="sr-only">나의 선택: </span>
            {ev.choice}
            {ev.reason ? <span className="mt-0.5 block text-cap font-normal text-muted">{ev.reason} 이렇게 했어요</span> : null}
          </span>
        </p>
      ) : null}
      <DeltaChips delta={ev.delta} />
      {ev.minor.length ? <p className="mt-2 text-cap text-muted">그 밖에: {ev.minor.join(", ")}</p> : null}
      <ForkNote mv={mv} ev={ev} world={world} />
      {ev.evidence ? (
        <p className="mt-2.5 flex gap-1.5 border-t border-hair pt-2.5 text-cap text-muted">
          <BarChart3 aria-hidden="true" size={14} className="mt-0.5 flex-none" />
          <span>
            근거: {ev.evidence.label} ({ev.evidence.source})
          </span>
        </p>
      ) : null}
    </article>
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
  const [mvs, setMvs] = useState<Record<string, Multiverse>>({});
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const profile = store.getProfile();
    const sel = store.getSelection();
    if (!profile || !sel) {
      router.replace("/choose");
      return;
    }
    setSelection(sel);
    setWorlds(sel.worldIds.map(getWorld));
    const savedMv = store.getMultiverses();
    const active = store.getActive();
    const lines = store.getLines();
    const saved = savedMv && sel.worldIds.every((id) => savedMv[id] && active[id] && lines[id]?.[active[id]]);
    if (saved) {
      const shown = Object.fromEntries(sel.worldIds.map((id) => [id, lines[id][active[id]]]));
      const labels = Array.from(new Set(Object.values(shown).flat().map((e) => e.label)));
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

  async function run(profile: Profile, sel: Selection) {
    setError("");
    setRows([]);
    setDone(false);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, selection: sel }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          }
          if (msg.type === "step") setRows((r) => [...r, { station: msg.station, label: msg.label, events: msg.events }]);
          if (msg.type === "done") {
            const lines = msg.lines as Record<string, SimEvent[]>;
            for (const [wid, evs] of Object.entries(lines)) {
              store.setLine(wid, evs[0]?.lineId ?? "", evs);
              store.setActive(wid, evs[0]?.lineId ?? "");
            }
            store.setReport(null);
            setDone(true);
          }
          if (msg.type === "error") setError(msg.message);
        }
      }
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
  const lanes = worlds.length || 2;
  const gridClass = lanes === 3 ? "grid-cols-[repeat(3,minmax(150px,1fr))] sm:grid-cols-[64px_repeat(3,minmax(0,1fr))]" : "grid-cols-[repeat(2,minmax(0,1fr))] sm:grid-cols-[64px_repeat(2,minmax(0,1fr))]";
  const latest = (wid: string) => rows.flatMap((r) => r.events).filter((e) => e.worldId === wid).at(-1);

  return (
    <Screen
      wide
      title={done ? "본선을 다 살아봤어요" : "살아보는 중"}
      back="/choose"
      right={
        <span aria-live="polite" className="num pr-2 text-sm font-bold">
          {current ? current.label : "출발 준비 중…"}
        </span>
      }
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-none px-4" onClick={rerun} disabled={!done} aria-label="다시 살아보기">
            <RotateCcw aria-hidden="true" size={18} />
            <span className="hidden sm:inline">다시 살아보기</span>
          </button>
          {done ? (
            <Link href={`/multiverse?world=${worlds[0]?.id ?? ""}`} className="btn-primary flex-1">
              <GitBranch aria-hidden="true" size={18} /> 다른 세계선 보기
            </Link>
          ) : (
            <button className="btn-primary flex-1" disabled>
              살아보는 중…
            </button>
          )}
        </div>
      }
    >
      <MockNotice />
      {Object.keys(mvs).length > 0 && selection ? (
        <div className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_#E3E6EB]">
          <p>
            {monthLabel(selection.startYm, 0)}부터 {durationLabel(selection.months)}을 진로마다 <strong>내 조건과 성향으로 100번</strong> 살아봤어요.
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-muted">
            {worlds.map((w) => {
              const mv = mvs[w.id];
              const main = mv?.lines.find((l) => l.isMain);
              return mv ? (
                <li key={w.id} className="flex gap-1.5">
                  <LineBadge world={w} size={18} />
                  <span>
                    {w.short}: 세계선 {mv.lines.length}개로 갈라졌고, 지금 보는 건 가장 흔한 세계예요({main?.count ?? 0}번).
                  </span>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      ) : null}

      {/* 진로별 지금 처지 */}
      <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))` }}>
        {worlds.map((w) => {
          const ev = latest(w.id);
          return (
            <section key={w.id} aria-label={`${w.name} 지금 상태`} className="card p-3.5 sm:p-4">
              <div className="mb-1 flex items-center gap-2">
                <LineBadge world={w} size={22} />
                <h2 className="truncate text-sm font-bold sm:text-base">
                  <span className="sm:hidden">{w.short}</span>
                  <span className="hidden sm:inline">{w.name}</span>
                </h2>
              </div>
              <p className="mb-2.5 truncate text-cap text-muted">{ev ? `${ev.status}${ev.salary ? ` · 연봉 ${won(ev.salary)}` : ""}` : "출발 전"}</p>
              {ev ? (
                <>
                  <div className="sm:hidden">
                    <StateMeters state={ev.state} color={w.color} keys={["satisfaction", "stress", "money"]} />
                  </div>
                  <div className="hidden sm:block">
                    <StateMeters state={ev.state} color={w.color} keys={["satisfaction", "stress", "skill", "money"]} />
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      {total > 0 ? (
        <div className="mt-5">
          <RouteProgress total={total} current={done ? total : rows.length} label="시뮬레이션 진행" />
        </div>
      ) : null}

      {/* 노선도 타임라인 */}
      <div className="-mx-5 mt-6 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ol className={`grid min-w-full gap-x-2 sm:gap-x-3 ${gridClass}`}>
          {rows.map((row, ri) => {
            const isCurrent = !done && ri === rows.length - 1;
            return (
              <li key={row.station} className="contents">
                <span className={`num hidden whitespace-pre-line pt-2 text-cap leading-snug sm:block ${isCurrent ? "font-bold text-ink" : "text-muted"}`}>{row.label.replace(" ", "\n")}</span>
                {worlds.map((w) => {
                  const ev = row.events.find((e) => e.worldId === w.id);
                  return (
                    <div key={w.id} className="relative pb-4 pl-6 sm:pl-7">
                      <span aria-hidden="true" className="absolute bottom-0 left-[9px] top-0 w-1 origin-top animate-draw rounded-full" style={{ background: w.color }} />
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-2 h-[22px] w-[22px] rounded-full border-[4px]"
                        style={{ borderColor: w.color, background: isCurrent || ev?.branch ? w.color : "#fff", boxShadow: isCurrent ? `0 0 0 5px ${w.color}26` : undefined }}
                      />
                      {ev && mvs[w.id] ? <EventCard ev={ev} world={w} current={isCurrent} mv={mvs[w.id]} /> : null}
                    </div>
                  );
                })}
              </li>
            );
          })}

          {done ? (
            <li className="contents">
              <span className="hidden pt-2 text-cap font-bold sm:block">종착역</span>
              {worlds.map((w) => {
                const mv = mvs[w.id];
                const main = mv?.lines.find((l) => l.isMain);
                return (
                  <div key={w.id} className="relative pl-7">
                    <span aria-hidden="true" className="absolute left-[9px] top-0 h-3 w-1 rounded-full" style={{ background: w.color }} />
                    <span aria-hidden="true" className="absolute left-[-3px] top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: w.color }}>
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    </span>
                    {mv && main ? (
                      <section className="animate-rise rounded-2xl p-3.5 sm:p-4" style={{ background: `${w.color}12` }}>
                        <h3 className="text-sm font-bold">100번 중 이 세계로 온 건 {main.count}번</h3>
                        <p className="mt-1 text-sm">{main.title}</p>
                        <p className="num mt-2 text-cap text-muted">
                          100번 전체로 보면 {mv.stats.gate?.label} {mv.stats.gate?.share}%
                          {mv.stats.gate?.typicalMonth !== null && mv.stats.gate?.typicalMonth !== undefined ? `, 보통 ${durationLabel(mv.stats.gate.typicalMonth + 1)} 뒤` : ""}
                        </p>
                        <Link href={`/multiverse?world=${w.id}`} className="btn-ghost mt-3 min-h-[44px] w-full text-sm">
                          <GitBranch aria-hidden="true" size={16} /> 나머지 세계선 {mv.lines.length - 1}개 보기
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

      {rows.length === 0 && !error ? <p className="mt-10 text-center text-sm text-muted">100번 살아보고 첫 번째 역으로 출발하는 중…</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-[#FDECE7] px-4 py-3 text-sm text-[#A3311A]">
          {error}
        </p>
      ) : null}
      <p className="mt-8 text-cap text-muted">사건이 일어날 확률과 내 선택은 내 조건·가치관·성격과 공개 통계를 바탕으로 정해져요. 확률 배수 중 일부는 아직 가정값이에요.</p>
    </Screen>
  );
}

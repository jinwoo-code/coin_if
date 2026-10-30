"use client";
// 3-2. 멀티버스: 100번 살아본 세계선 나무. 세계선을 열어 보고, 갈림길을 바꿔 보고, 두 세계를 비교한다.
import { ArrowLeftRight, BarChart3, Check, CornerDownRight, GitBranch, MessageCircle, Shuffle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { LineBadge, MockNotice, RangeRow, Screen, Sheet, Typing, won } from "@/components/ui";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { buildMultiverse, levers } from "@/lib/multiverse";
import { store } from "@/lib/store";
import type { Lever, Line, LineNode, Multiverse, Profile, Selection, SimEvent, WorldStats, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";
import { eulReul, iGa, quoted } from "@/lib/josa";

// ---------- 세계선 카드 ----------

function LineCard({ line, world, picked, onOpen, onPick }: { line: Line; world: WorldTemplate; picked: boolean; onOpen: () => void; onPick: () => void }) {
  return (
    <div className="mt-2 rounded-2xl border bg-surface p-3.5" style={{ borderColor: line.isMain ? world.color : "#E3E6EB", borderWidth: line.isMain ? 2 : 1 }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {line.isMain ? (
            <p className="mb-1 text-cap font-bold" style={{ color: world.color }}>
              AI가 먼저 간 길
            </p>
          ) : null}
          <h4 className="text-[15px] font-bold leading-snug">{line.title}</h4>
        </div>
        <span className="num flex-none text-lg font-extrabold">
          {line.count}
          <span className="text-cap font-semibold text-muted">번</span>
        </span>
      </div>
      <dl className="num mt-2 grid grid-cols-3 gap-1 text-cap">
        <div>
          <dt className="text-muted">만족하며 끝남</dt>
          <dd className="font-semibold">{line.satisfiedShare}%</dd>
        </div>
        <div>
          <dt className="text-muted">모은 돈</dt>
          <dd className="font-semibold">{won(line.final.money.p50)}</dd>
        </div>
        <div>
          <dt className="text-muted">연봉</dt>
          <dd className="font-semibold">{line.salary ? won(line.salary) : "없음"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex gap-2">
        <button onClick={onOpen} className="btn-ghost min-h-[44px] flex-1 text-sm">
          이 세계 살아보기
        </button>
        <button onClick={onPick} aria-pressed={picked} className={`chip min-h-[44px] flex-none px-3 text-sm ${picked ? "border-ink bg-ink text-white" : ""}`}>
          {picked ? <Check aria-hidden="true" size={16} /> : <ArrowLeftRight aria-hidden="true" size={16} />} 비교
        </button>
      </div>
    </div>
  );
}

// ---------- 세계선 나무(노선도) ----------

function Tree({
  node,
  mv,
  world,
  picked,
  onOpen,
  onPick,
  depth = 0,
}: {
  node: LineNode;
  mv: Multiverse;
  world: WorldTemplate;
  picked: string[];
  onOpen: (l: Line) => void;
  onPick: (l: Line) => void;
  depth?: number;
}) {
  const line = mv.lines.find((l) => l.id === node.id);
  const onMain = mv.lines.find((l) => l.isMain)?.path.includes(node.id);
  const pct = Math.round((node.count / mv.stats.runs) * 100);
  return (
    <li className="relative">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="relative z-10 mt-1 h-[18px] w-[18px] flex-none rounded-full border-[4px]"
          style={{ borderColor: world.color, background: onMain ? world.color : "#fff", opacity: onMain ? 1 : 0.85 }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={`text-[15px] ${onMain ? "font-bold" : "font-semibold"}`}>{node.cause === "start" ? `출발 · ${monthLabel(mv.startYm, 0)}` : node.label}</span>
            {node.cause !== "start" ? (
              <span className="num text-cap text-muted">
                100번 중 {node.count}번 · 보통 {monthLabel(mv.startYm, node.typicalMonth)}
              </span>
            ) : null}
          </p>
          {node.cause !== "start" ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-cap">
              <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ background: node.cause === "choice" ? "#14171F" : `${world.color}22`, color: node.cause === "choice" ? "#fff" : "#14171F" }}>
                {node.cause === "choice" ? "내 선택으로 갈림" : "운으로 갈림"}
              </span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: world.color }} />
              </span>
            </p>
          ) : null}
          {line ? <LineCard line={line} world={world} picked={picked.includes(line.id)} onOpen={() => onOpen(line)} onPick={() => onPick(line)} /> : null}
          {node.other > 0 ? <p className="num mt-1.5 text-cap text-muted">+ 너무 드물어서 묶은 갈래 {node.other}번</p> : null}
        </div>
      </div>
      {node.children.length ? (
        <ul className="relative ml-[8px] mt-3 flex flex-col gap-4 border-l-[3px] pl-4" style={{ borderColor: `${world.color}55` }}>
          {node.children.map((c) => (
            <Tree key={c.id} node={c} mv={mv} world={world} picked={picked} onOpen={onOpen} onPick={onPick} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// ---------- 세계선 안의 장면(시트) ----------

function SceneRow({ ev, world, onFlip }: { ev: SimEvent; world: WorldTemplate; onFlip: (ev: SimEvent) => void }) {
  if (ev.eventId === "quiet")
    return (
      <li className="relative pl-6 text-cap text-muted">
        <span aria-hidden="true" className="absolute left-[5px] top-1.5 h-2 w-2 rounded-full bg-hair" />
        <span className="num">{ev.label}</span> · {ev.status}, 조용히 지나감
      </li>
    );
  const card = world.events.find((e) => e.id === ev.eventId);
  const canFlip = Boolean(ev.branch && card && (ev.branch === "luck" || card.choices.length > 1));
  return (
    <li className="relative pl-6">
      <span aria-hidden="true" className="absolute left-[2px] top-1 h-3.5 w-3.5 rounded-full border-[3px]" style={{ borderColor: world.color, background: ev.branch ? world.color : "#fff" }} />
      <p className="num text-cap text-muted">
        {ev.label} · {ev.status}
      </p>
      <h4 className="text-[15px] font-bold">{ev.title}</h4>
      <p className="mt-1 text-sm text-muted">{ev.narration}</p>
      {ev.choice ? (
        <p className="mt-1.5 flex gap-1.5 text-sm font-medium">
          <CornerDownRight aria-hidden="true" size={16} className="mt-[3px] flex-none" style={{ color: world.color }} />
          <span>
            {ev.choice}
            {ev.reason ? <span className="block text-cap font-normal text-muted">{ev.reason} 이렇게 했어요</span> : null}
          </span>
        </p>
      ) : null}
      {ev.evidence ? (
        <p className="mt-1.5 flex gap-1.5 text-cap text-muted">
          <BarChart3 aria-hidden="true" size={14} className="mt-0.5 flex-none" /> {ev.evidence.label} ({ev.evidence.source})
        </p>
      ) : null}
      {canFlip ? (
        <button onClick={() => onFlip(ev)} className="chip mt-2 min-h-[40px] text-cap font-semibold">
          <Shuffle aria-hidden="true" size={14} /> {ev.branch === "luck" ? "운이 반대였다면" : "여기서 다르게 골랐다면"}
        </button>
      ) : null}
    </li>
  );
}

interface Explored {
  title: string;
  stats: WorldStats;
  scenes: SimEvent[];
  reached: number;
}

function Compare({ a, b, world }: { a: Line; b: Line; world: WorldTemplate }) {
  const rows: [string, (l: Line) => string][] = [
    ["100번 중", (l) => `${l.count}번`],
    ["만족하며 끝남", (l) => `${l.satisfiedShare}%`],
    ["스트레스 높게 끝남", (l) => `${l.stressedShare}%`],
    ["모은 돈(가운데 값)", (l) => won(l.final.money.p50)],
    ["연봉", (l) => (l.salary ? won(l.salary) : "없음")],
    ["역량", (l) => String(l.final.skill.p50)],
  ];
  return (
    <section aria-label="두 세계 비교" className="card mt-4 animate-rise overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-hair p-3.5 text-sm font-bold">
        <span className="text-muted">비교</span>
        <span>{a.title}</span>
        <span>{b.title}</span>
      </div>
      <dl>
        {rows.map(([label, f]) => (
          <div key={label} className="num grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-hair px-3.5 py-2.5 text-sm last:border-0">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold">{f(a)}</dd>
            <dd className="font-semibold">{f(b)}</dd>
          </div>
        ))}
      </dl>
      <p className="px-3.5 pb-3 text-cap text-muted" style={{ color: world.color }}>
        같은 사람, 같은 출발. 갈림길 몇 개가 이만큼 다른 3년을 만들었어요.
      </p>
    </section>
  );
}

function LeverList({ items, world }: { items: Lever[] | null; world: WorldTemplate }) {
  return (
    <section aria-labelledby="levers" className="mt-8">
      <h2 id="levers" className="flex items-center gap-2 text-xl font-bold">
        <Sparkles aria-hidden="true" size={20} style={{ color: world.color }} /> 내가 바꿀 수 있는 것 Top 3
      </h2>
      <p className="mt-1 text-sm text-muted">내 조건 하나를 바꾸거나 갈림길에서 다르게 골랐을 때, 100번을 다시 살아본 결과예요.</p>
      {items === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Typing label="계산 중" /> 조건을 바꿔 가며 다시 살아보는 중…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">지금 조건에서 결과를 크게 바꾸는 요인은 찾지 못했어요.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2.5">
          {items.map((l, i) => (
            <li key={l.title} className="card p-4">
              <p className="flex items-start gap-2.5">
                <span className="num flex h-6 w-6 flex-none items-center justify-center rounded-full text-cap font-bold text-white" style={{ background: world.color }}>
                  {i + 1}
                </span>
                <span className="font-bold">{l.title}</span>
              </p>
              <p className="mt-2 pl-[34px] text-cap text-muted">{l.metric}</p>
              <p className="num pl-[34px] text-sm">
                <span className="text-muted line-through decoration-1">{l.before}</span> → <strong>{l.after}</strong>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// 합격·취업이 거의 없을 때 이유를 짐작해서 알려 준다(입력 조건에서 바로 보이는 것만)
function whyLow(p: Profile, w: WorldTemplate, months: number) {
  const reasons: string[] = [];
  const enlist = p.life.military === "미필" ? p.life.enlistIn : null;
  if (enlist !== null && enlist < months) reasons.push(`${enlist}개월 뒤부터 18개월 동안 군 복무라 그 사이엔 시험·채용 기회가 없어요`);
  if (p.spec.gradIn > 0 && ["open", "license", "portfolio", "trade", "public"].includes(w.archetype)) reasons.push(`졸업까지 ${p.spec.gradIn}개월이 남아 그 전엔 정규직 채용이 안 돼요`);
  if (w.archetype === "exam" && p.life.studyHours < 6) reasons.push(`하루 공부 ${p.life.studyHours}시간은 합격자 평균(10.2시간)보다 많이 적어요`);
  if (reasons.length === 0) reasons.push("이 조건에서는 준비 기간이 더 필요해요. 기간을 늘려서 살아보세요");
  return `기간 안에 거의 안 된 이유: ${reasons.join(". ")}.`;
}

// ---------- 지금 현실에서는(고용24 실시간) ----------

interface Live {
  available: boolean;
  keyword?: string;
  regionLabel?: string;
  wanted?: { total: number; salaryMedian: number | null; salarySample: number; items: { id: string; company: string; title: string; sal: string; region: string; url: string }[] } | null;
  duties?: { name: string; def: string }[];
  ncs?: string;
  training?: { total: number; top: { title: string; org: string; start?: string; rate6: number | null; url: string }[] } | null;
  at?: string;
}

function LiveCard({ world, region }: { world: WorldTemplate; region: string }) {
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    let alive = true;
    setLive(null);
    fetch(`/api/live?world=${world.id}&region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((d) => alive && setLive(d))
      .catch(() => alive && setLive({ available: false }));
    return () => {
      alive = false;
    };
  }, [world.id, region]);

  if (live === null)
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted">
        <Typing label="불러오는 중" /> 고용24에서 지금 현실을 불러오는 중…
      </p>
    );
  if (!live.available)
    return <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-cap text-muted shadow-[0_0_0_1px_#E3E6EB]">고용24 키를 넣으면 이 진로의 실제 신입 공고·하는 일·국비 과정이 여기 보여요.</p>;
  const w = live.wanted;
  if (!w && !live.duties?.length && !(live.training && live.training.total > 0))
    return <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-cap text-muted shadow-[0_0_0_1px_#E3E6EB]">고용24에 연결하지 못했어요. 인터넷 연결이나 인증키를 확인해 주세요.</p>;
  return (
    <section aria-labelledby="live" className="card mt-4 p-5">
      <h2 id="live" className="flex items-center gap-2 font-bold">
        <span className="h-2 w-2 rounded-full bg-[#0B6B4B]" aria-hidden="true" /> 지금 현실에서는
        <span className="num ml-auto text-cap font-normal text-muted">고용24 · {live.at}</span>
      </h2>
      {w ? (
        <div className="mt-3">
          <p className="text-sm">
            {live.regionLabel} &lsquo;{live.keyword}&rsquo; 신입 공고 <strong className="num">{w.total.toLocaleString("ko-KR")}건</strong>
            {w.salaryMedian ? (
              <>
                , 제시 연봉 가운데 값 <strong className="num">{won(w.salaryMedian)}</strong>
                <span className="text-cap text-muted"> ({w.salarySample}건 기준)</span>
              </>
            ) : null}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {w.items.map((it) => (
              <li key={it.id}>
                <a href={it.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-ground px-3 py-2 text-sm hover:brightness-95">
                  <span className="font-semibold">{it.company}</span> · {it.title}
                  <span className="block text-cap text-muted">
                    {it.region}
                    {it.sal ? ` · ${it.sal}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {live.duties?.length ? (
        <div className="mt-4">
          <p className="label">실제로 하는 일(NCS {live.ncs})</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {live.duties.map((d) => (
              <li key={d.name} title={d.def} className="rounded-full bg-ground px-3 py-1 text-cap">
                {d.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {live.training && live.training.total > 0 ? (
        <div className="mt-4">
          <p className="label">곧 열리는 국비 훈련과정 {live.training.total}개</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {live.training.top.map((t) => (
              <li key={t.title} className="text-sm">
                <a href={t.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {t.title}
                </a>
                <span className="num text-cap text-muted">{t.rate6 !== null && t.rate6 > 0 ? ` · 6개월 취업률 ${t.rate6}%` : t.start ? ` · ${t.start} 시작` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// ---------- 화면 ----------

function MultiversePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mvs, setMvs] = useState<Record<string, Multiverse>>({});
  const worldId = params.get("world") ?? selection?.worldIds[0] ?? "";
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<Line | null>(null);
  const [scenes, setScenes] = useState<SimEvent[] | null>(null);
  const [explored, setExplored] = useState<Explored | null>(null);
  const [busy, setBusy] = useState(false);
  const [leverMap, setLeverMap] = useState<Record<string, Lever[]>>({});

  useEffect(() => {
    const p = store.getProfile();
    const s = store.getSelection();
    const m = store.getMultiverses();
    if (!p || !s || !m) {
      router.replace("/simulate");
      return;
    }
    setProfile(p);
    setSelection(s);
    setMvs(m);
  }, [router]);

  const world = useMemo(() => (worldId ? getWorld(worldId) : null), [worldId]);
  const mv = mvs[worldId];

  // '바꿀 수 있는 것'은 브라우저에서 바로 계산한다(같은 시드라 서버와 같은 결과).
  useEffect(() => {
    if (!profile || !selection || !world || leverMap[world.id]) return;
    const t = window.setTimeout(() => {
      const { paths } = buildMultiverse(profile, world, selection.months, selection.startYm);
      setLeverMap((m) => ({ ...m, [world.id]: levers(profile, world, selection.months, selection.startYm, paths) }));
    }, 50);
    return () => window.clearTimeout(t);
  }, [profile, selection, world, leverMap]);

  useEffect(() => setPicked([]), [worldId]);

  async function openLine(line: Line) {
    if (!profile || !selection || !world) return;
    setOpen(line);
    setExplored(null);
    const cached = store.getLine(world.id, line.id);
    if (cached) {
      setScenes(cached);
      return;
    }
    setScenes(null);
    const res = await fetch("/api/line", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, selection, worldId: world.id, lineId: line.id }) });
    const data = await res.json();
    if (data.scenes) {
      store.setLine(world.id, line.id, data.scenes);
      setScenes(data.scenes);
    }
  }

  async function flip(ev: SimEvent) {
    if (!profile || !selection || !world) return;
    const card = world.events.find((e) => e.id === ev.eventId);
    if (!card) return;
    const force = ev.branch === "luck" ? { eventId: ev.eventId, outcome: "skip" as const } : { eventId: ev.eventId, choiceIndex: (ev.choiceIndex + 1) % card.choices.length };
    const name = card.branchLabel ?? card.title;
    const alt = force.choiceIndex !== undefined ? (card.choices[force.choiceIndex].label ?? card.choices[force.choiceIndex].text) : "";
    const title = ev.branch === "luck" ? `${quoted(name, iGa)} 일어나지 않은 세계` : `'${name}'에서 ${quoted(alt, eulReul)} 고른 세계`;
    setBusy(true);
    try {
      const res = await fetch("/api/explore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, selection, worldId: world.id, force }) });
      const data = await res.json();
      setExplored({ title, stats: data.stats, scenes: data.scenes, reached: data.reached });
    } finally {
      setBusy(false);
    }
  }

  function talkTo(line: Line) {
    if (!world) return;
    store.setActive(world.id, line.id);
    router.push(`/talk?world=${world.id}`);
  }

  if (!profile || !selection || !world || !mv) return null;

  const togglePick = (l: Line) => setPicked((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p.slice(-1), l.id]));
  const pickedLines = picked.map((id) => mv.lines.find((l) => l.id === id)).filter(Boolean) as Line[];
  const st = mv.stats;

  return (
    <Screen
      title="세계선 지도"
      back="/simulate"
      footer={
        <div className="flex gap-2">
          <Link href={`/talk?world=${world.id}`} className="btn-ghost flex-1">
            <MessageCircle aria-hidden="true" size={18} /> 나와 대화
          </Link>
          <Link href="/report" className="btn-primary flex-1">
            리포트 보기
          </Link>
        </div>
      }
    >
      <MockNotice />
      {/* 진로 탭 */}
      <div role="tablist" aria-label="진로" className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {selection.worldIds.map((id) => {
          const w = getWorld(id);
          const on = id === world.id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => router.replace(`/multiverse?world=${id}`)}
              className={`chip flex-none ${on ? "border-transparent font-bold text-white" : ""}`}
              style={on ? { background: w.color, color: w.onColor } : undefined}
            >
              <LineBadge world={w} size={20} outline={on} /> {w.short}
            </button>
          );
        })}
      </div>

      {/* 100번의 결과 */}
      <section aria-labelledby="summary" className="card mt-4 p-5">
        <h2 id="summary" className="text-lg font-bold">
          {world.name}, 100번 살아본 결과
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3" style={{ background: `${world.color}12` }}>
            <p className="text-cap text-muted">{durationLabel(selection.months)} 안에 {st.gate?.label}</p>
            <p className="num text-2xl font-extrabold">{st.gate?.share ?? 0}%</p>
            <p className="num text-cap text-muted">{st.gate?.typicalMonth !== null && st.gate?.typicalMonth !== undefined ? `보통 ${monthLabel(mv.startYm, st.gate.typicalMonth)}` : "기간 안에 거의 못 함"}</p>
          </div>
          <div className="rounded-2xl bg-ground p-3">
            <p className="text-cap text-muted">만족하며 끝남</p>
            <p className="num text-2xl font-extrabold">{st.satisfiedShare}%</p>
            <p className="num text-cap text-muted">스트레스 높게 끝남 {st.stressedShare}%</p>
          </div>
        </div>
        {(st.gate?.share ?? 0) < 10 ? <p className="mt-3 rounded-xl bg-[#FFF4E5] px-3 py-2 text-cap text-[#7A4300]">{whyLow(profile, world, selection.months)}</p> : null}
        <div className="mt-4 grid gap-2.5">
          <RangeRow label="모은 돈" {...st.final.money} color={world.color} money max={Math.max(st.final.money.p90, 1000)} />
          {st.salary.p50 ? <RangeRow label="연봉(일하는 경우)" {...st.salary} color={world.color} money max={6000} /> : null}
          <RangeRow label="만족도" {...st.final.satisfaction} color={world.color} />
        </div>
        <p className="mt-2 text-cap text-muted">굵은 선은 가운데 값, 옅은 띠는 100번 중 80번이 들어간 범위예요.</p>

        {st.factors.length ? (
          <div className="mt-5 border-t border-hair pt-4">
            <p className="label">내 조건이 확률을 바꾼 정도</p>
            <ul className="mt-2 flex flex-col gap-2">
              {st.factors.map((f) => (
                <li key={f.key} className="text-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{f.label}</span>
                    <span className={`num font-bold ${f.mult > 1 ? "text-[#0B6B4B]" : f.mult < 1 ? "text-[#A3311A]" : ""}`}>×{f.mult}</span>
                  </span>
                  <span className="block text-cap text-muted">{f.why}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-cap text-muted">평범한 지원자를 ×1로 둔 배수예요. 배수 자체는 아직 가정값이라, 실제 채용 통계로 보정하는 중이에요.</p>
          </div>
        ) : null}
      </section>

      <LiveCard world={world} region={profile.life.region} />

      {/* 근거 자료 */}
      <details className="card mt-4 p-5 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold">
          <span className="flex items-center gap-2">
            <BarChart3 aria-hidden="true" size={18} style={{ color: world.color }} /> 이 세계를 만든 근거 자료 {world.facts.length}개
          </span>
          <span className="text-cap font-semibold text-muted">펼치기</span>
        </summary>
        <ul className="mt-3 flex flex-col gap-3">
          {world.facts.map((f) => (
            <li key={f.label} className="text-sm">
              <p className="text-muted">{f.label}</p>
              <p className="font-semibold">{f.value}</p>
              <p className="text-cap text-muted">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {f.source}
                  </a>
                ) : (
                  f.source
                )}{" "}
                · {f.year}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-cap text-muted">합격·취업 확률과 사건 빈도는 이 자료를 기준으로 맞춘 모델 값이에요. 고용24 연동과 현직자 인터뷰로 계속 보정해요.</p>
      </details>

      {/* 세계선 나무 */}
      <section aria-labelledby="tree" className="mt-8">
        <h2 id="tree" className="flex items-center gap-2 text-xl font-bold">
          <GitBranch aria-hidden="true" size={20} style={{ color: world.color }} /> 갈라진 세계선 {mv.lines.length}개
        </h2>
        <p className="mt-1 text-sm text-muted">갈림길마다 100번 중 몇 번이 어느 쪽으로 갔는지예요. 두 세계를 골라 비교해 보세요.</p>
        {pickedLines.length === 2 ? <Compare a={pickedLines[0]} b={pickedLines[1]} world={world} /> : null}
        <ul className="mt-5">
          <Tree node={mv.tree} mv={mv} world={world} picked={picked} onOpen={openLine} onPick={togglePick} />
        </ul>
      </section>

      <LeverList items={leverMap[world.id] ?? null} world={world} />

      {/* 세계선 하나 살아보기 */}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={explored ? "반대로 간 세계" : (open?.title ?? "")}>
        {explored ? (
          <div>
            <p className="text-base font-bold">{explored.title}</p>
            <p className="num mt-1 text-sm text-muted">
              이 갈림길을 바꾼 채로 100번을 다시 살아봤어요. {st.gate?.label} {st.gate?.share}% → <strong className="text-ink">{explored.stats.gate?.share ?? 0}%</strong>, 만족하며 끝남 {st.satisfiedShare}% → <strong className="text-ink">{explored.stats.satisfiedShare}%</strong>
            </p>
            <ol className="mt-4 flex flex-col gap-4">
              {explored.scenes.map((ev) => (
                <SceneRow key={ev.station} ev={ev} world={world} onFlip={() => undefined} />
              ))}
            </ol>
            <button className="btn-ghost mt-5 w-full" onClick={() => setExplored(null)}>
              원래 세계로 돌아가기
            </button>
          </div>
        ) : open ? (
          <div>
            <p className="num text-sm text-muted">
              100번 중 {open.count}번이 이 세계로 왔어요. 아래는 그중 가장 전형적인 한 번이에요.
            </p>
            {busy ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Typing label="다시 살아보는 중" /> 갈림길을 바꿔서 100번 다시 살아보는 중…
              </p>
            ) : null}
            {scenes ? (
              <ol className="mt-4 flex flex-col gap-4">
                {scenes.map((ev) => (
                  <SceneRow key={ev.station} ev={ev} world={world} onFlip={flip} />
                ))}
              </ol>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Typing label="불러오는 중" /> 이 세계를 살아보는 중…
              </p>
            )}
            <button className="btn-primary mt-5 w-full" onClick={() => talkTo(open)}>
              <MessageCircle aria-hidden="true" size={18} /> 이 세계의 나와 대화하기
            </button>
          </div>
        ) : null}
      </Sheet>
    </Screen>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MultiversePage />
    </Suspense>
  );
}

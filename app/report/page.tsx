"use client";
// 5. 실행 계획과 사후 관리: 비교 리포트 + WOOP 실행 계획 + 이번 주 할 일 + 체크인
import { ArrowDown, ArrowRight, CalendarPlus, Check, ChevronDown, Lock, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OutcomeSplit, showsOutcome } from "@/components/outcome-split";
import { Ci, LineBadge, RangeRow, Screen, Typing, won } from "@/components/ui";
import { times } from "@/lib/ci";
import { satText } from "@/lib/format";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { GapSection } from "@/components/gap";
import { computeLevers } from "@/lib/levers-client";
import { isDemoPerson } from "@/lib/demo";
import { profileHash } from "@/lib/judge";
import { hasSupabase } from "@/lib/supabase/config";
import { store } from "@/lib/store";
import { runKey } from "@/lib/sync";
import type { Lever, Multiverse, PremiumItem, Profile, Report, Selection, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";
import { LiveLives } from "@/components/live-lives";
import { SharePanel } from "@/components/share-panel";
import { WeekPlan } from "@/components/week-plan";
import { T } from "@/lib/copy";

// 한 달 뒤 체크인을 캘린더에 넣는 .ics 파일
function downloadCheckin() {
  const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//career-rehearsal//KO",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@career-rehearsal`,
    `DTSTART;VALUE=DATE:${ymd}`,
    "SUMMARY:진로 리허설 체크인",
    "DESCRIPTION:한 달 동안 해 본 일을 입력하고 다시 살아보세요.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "진로-체크인.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// 1,000번 살아본 결과: 관문(합격·취업), 세계선 상위 3개, 바꿀 수 있는 것
// 일반 리포트는 '바꿀 수 있는 것'을 2개까지, 프리미엄은 전부 보여 준다.
const BASIC_LEVERS = 2;

function HundredRuns({ world, mv, items, premium }: { world: WorldTemplate; mv: Multiverse; items: Lever[] | undefined; premium: boolean }) {
  const st = mv.stats;
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-label={`${world.name} ${times(st.runs)}번 살아본 결과`}>
      <div className="flex items-center gap-2">
        <LineBadge world={world} size={24} />
        <h3 className="text-base font-bold">{world.name}</h3>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-2xl p-3" style={{ background: `${world.color}12` }}>
          <dt className="text-cap text-muted">
            {durationLabel(mv.months)} 안에 {st.gate?.label}
          </dt>
          <dd className="num mt-0.5 text-sm">
            <strong className="text-xl font-extrabold">{st.gate?.share ?? 0}%</strong> <Ci pct={st.gate?.share ?? 0} n={st.runs} />
            {st.gate?.typicalMonth !== null && st.gate?.typicalMonth !== undefined ? <span className="text-muted">, 보통 {monthLabel(mv.startYm, st.gate.typicalMonth)}</span> : null}
          </dd>
        </div>
        {showsOutcome(world, st) ? (
          <div className="col-span-2 rounded-2xl bg-ground p-3">
            <dt className="mb-2 text-cap font-bold">{durationLabel(mv.months)}이 끝날 때</dt>
            <dd>
              <OutcomeSplit st={st} />
            </dd>
          </div>
        ) : (
          <div className="rounded-2xl bg-ground p-3">
            <dt className="text-cap text-muted">만족하며 끝남</dt>
            <dd className="num text-xl font-extrabold">
              {st.satisfiedShare}% <Ci pct={st.satisfiedShare} n={st.runs} className="block" />
            </dd>
          </div>
        )}
        <div className="rounded-2xl bg-ground p-3">
          <dt className="text-cap text-muted">스트레스 높게 끝남</dt>
          <dd className="num text-xl font-extrabold">
            {st.stressedShare}% <Ci pct={st.stressedShare} n={st.runs} className="block" />
          </dd>
        </div>
      </dl>
      <p className="label mt-4">가장 많이 간 {T.line}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {mv.lines.slice(0, 3).map((l) => (
          <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{l.title}</span>
            <span className="num text-cap font-semibold">{Math.round((l.count / st.runs) * 100)}%</span>
            <span className="col-span-2 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${(l.count / st.runs) * 100}%`, background: world.color }} />
              </span>
              <span className="num text-cap text-muted">
                {l.switched ? "다른 진로로 감" : `만족 ${l.satisfiedShare}%`} · {won(l.final.money.p50)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-cap text-muted">{T.basisLine}</p>
      <div className="mt-4 grid gap-2">
        <RangeRow label="모은 돈" {...st.final.money} color={world.color} money max={Math.max(st.final.money.p90, 1000)} />
        <RangeRow label="만족도" {...st.final.satisfaction} color={world.color} />
      </div>
      <p className="mt-1 text-cap text-muted">이 막대는 {T.basisAll(times(st.runs))}이에요.</p>
      <p className="label mt-5">내가 바꿀 수 있는 것</p>
      {items === undefined ? (
        <p className="mt-2 flex items-center gap-2 text-cap text-muted">
          <Typing label="계산 중" /> 조건을 바꿔 다시 살아보는 중…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-cap text-muted">결과를 크게 바꾸는 요인은 찾지 못했어요.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2">
          {(premium ? items : items.slice(0, BASIC_LEVERS)).map((l) => (
            <li key={l.title} className="text-sm">
              <span className="font-semibold">{l.title}</span>
              <span className="num block text-cap text-muted">
                {l.metric}: {l.before} → <strong className="text-ink">{l.after}</strong>
              </span>
            </li>
          ))}
          {!premium && items.length > BASIC_LEVERS ? (
            <li className="flex items-center gap-1.5 text-cap text-muted">
              <Lock aria-hidden="true" size={13} /> 프리미엄 리포트에서 {items.length - BASIC_LEVERS}개 더
            </li>
          ) : null}
        </ol>
      )}
      <Link href={`/multiverse?world=${world.id}`} className="btn-ghost mt-4 min-h-[44px] w-full text-sm">
        {T.lineMap} 보기
      </Link>
    </section>
  );
}

// 고용센터에서 실제로 신청할 수 있는 무료 프로그램(고용24)
function Programs({ region }: { region: string }) {
  const [items, setItems] = useState<{ center: string; name: string; course: string; start: string; place: string }[] | null>(null);
  useEffect(() => {
    fetch(`/api/programs?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.available ? d.items : []))
      .catch(() => setItems([]));
  }, [region]);
  if (!items || items.length === 0) return null;
  const date = (s: string) => (s && s.length === 8 ? `${Number(s.slice(4, 6))}월 ${Number(s.slice(6))}일` : s);
  return (
    <details className="group card" data-testid="programs">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="font-bold">지금 신청할 수 있는 고용센터 프로그램</h2>
        <ChevronDown aria-hidden="true" size={20} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col gap-2.5 border-t border-hair px-5 py-4 sm:px-6">
        {items.map((p) => (
          <li key={`${p.center}${p.course}${p.start}`} className="text-sm">
            <span className="font-semibold">{p.course || p.name}</span>
            <span className="block text-cap text-muted">
              {p.center} · {date(p.start)}
              {p.place ? ` · ${p.place}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-5 pb-5 text-cap text-muted sm:px-6">고용24 구직자취업역량 강화프로그램 정보예요.</p>
    </details>
  );
}

// 같은 결과의 리포트 요청은 하나만 보낸다. 개발 모드(Strict Mode)는 화면을 두 번 그려 AI를 두 번 부르고, 원가 실측도 두 배가 된다.
let reportInflight: { key: string; promise: Promise<Report> } | null = null;
// 리포트에 들어가는 프로필 값과 시뮬레이션. 계획(일정)은 이 기기 칸이라 안 넣는다(다시 살아 보기가 따로 안내).
function reportStamp(p: Profile, m: Record<string, Multiverse>) {
  return `${profileHash(p)}:${JSON.stringify([p.dilemma, p.constraints]).length}:${Object.values(m).map(runKey).sort().join("|")}`;
}

function requestReport(key: string, body: unknown): Promise<Report> {
  if (reportInflight?.key !== key) {
    const promise = fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<Report>;
    });
    reportInflight = { key, promise };
    promise.catch(() => {
      if (reportInflight?.promise === promise) reportInflight = null; // 실패하면 다시 시도할 수 있게
    });
  }
  return reportInflight.promise;
}

// 프리미엄 리포트: 숫자는 전부 엔진 값(세계선 전체 비교), 할 일 문장만 AI.
function Premium({ items, mvs, ids, busy, onOpen, demo }: { items: PremiumItem[] | null; mvs: Record<string, Multiverse>; ids: string[]; busy: boolean; onOpen: () => void; demo: boolean }) {
  // 학교 무제한이면 토큰이 줄지 않으니 버튼에 토큰 수 대신 그렇게 쓴다.
  const [unlimited, setUnlimited] = useState(false);
  useEffect(() => {
    if (items || demo || !hasSupabase()) return;
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUnlimited(Boolean(d.unlimited)))
      .catch(() => setUnlimited(false));
  }, [items, demo]);
  if (!items)
    return (
      <section className="card p-5 sm:p-6 print:hidden" aria-labelledby="premium">
        <h2 id="premium" className="flex items-center gap-2 text-xl font-bold">
          <Lock aria-hidden="true" size={18} /> 프리미엄 리포트
        </h2>
        {demo ? <p className="mt-2 text-sm font-medium">예시 인물이라 로그인 없이 전체를 보여 드려요.</p> : null}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>필요한 것과 내 격차 전체, 우선순위와 근거</li>
          <li>월별 일정, 증거물과 주제 제안</li>
          <li>계획 넣고 다시 살아 보기</li>
          <li>이번 주 할 일 직접 정하기, 상담사에게 공유(PDF·링크)</li>
          <li>{T.line} 전체 비교 표, 바꿀 수 있는 것 전체, 막히는 길에서 할 일</li>
        </ul>
        {hasSupabase() || demo ? (
          <button className="btn-primary mt-5 w-full" onClick={onOpen} disabled={busy}>
            {busy ? "만드는 중…" : `프리미엄 리포트 열기 · ${demo ? "예시 인물 무료" : unlimited ? "대학 계약에 포함" : "토큰 5개"}`}
          </button>
        ) : (
          <p className="mt-4 text-cap text-muted">로그인 기능이 연결되면 열 수 있어요.</p>
        )}
      </section>
    );
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="premium">
      <div className="flex items-start justify-between gap-3">
        <h2 id="premium" className="text-xl font-bold">
          프리미엄 리포트
        </h2>
      </div>
      {ids.map((id) => {
        const world = getWorld(id);
        const mv = mvs[id];
        if (!mv) return null;
        return (
          <div key={id} className="mt-5 break-inside-avoid">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <LineBadge world={world} size={22} /> {world.name}: {T.line} 전체
            </h3>
            <p className="mt-2 text-cap text-muted">{T.basisLine}</p>
            <div className="-mx-1 mt-2 overflow-x-auto px-1">
              <table className="num w-full min-w-[480px] text-left text-sm">
                <thead className="text-cap text-muted">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">{T.line}</th>
                    <th className="py-1.5 pr-2 text-right font-medium">{times(mv.stats.runs)}번 중</th>
                    <th className="py-1.5 pr-2 text-right font-medium">만족</th>
                    <th className="py-1.5 pr-2 text-right font-medium">스트레스 높음</th>
                    <th className="py-1.5 text-right font-medium">모은 돈(가운데)</th>
                  </tr>
                </thead>
                <tbody>
                  {mv.lines.map((l) => (
                    <tr key={l.id} className="border-t border-hair">
                      <td className="py-2 pr-2 font-semibold">{l.title}</td>
                      <td className="py-2 pr-2 text-right">{times(l.count)}번</td>
                      <td className="py-2 pr-2 text-right">{satText(l)}</td>
                      <td className="py-2 pr-2 text-right">{l.stressedShare}%</td>
                      <td className="py-2 text-right">{won(l.final.money.p50)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <h3 className="mt-6 text-base font-bold">자주 막히는 길로 가고 있다면</h3>
      <p className="mt-1 text-cap text-muted">만족하며 끝난 비율이 가장 낮은 {T.line}이에요. {items.every((it) => it.ai !== false) ? "할 일은 AI가 내 조건에 맞춰 쓴 제안이에요." : items.some((it) => it.ai) ? "할 일 일부는 AI 제안을 못 받아 기본 할 일로 채웠어요." : "AI 제안을 못 받아 기본 할 일로 채웠어요."}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((it) => (
          <li key={`${it.worldId}/${it.lineId}`} className="break-inside-avoid rounded-2xl bg-ground p-4">
            <p className="text-sm font-bold">
              {getWorld(it.worldId).short} · {it.line}
            </p>
            <p className="num text-cap text-muted">
              {it.share}%가 이 길 · 만족하며 끝남 {it.satisfied}%
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {it.steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}

const WOOP_STEPS: { key: keyof Report["woop"]; label: string }[] = [
  { key: "wish", label: "바라는 것" },
  { key: "outcome", label: "이루면 좋은 점" },
  { key: "obstacle", label: "내 안의 걸림돌" },
  { key: "plan", label: "만약 그러면 계획" },
];

// 무료: 할 일 3개(체크만). 언제·어디서를 정하는 칸은 프리미엄.
function FreeTodos({ todos }: { todos: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="todo" data-testid="free-todos">
      <h2 id="todo" className="text-xl font-bold">
        이번 주 할 일
      </h2>
      <ul className="mt-3 flex flex-col">
        {todos.slice(0, 3).map((t, i) => (
          <li key={t}>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-hair text-base last:border-0">
              <input type="checkbox" className="peer sr-only" checked={Boolean(done[i])} onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))} />
              <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 border-hair text-transparent peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2">
                <Check size={15} strokeWidth={3} />
              </span>
              <span className={done[i] ? "text-muted line-through" : ""}>{t}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mvs, setMvs] = useState<Record<string, Multiverse>>({});
  const [leverMap, setLeverMap] = useState<Record<string, Lever[]>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [icsDone, setIcsDone] = useState(false);
  const [premium, setPremium] = useState<PremiumItem[] | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [remaking, setRemaking] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

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
    // 바꿀 수 있는 것: 브라우저에서 조건을 바꿔 가며 다시 살아본다.
    // 1,000번씩 여러 번 다시 사는 일이라 Web Worker에서(lib/levers-client.ts)
    Promise.all(s.worldIds.map((id) => computeLevers(p, id, s.months, s.startYm).catch(() => [] as Lever[]))).then((all) => setLeverMap(Object.fromEntries(s.worldIds.map((id, i) => [id, all[i]]))));
    setPremium(store.getPremium());
    const saved = store.getReport();
    if (saved && saved.worlds.every((w) => m[w.worldId])) {
      setReport(saved);
      // 예전에 저장한 리포트는 기준값이 없어 그대로 둔다.
      setStale(Boolean(saved.stamp) && saved.stamp !== reportStamp(p, m));
      return;
    }
    makeReport(p, s, m).catch(() => setNotice("리포트를 만들지 못했어요. 새로고침해 주세요."));
  }, [router]);

  async function makeReport(p: Profile, s: Selection, m: Record<string, Multiverse>) {
    const active = store.getActive();
    const scenes: Record<string, SimEvent[]> = Object.fromEntries(s.worldIds.map((id) => [id, store.getLine(id, active[id] ?? "") ?? []]));
    const stamp = reportStamp(p, m);
    const rep: Report = { ...(await requestReport(stamp, { profile: p, multiverses: m, scenes })), stamp };
    store.setReport(rep);
    setReport(rep);
    setStale(false);
  }

  // 프로필이나 시뮬레이션이 바뀐 뒤에만. 프리미엄을 열었으면 그 문장도 다시 받는다(같은 시뮬레이션이면 토큰을 다시 안 뺀다).
  async function remake() {
    const p = store.getProfile();
    const s = store.getSelection();
    const m = store.getMultiverses();
    if (!p || !s || !m) return;
    setRemaking(true);
    try {
      await makeReport(p, s, m);
      if (store.getPremium()) await openPremium();
    } catch {
      setNotice("다시 만들지 못했어요. 지금 내용은 그대로예요.");
    } finally {
      setRemaking(false);
    }
  }

  // 프리미엄 리포트: 서버에서 5토큰을 빼고(같은 결과면 다시 안 뺌) '막혔을 때 할 일'을 받는다.
  async function openPremium() {
    const p = store.getProfile();
    const s = store.getSelection();
    const m = store.getMultiverses();
    if (!p || !s || !m) return;
    setPremiumBusy(true);
    const active = store.getActive();
    const scenes = Object.fromEntries(s.worldIds.map((id) => [id, store.getLine(id, active[id] ?? "") ?? []]));
    try {
      const res = await fetch("/api/report/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p, multiverses: m, scenes, runKeys: Object.values(m).map(runKey) }),
      });
      if (res.status === 401) return router.push("/login");
      if (res.status === 402) return router.push("/tokens?for=premium_report");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: PremiumItem[] };
      store.setPremium(data.items);
      setPremium(data.items);
      window.dispatchEvent(new Event("cr:tokens"));
    } catch {
      setNotice("프리미엄 리포트를 열지 못했어요. 토큰은 빠지지 않았는지 위의 토큰 버튼에서 확인해 주세요.");
    } finally {
      setPremiumBusy(false);
    }
  }

  if (!profile) return null;
  // 프리미엄을 열었거나 시연 인물이면 격차~실행 전체를 보여 준다. 계산은 브라우저 것이라 화면에서 나누는 것이고, AI 호출과 공유 링크는 서버에서 막는다.
  const demo = isDemoPerson(profile);
  const unlocked = demo || premium !== null;
  const best = report?.worlds.length ? Math.max(...report.worlds.map((w) => w.fit)) : 0;
  const leaders = report?.worlds.filter((w) => w.fit === best) ?? [];
  const runs = times(Object.values(mvs)[0]?.stats.runs ?? 0);
  const cardColumns = report?.worlds.length === 1 ? "" : report?.worlds.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <Screen
      wide
      title="비교 리포트"
      back="/multiverse"
      right={
        <Link href="/me" className="flex min-h-11 flex-none items-center px-2 text-sm font-semibold underline-offset-4 hover:underline print:hidden">
          내 정보
        </Link>
      }
      footer={
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button className="btn-ghost flex-1 px-3 text-sm sm:flex-none sm:px-6 sm:text-base" onClick={() => (downloadCheckin(), setIcsDone(true))} disabled={!report}>
            <CalendarPlus aria-hidden="true" size={18} /> <span className="whitespace-nowrap">체크인 날 달력에 넣기</span>
          </button>
          <button className="btn-primary flex-1 px-3 text-sm sm:flex-none sm:px-6 sm:text-base" onClick={() => (unlocked ? setShareOpen(true) : document.getElementById("premium")?.scrollIntoView({ behavior: "smooth", block: "center" }))} disabled={!report}>
            <Share2 aria-hidden="true" size={18} /> <span className="whitespace-nowrap">상담사에게 공유</span>
          </button>
          <p className="w-full text-cap text-muted" aria-live="polite">
            {icsDone ? "30일 뒤 일정 파일(진로-체크인.ics)을 받았어요. 열면 달력에 들어가요." : "누르면 30일 뒤 체크인 일정 파일을 받아요."}
          </p>
        </div>
      }
    >
      {!report ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted">
          <Typing label="리포트를 만드는 중" />
          <p>살아본 길들을 비교하는 중…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-4 pt-4 sm:gap-8 sm:pt-7 [&>*]:min-w-0">
          <section aria-labelledby="fit">
            <h2 id="fit" className="text-2xl font-extrabold sm:text-3xl">
              내 가치관과 얼마나 맞았을까?
            </h2>
            {profile.values.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-muted">중요하게 생각한 가치</p>
                <ol aria-label="가치관 우선순위" className="flex flex-wrap gap-2">
                  {profile.values.map((value, i) => (
                    <li key={value} className="flex items-center gap-2 rounded-full border border-hair bg-surface px-3 py-1.5 text-sm font-semibold">
                      <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-ground text-cap text-muted">{i + 1}</span>
                      {value}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {leaders.length > 0 ? (
              <div className="mt-6 flex flex-col gap-5 rounded-[24px] border border-lineA/30 bg-[#EDF2FF] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7" data-testid="fit-leader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-lineA">이번 비교에서 점수가 가장 높은 길</p>
                  <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">{leaders.length === 1 ? `${getWorld(leaders[0].worldId).name} 경로가 내 가치관에 가장 가까워요` : `${leaders.map((w) => getWorld(w.worldId).name).join(" · ")} 경로가 공동 최고 점수예요`}</h3>
                  <p className="mt-3 text-sm">정답이 아니라 비교용 점수예요. 배수 대부분이 {T.assumedFull}이라 작은 점수 차이는 큰 뜻이 없어요.</p>
                  <p className="mt-1 text-sm text-muted">가치관, 성격, {runs}번 살아본 결과(합격·만족·스트레스)를 합쳐 계산했어요.</p>
                </div>
                <div className="flex shrink-0 items-baseline gap-3 border-t border-lineA/20 pt-4 sm:block sm:min-w-32 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-center">
                  <p className="num text-4xl font-extrabold text-lineA">
                    {best}
                    <span className="ml-1 text-xl">점</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">100점 만점 · 비교용</p>
                </div>
              </div>
            ) : (
              <p className="card mt-6 p-5 text-muted">비교할 진로가 없어요. {T.lineMap}에서 진로를 선택해 주세요.</p>
            )}
          </section>

          <section aria-labelledby="compare">
            <h2 id="compare" className="text-xl font-bold">
              살아본 진로, 한눈에 비교
            </h2>
            <ul className={`mt-4 grid gap-4 ${cardColumns}`}>
              {report.worlds.map((w) => {
                const world = getWorld(w.worldId);
                const isBest = w.fit === best;
                return (
                  <li key={w.worldId} className="min-w-0 rounded-card border-2 bg-surface p-5 sm:p-6" style={{ borderColor: isBest ? world.color : "#E3E6EB" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <LineBadge world={world} size={28} />
                      <h3 className="text-lg font-bold">{world.name}</h3>
                    </div>
                    <p className="num mt-4 text-4xl font-extrabold">
                      {w.fit}
                      <span className="ml-1 text-xl">점</span>
                      <span className="sr-only"> / 100점</span>
                    </p>
                    <p className="mt-1 text-cap text-muted">가치관 부합도</p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, w.fit))}%`, background: world.color }} />
                    </div>
                    <dl className="mt-5 space-y-4 border-t border-hair pt-5">
                      <div>
                        <dt className="inline-block rounded-md bg-ground px-2 py-1 text-sm font-bold">좋았던 점</dt>
                        <dd className="mt-2 text-base leading-relaxed">{w.good}</dd>
                      </div>
                      <div>
                        <dt className="inline-block rounded-md bg-ground px-2 py-1 text-sm font-bold">힘들었던 점</dt>
                        <dd className="mt-2 text-base leading-relaxed">{w.hard}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 세계선 지도와 겹쳐서 진로마다 한 줄만 두고, 전체 숫자는 접는다. 무료로 다 볼 수 있으니 자물쇠는 안 붙인다. */}
          <section className="card p-5 sm:p-6" aria-labelledby="hundred">
            <h2 id="hundred" className="text-xl font-bold">
              {runs}번 살아본 결과
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {report.worlds.map((w) => {
                const mv = mvs[w.worldId];
                const world = getWorld(w.worldId);
                const gate = mv?.stats.gate;
                if (!mv) return null;
                return (
                  <li key={w.worldId} className="flex min-w-0 items-start gap-2 text-sm">
                    <LineBadge world={world} size={22} />
                    <span className="min-w-0">
                      <span className="font-semibold">{world.short}</span>{" "}
                      <span className="num">
                        {durationLabel(mv.months)} 안에 {gate?.label} <strong>{gate?.share ?? 0}%</strong> <Ci pct={gate?.share ?? 0} n={mv.stats.runs} />
                        {gate?.typicalMonth !== null && gate?.typicalMonth !== undefined ? ` · 보통 ${monthLabel(mv.startYm, gate.typicalMonth)}` : ""}
                      </span>
                      <Link href={`/multiverse?world=${w.worldId}`} className="mt-0.5 flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4">
                        {T.lineMap}에서 자세히 보기 <ArrowRight aria-hidden="true" size={14} />
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
            <details className="group mt-2" data-testid="report-runs">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-muted [&::-webkit-details-marker]:hidden">
                숫자 전부 펼치기 <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <p className="mb-4 mt-2 text-sm text-muted">같은 길을 내 조건과 성향으로 {runs}번 살아봤을 때 어떤 세계로 얼마나 갈라졌는지예요.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {report.worlds.map((w) => (mvs[w.worldId] ? <HundredRuns key={w.worldId} world={getWorld(w.worldId)} mv={mvs[w.worldId]} items={leverMap[w.worldId]} premium={Boolean(premium)} /> : null))}
              </div>
              {report.worlds.map((w) => (
                <LiveLives key={w.worldId} world={getWorld(w.worldId)} />
              ))}
            </details>
          </section>

          {stale ? (
            <div className="card flex flex-col gap-3 p-5" data-testid="report-stale">
              <p className="text-sm">이 리포트를 만든 뒤에 내 정보나 시뮬레이션이 바뀌었어요. 지금 보이는 글은 예전 기준이에요.</p>
              <button className="btn-ghost" onClick={remake} disabled={remaking}>
                {remaking ? "만드는 중…" : "다시 만들기"}
              </button>
            </div>
          ) : null}

          {report.todos[0] ? (
            <section aria-labelledby="next-step" className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden">
              <div className="min-w-0">
                <h2 id="next-step" className="text-sm font-bold text-lineA">
                  이번 주 첫 걸음
                </h2>
                <p className="mt-2 text-xl font-bold">{report.todos[0]}</p>
              </div>
              <a href="#plan" className="btn-primary shrink-0">
                실행 계획 보기 <ArrowDown aria-hidden="true" size={18} />
              </a>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <section className="card p-5 sm:p-6" aria-labelledby="plan">
              <h2 id="plan" className="scroll-mt-20 text-xl font-bold">
                이번 주 실행 계획
              </h2>
              <p className="mt-2 text-sm text-muted">바라는 것부터 걸림돌을 만났을 때의 행동까지 WOOP 방식으로 정리했어요.</p>
              <ol className="mt-5 flex flex-col gap-4">
                {WOOP_STEPS.map((s, i) => (
                  <li key={s.key} className={`flex gap-3 rounded-xl ${s.key === "plan" ? "bg-ground p-4" : ""}`}>
                    <span className="num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink text-cap font-bold text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-muted">{s.label}</p>
                      <p className={s.key === "plan" ? "mt-1 text-lg font-bold" : "mt-1 text-base"}>{report.woop[s.key]}</p>
                      {s.key === "obstacle" && report.woopForks?.length ? (
                        <p className="mt-1 text-cap text-muted" data-testid="woop-forks">
                          자주 만난 갈림길: {report.woopForks.map((f) => `${f.worldName} '${f.label}' ${f.share}%`).join(", ")}(시뮬레이션 값)
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            {unlocked ? <WeekPlan report={report} /> : <FreeTodos todos={report.todos} />}
          </div>

          {selection && unlocked ? (
            <section className="flex flex-col gap-3" aria-labelledby="gap-title">
              <h2 id="gap-title" className="text-xl font-bold">
                진로별 준비 계획
              </h2>
              {report.worlds.map((w) => (
                <details key={w.worldId} className="group card" data-testid="gap-world">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2">
                      <LineBadge world={getWorld(w.worldId)} size={24} />
                      <span className="min-w-0">
                        <span className="block font-bold">{getWorld(w.worldId).name}</span>
                        <span className="block text-cap text-muted">필요한 것, 월별 일정, 증거물</span>
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" size={20} className="shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-hair p-5 sm:p-6">
                    <GapSection profile={profile} world={getWorld(w.worldId)} months={selection.months} startYm={selection.startYm} />
                  </div>
                </details>
              ))}
            </section>
          ) : null}
          {selection && !unlocked && report.worlds[0] ? (
            <details className="group card" data-testid="premium-preview">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block font-bold">프리미엄 미리 보기</span>
                  <span className="block text-cap text-muted">필요한 것과 내 격차 상위 3개</span>
                </span>
                <ChevronDown aria-hidden="true" size={20} className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-hair p-5 sm:p-6">
                <GapSection
                  profile={profile}
                  world={getWorld(report.worlds[0].worldId)}
                  months={selection.months}
                  startYm={selection.startYm}
                  preview={{ goal: `${durationLabel(selection.months)} 안에 ${mvs[report.worlds[0].worldId]?.stats.gate?.label ?? ""} ${mvs[report.worlds[0].worldId]?.stats.gate?.share ?? 0}%` }}
                />
                <p className="mt-3 flex items-center gap-1.5 text-cap text-muted">
                  <Lock aria-hidden="true" size={13} /> 나머지 격차와 일정·증거물·다시 살아 보기·공유는 프리미엄에서 볼 수 있어요.
                </p>
              </div>
            </details>
          ) : null}

          <Premium items={premium} mvs={mvs} ids={report.worlds.map((w) => w.worldId)} busy={premiumBusy} onOpen={openPremium} demo={demo} />

          {!demo && profile.pilot?.survey?.pre && !profile.pilot.withdrawnAt && !profile.pilot.survey.post ? (
            <Link href="/pilot/survey?when=post" className="card flex min-h-[56px] items-center justify-between gap-3 border-[#0B6B4B] p-5" data-testid="pilot-post-link">
              <span>
                <span className="block text-base font-bold">파일럿 마무리 설문</span>
                <span className="block text-cap text-muted">처음과 같은 질문 3개와 짧은 답 하나예요.</span>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
          <Programs region={profile.life.region} />
        </div>
      )}
      {notice ? (
        <p role="status" className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_#E3E6EB]">
          {notice}
        </p>
      ) : null}
      {report && selection && unlocked ? <SharePanel open={shareOpen} onClose={() => setShareOpen(false)} profile={profile} selection={selection} report={report} mvs={mvs} /> : null}
    </Screen>
  );
}

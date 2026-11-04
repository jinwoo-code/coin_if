"use client";
// 5. 실행 계획과 사후 관리: 비교 리포트 + WOOP 실행 계획 + 이번 주 할 일 + 체크인
import { CalendarPlus, Check, Copy, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ci, LineBadge, LiveNotice, RangeRow, Screen, Typing, won } from "@/components/ui";
import { times } from "@/lib/ci";
import { satText } from "@/lib/format";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { computeLevers } from "@/lib/levers-client";
import { hasSupabase } from "@/lib/supabase/config";
import { store } from "@/lib/store";
import { runKey } from "@/lib/sync";
import type { Lever, Multiverse, PremiumItem, Profile, Report, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";
import { MyData } from "@/components/my-data";

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
        <div className="rounded-2xl bg-ground p-3">
          <dt className="text-cap text-muted">만족하며 끝남</dt>
          <dd className="num text-xl font-extrabold">
            {st.satisfiedShare}% <Ci pct={st.satisfiedShare} n={st.runs} className="block" />
          </dd>
        </div>
        <div className="rounded-2xl bg-ground p-3">
          <dt className="text-cap text-muted">스트레스 높게 끝남</dt>
          <dd className="num text-xl font-extrabold">
            {st.stressedShare}% <Ci pct={st.stressedShare} n={st.runs} className="block" />
          </dd>
        </div>
      </dl>
      <p className="label mt-4">가장 많이 간 세계선</p>
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
      <div className="mt-4 grid gap-2">
        <RangeRow label="모은 돈" {...st.final.money} color={world.color} money max={Math.max(st.final.money.p90, 1000)} />
        <RangeRow label="만족도" {...st.final.satisfaction} color={world.color} />
      </div>
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
        세계선 지도 보기
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
    <section className="card p-5 sm:p-6" aria-labelledby="programs">
      <h2 id="programs" className="text-xl font-bold">
        지금 신청할 수 있는 고용센터 프로그램
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5">
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
      <p className="mt-3 text-cap text-muted">고용24 구직자취업역량 강화프로그램 정보예요.</p>
    </section>
  );
}

// 같은 결과의 리포트 요청은 하나만 보낸다. 개발 모드(Strict Mode)는 화면을 두 번 그려 AI를 두 번 부르고, 원가 실측도 두 배가 된다.
let reportInflight: { key: string; promise: Promise<Report> } | null = null;
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
function Premium({ items, mvs, ids, busy, onOpen }: { items: PremiumItem[] | null; mvs: Record<string, Multiverse>; ids: string[]; busy: boolean; onOpen: () => void }) {
  // 학교 무제한이면 토큰이 줄지 않으니 버튼에 토큰 수 대신 그렇게 쓴다.
  const [unlimited, setUnlimited] = useState(false);
  useEffect(() => {
    if (items || !hasSupabase()) return;
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUnlimited(Boolean(d.unlimited)))
      .catch(() => setUnlimited(false));
  }, [items]);
  if (!items)
    return (
      <section className="card p-5 sm:p-6 print:hidden" aria-labelledby="premium">
        <h2 id="premium" className="flex items-center gap-2 text-xl font-bold">
          <Lock aria-hidden="true" size={18} /> 프리미엄 리포트
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>갈라진 세계선 전부를 나란히 비교한 표</li>
          <li>바꿀 수 있는 것 전체(조건을 바꿔 다시 살아본 결과)</li>
          <li>자주 막히는 길로 가고 있을 때 할 일</li>
          <li>PDF로 저장해서 상담사에게 가져가기</li>
        </ul>
        {hasSupabase() ? (
          <button className="btn-primary mt-5 w-full" onClick={onOpen} disabled={busy}>
            {busy ? "만드는 중…" : `프리미엄 리포트 열기 · ${unlimited ? "학교 무제한" : "토큰 5개"}`}
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
        <button className="chip print:hidden" onClick={() => window.print()}>
          <Printer aria-hidden="true" size={16} /> PDF로 저장
        </button>
      </div>
      {ids.map((id) => {
        const world = getWorld(id);
        const mv = mvs[id];
        if (!mv) return null;
        return (
          <div key={id} className="mt-5 break-inside-avoid">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <LineBadge world={world} size={22} /> {world.name}: 세계선 전체
            </h3>
            <div className="-mx-1 mt-2 overflow-x-auto px-1">
              <table className="num w-full min-w-[480px] text-left text-sm">
                <thead className="text-cap text-muted">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">세계선</th>
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
      <p className="mt-1 text-cap text-muted">만족하며 끝난 비율이 가장 낮은 세계선이에요. 할 일은 AI가 내 조건에 맞춰 쓴 제안이에요.</p>
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

export default function ReportPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mvs, setMvs] = useState<Record<string, Multiverse>>({});
  const [leverMap, setLeverMap] = useState<Record<string, Lever[]>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [premium, setPremium] = useState<PremiumItem[] | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const p = store.getProfile();
    const s = store.getSelection();
    const m = store.getMultiverses();
    if (!p || !s || !m) {
      router.replace("/simulate");
      return;
    }
    setProfile(p);
    setMvs(m);
    // 바꿀 수 있는 것: 브라우저에서 조건을 바꿔 가며 다시 살아본다.
    // 1,000번씩 여러 번 다시 사는 일이라 Web Worker에서(lib/levers-client.ts)
    Promise.all(s.worldIds.map((id) => computeLevers(p, id, s.months, s.startYm).catch(() => [] as Lever[]))).then((all) => setLeverMap(Object.fromEntries(s.worldIds.map((id, i) => [id, all[i]]))));
    setPremium(store.getPremium());
    const saved = store.getReport();
    if (saved && saved.worlds.every((w) => m[w.worldId])) {
      setReport(saved);
      return;
    }
    const active = store.getActive();
    const scenes: Record<string, SimEvent[]> = Object.fromEntries(s.worldIds.map((id) => [id, store.getLine(id, active[id] ?? "") ?? []]));
    requestReport(Object.values(m).map(runKey).sort().join("|"), { profile: p, multiverses: m, scenes })
      .then((rep: Report) => {
        store.setReport(rep);
        setReport(rep);
      })
      .catch(() => setNotice("리포트를 만들지 못했어요. 새로고침해 주세요."));
  }, [router]);

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

  async function share() {
    if (!profile || !report) return;
    const text = [
      `[진로 리허설 결과] ${profile.name} (${profile.major})`,
      `고민: ${profile.dilemma}`,
      ...report.worlds.map((w) => `- ${getWorld(w.worldId).name}: 가치관 부합도 ${w.fit}점 / 좋았던 점: ${w.good} / 힘든 점: ${w.hard}`),
      `실행 계획: ${report.woop.plan}`,
      `이번 주 할 일: ${report.todos.join(", ")}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("결과를 복사했어요. 상담 신청할 때 붙여 넣어 주세요.");
    } catch {
      setNotice("복사하지 못했어요. 화면을 캡처해서 공유해 주세요.");
    }
  }

  if (!profile) return null;
  const best = report ? Math.max(...report.worlds.map((w) => w.fit)) : 0;

  return (
    <Screen
      wide
      title="비교 리포트"
      back="/multiverse"
      footer={
        <div className="flex gap-2 sm:justify-end">
          <button className="btn-ghost flex-1 sm:flex-none" onClick={downloadCheckin} disabled={!report}>
            <CalendarPlus aria-hidden="true" size={18} /> 한 달 뒤 체크인
          </button>
          <button className="btn-primary flex-1 sm:flex-none" onClick={share} disabled={!report}>
            <Copy aria-hidden="true" size={18} /> 상담사에게 공유
          </button>
        </div>
      }
    >
      {!report ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted">
          <Typing label="리포트를 만드는 중" />
          <p>살아본 길들을 비교하는 중…</p>
        </div>
      ) : (
        <div className="grid gap-5 pt-2 lg:grid-cols-[1.2fr_1fr] lg:gap-6">
          <div className="flex flex-col gap-5">
            <section className="card p-5 sm:p-6" aria-labelledby="fit">
              <h2 id="fit" className="text-xl font-bold">
                내 가치관과 얼마나 맞았을까
              </h2>
              <p className="mt-1 text-sm text-muted">
                {profile.values.join(" > ")} 순서의 가치관, 성격, 그리고 {times(Object.values(mvs)[0]?.stats.runs ?? 0)}번 살아본 결과(합격·만족·스트레스)를 합쳐 계산했어요. 정답이 아니라 비교용 점수예요.
              </p>
              <ul className="mt-5 flex flex-col gap-4">
                {report.worlds.map((w) => {
                  const world = getWorld(w.worldId);
                  return (
                    <li key={w.worldId} className="flex items-center gap-3">
                      <LineBadge world={world} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-base font-bold">{world.name}</span>
                          <span className="num text-2xl font-extrabold">
                            {w.fit}
                            <span className="text-sm font-semibold text-muted">점</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                          <span className="block h-full rounded-full" style={{ width: `${w.fit}%`, background: world.color, opacity: w.fit === best ? 1 : 0.55 }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="hundred">
              <h2 id="hundred" className="text-xl font-bold">
                {times(Object.values(mvs)[0]?.stats.runs ?? 0)}번 살아본 결과
              </h2>
              <p className="mt-1 text-sm text-muted">같은 길을 내 조건과 성향으로 {times(Object.values(mvs)[0]?.stats.runs ?? 0)}번 살아봤을 때 어떤 세계로 얼마나 갈라졌는지예요.</p>
              {Object.values(mvs)[0]?.live ? <LiveNotice /> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {report.worlds.map((w) => (mvs[w.worldId] ? <HundredRuns key={w.worldId} world={getWorld(w.worldId)} mv={mvs[w.worldId]} items={leverMap[w.worldId]} premium={Boolean(premium)} /> : null))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              {report.worlds.map((w) => {
                const world = getWorld(w.worldId);
                return (
                  <section key={w.worldId} className="rounded-card p-5" style={{ background: `${world.color}12` }} aria-label={`${world.name} 요약`}>
                    <div className="flex items-center gap-2">
                      <LineBadge world={world} size={22} />
                      <h3 className="text-base font-bold">{world.short}</h3>
                    </div>
                    <p className="label mt-3">좋았던 점</p>
                    <p className="mt-0.5 text-sm">{w.good}</p>
                    <p className="label mt-3">힘들었던 점</p>
                    <p className="mt-0.5 text-sm">{w.hard}</p>
                  </section>
                );
              })}
            </div>

            <Premium items={premium} mvs={mvs} ids={report.worlds.map((w) => w.worldId)} busy={premiumBusy} onOpen={openPremium} />
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-card bg-ink p-5 text-white sm:p-6" aria-labelledby="plan">
              <h2 id="plan" className="text-xl font-bold">
                이번 주 실행 계획
              </h2>
              <p className="mt-1 text-sm text-white/70">목표 달성 연구로 효과가 확인된 WOOP 방식으로 정리했어요.</p>
              <ol className="mt-5 flex flex-col gap-4">
                {WOOP_STEPS.map((s, i) => (
                  <li key={s.key} className="flex gap-3">
                    <span className={`num flex h-7 w-7 flex-none items-center justify-center rounded-full text-cap font-bold ${s.key === "plan" ? "bg-white text-ink" : "border border-white/40"}`}>{i + 1}</span>
                    <div>
                      <p className="text-cap font-semibold text-white/70">{s.label}</p>
                      <p className={s.key === "plan" ? "mt-0.5 text-lg font-bold" : "mt-0.5 text-base"}>{report.woop[s.key]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card p-5 sm:p-6" aria-labelledby="todo">
              <h2 id="todo" className="text-xl font-bold">
                이번 주 할 일
              </h2>
              <ul className="mt-3 flex flex-col">
                {report.todos.map((t, i) => (
                  <li key={i}>
                    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-hair text-base last:border-0">
                      <input type="checkbox" className="peer sr-only" checked={Boolean(done[i])} onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))} />
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 border-hair text-transparent transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                      >
                        <Check size={15} strokeWidth={3} />
                      </span>
                      <span className={done[i] ? "text-muted line-through" : ""}>{t}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-cap text-muted">한 달 뒤 체크인에서 해 본 일을 입력하면 시뮬레이션을 다시 돌려 볼 수 있어요.</p>
            </section>
            <Programs region={profile.life.region} />
          </div>
        </div>
      )}
      {notice ? (
        <p role="status" className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_#E3E6EB]">
          {notice}
        </p>
      ) : null}
      <div className="print:hidden">
        <MyData />
      </div>
    </Screen>
  );
}

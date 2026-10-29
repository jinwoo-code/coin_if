"use client";
// 5. 실행 계획과 사후 관리: 비교 리포트 + WOOP 실행 계획 + 이번 주 할 일 + 체크인
import { CalendarPlus, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LineBadge, RangeRow, Screen, Typing, won } from "@/components/ui";
import { durationLabel, monthLabel } from "@/lib/calendar";
import { buildMultiverse, levers } from "@/lib/multiverse";
import { store } from "@/lib/store";
import type { Lever, Multiverse, Profile, Report, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

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

// 100번 살아본 결과: 관문(합격·취업), 세계선 상위 3개, 바꿀 수 있는 것
function HundredRuns({ world, mv, items }: { world: WorldTemplate; mv: Multiverse; items: Lever[] | undefined }) {
  const st = mv.stats;
  return (
    <section className="rounded-card border border-hair bg-surface p-5" aria-label={`${world.name} 100번 살아본 결과`}>
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
            <strong className="text-xl font-extrabold">{st.gate?.share ?? 0}번</strong> / {st.runs}번
            {st.gate?.typicalMonth !== null && st.gate?.typicalMonth !== undefined ? <span className="text-muted">, 보통 {monthLabel(mv.startYm, st.gate.typicalMonth)}</span> : null}
          </dd>
        </div>
        <div className="rounded-2xl bg-ground p-3">
          <dt className="text-cap text-muted">만족하며 끝남</dt>
          <dd className="num text-xl font-extrabold">{st.satisfiedShare}%</dd>
        </div>
        <div className="rounded-2xl bg-ground p-3">
          <dt className="text-cap text-muted">스트레스 높게 끝남</dt>
          <dd className="num text-xl font-extrabold">{st.stressedShare}%</dd>
        </div>
      </dl>
      <p className="label mt-4">가장 많이 간 세계선</p>
      <ul className="mt-2 flex flex-col gap-2">
        {mv.lines.slice(0, 3).map((l) => (
          <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{l.title}</span>
            <span className="num text-cap font-semibold">{l.count}%</span>
            <span className="col-span-2 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${l.count}%`, background: world.color }} />
              </span>
              <span className="num text-cap text-muted">만족 {l.satisfiedShare}% · {won(l.final.money.p50)}</span>
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
          {items.map((l) => (
            <li key={l.title} className="text-sm">
              <span className="font-semibold">{l.title}</span>
              <span className="num block text-cap text-muted">
                {l.metric}: {l.before} → <strong className="text-ink">{l.after}</strong>
              </span>
            </li>
          ))}
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
    window.setTimeout(() => {
      const out: Record<string, Lever[]> = {};
      for (const id of s.worldIds) {
        const w = getWorld(id);
        const { paths } = buildMultiverse(p, w, s.months, s.startYm);
        out[id] = levers(p, w, s.months, s.startYm, paths);
      }
      setLeverMap(out);
    }, 60);
    const saved = store.getReport();
    if (saved && saved.worlds.every((w) => m[w.worldId])) {
      setReport(saved);
      return;
    }
    const active = store.getActive();
    const scenes: Record<string, SimEvent[]> = Object.fromEntries(s.worldIds.map((id) => [id, store.getLine(id, active[id] ?? "") ?? []]));
    fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: p, multiverses: m, scenes }) })
      .then((res) => res.json())
      .then((rep: Report) => {
        store.setReport(rep);
        setReport(rep);
      })
      .catch(() => setNotice("리포트를 만들지 못했어요. 새로고침해 주세요."));
  }, [router]);

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
              <p className="mt-1 text-sm text-muted">{profile.values.join(" > ")} 순서의 가치관, 성격, 그리고 100번 살아본 결과(합격·만족·스트레스)를 합쳐 계산했어요. 정답이 아니라 비교용 점수예요.</p>
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
                100번 살아본 결과
              </h2>
              <p className="mt-1 text-sm text-muted">같은 길을 내 조건과 성향으로 100번 살아봤을 때 어떤 세계로 얼마나 갈라졌는지예요.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {report.worlds.map((w) => (mvs[w.worldId] ? <HundredRuns key={w.worldId} world={getWorld(w.worldId)} mv={mvs[w.worldId]} items={leverMap[w.worldId]} /> : null))}
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
                      <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 border-hair text-transparent transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
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
    </Screen>
  );
}

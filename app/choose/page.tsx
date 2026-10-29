"use client";
// 2. 진로 탐색: 전공과 가치관으로 추천된 진로 + 전체 진로 검색. 고른 진로의 준비 상태를 묻고, 살아볼 기간을 고른다.
import { Check, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LineBadge, Screen } from "@/components/ui";
import { nextMonthYm, planStations } from "@/lib/calendar";
import { waGwa } from "@/lib/josa";
import { answerOf, READINESS } from "@/lib/readiness";
import { store } from "@/lib/store";
import type { Profile, WorldTemplate } from "@/lib/types";
import { FAMILIES, getWorld, majorMatch, preFit, recommend, suggestThirdPath, WORLDS } from "@/lib/worlds";
import { Seg } from "../interview/form";

const PERIODS = [
  { months: 6, label: "6개월" },
  { months: 12, label: "1년" },
  { months: 36, label: "3년" },
  { months: 60, label: "5년" },
  { months: 120, label: "10년" },
];

const KIND: Record<WorldTemplate["archetype"], string> = {
  open: "수시·공채 취업",
  public: "공공기관 공채",
  exam: "시험 합격",
  license: "면허 따고 취업",
  portfolio: "포트폴리오·프리랜서",
  trade: "기술·현장직",
  grad: "대학원 진학",
  startup: "창업",
};

function PathCard({ world, on, fit, related, onToggle }: { world: WorldTemplate; on: boolean; fit: number; related: boolean; onToggle: () => void }) {
  return (
    <button
      aria-pressed={on}
      onClick={onToggle}
      className={`group flex w-full items-center gap-4 rounded-card border-2 bg-surface p-4 text-left transition-[border-color] duration-150 ${on ? "" : "border-hair hover:border-[#C9CDD4]"}`}
      style={on ? { borderColor: world.color } : undefined}
    >
      <LineBadge world={world} size={36} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-bold">{world.name}</span>
        <span className="text-sm text-muted">
          {world.family} · {KIND[world.archetype]}
          {related ? " · 내 전공 관련" : ""}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-cap text-muted">
          <span className="h-1 w-16 overflow-hidden rounded-full bg-hair" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${fit}%`, background: world.color }} />
          </span>
          <span className="num">나와 {fit}% 맞음</span>
          {world.curated ? <span className="rounded bg-ground px-1.5 py-0.5 font-semibold text-ink">상세판</span> : null}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-colors ${on ? "border-transparent text-white" : "border-hair text-transparent"}`}
        style={on ? { background: world.color } : undefined}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    </button>
  );
}

export default function ChoosePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [months, setMonths] = useState(36);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string>("추천");
  const [readiness, setReadiness] = useState<Record<string, number>>({});
  const [stdMajors, setStdMajors] = useState<string[]>([]); // 고용24 학과정보로 찾은 표준 학과명

  useEffect(() => {
    const p = store.getProfile();
    if (!p) router.replace("/interview");
    else {
      setProfile(p);
      setReadiness(p.readiness);
      if (p.major)
        fetch(`/api/major?q=${encodeURIComponent(p.major)}`)
          .then((r) => r.json())
          .then((d) => setStdMajors(d.names ?? []))
          .catch(() => {});
    }
  }, [router]);

  const recs = useMemo(() => (profile ? recommend(profile, 6, stdMajors) : []), [profile, stdMajors]);
  const third = useMemo(() => (profile && chosen.length >= 2 ? suggestThirdPath(profile, chosen.slice(0, 2)) : null), [profile, chosen]);

  if (!profile) return null;

  const fitOf = (w: WorldTemplate) => Math.round(preFit(w, profile) * 100);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  const q = query.trim().replace(/\s/g, "");
  const list = q
    ? WORLDS.filter((w) => (w.name + w.short + w.family + w.majors.join("")).replace(/\s/g, "").includes(q))
    : family === "추천"
      ? recs
      : WORLDS.filter((w) => w.family === family);
  const chosenWorlds = chosen.map(getWorld);
  // 고른 진로들이 묻는 준비도 질문(중복 없이)
  const questions = Array.from(new Set(chosenWorlds.flatMap((w) => w.readiness))).filter((id) => READINESS[id]);
  const startYm = nextMonthYm();
  const plan = planStations(months, startYm);
  const periodLabel = PERIODS.find((p) => p.months === months)?.label ?? `${months}개월`;

  function start() {
    if (!profile) return;
    store.setProfile({ ...profile, readiness });
    store.setSelection({ worldIds: chosen, months, startYm });
    store.clearResults();
    router.push("/simulate");
  }

  return (
    <Screen
      title="진로와 기간 고르기"
      back="/interview"
      footer={
        <button className="btn-primary w-full" disabled={chosen.length < 2} onClick={start}>
          {chosen.length < 2 ? `진로를 ${2 - chosen.length}개 더 골라 주세요` : `${chosen.length}개 진로를 ${periodLabel} 살아보기`}
        </button>
      }
    >
      <section aria-labelledby="paths" className="pt-2">
        <h2 id="paths" className="text-xl font-bold">
          어떤 길을 비교해 볼까요?
        </h2>
        <p className="mt-1 text-sm text-muted">
          {profile.major ? `${waGwa(profile.major)} 내 가치관으로 먼저 추천했어요. ` : ""}진로 {WORLDS.length}개 중 2~3개를 골라 주세요.
        </p>

        {chosenWorlds.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="고른 진로">
            {chosenWorlds.map((w) => (
              <button key={w.id} onClick={() => toggle(w.id)} className="chip min-h-[36px] text-sm font-semibold" style={{ borderColor: w.color }}>
                <LineBadge world={w} size={18} /> {w.short} ✕
              </button>
            ))}
          </div>
        ) : null}

        <label htmlFor="q" className="relative mt-4 block">
          <span className="sr-only">진로 검색</span>
          <Search aria-hidden="true" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input id="q" className="field w-full pl-11" placeholder="직업·전공 검색 (예: 간호, 디자인, 회계)…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
        {!q ? (
          <div role="tablist" aria-label="계열" className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {["추천", ...FAMILIES].map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={family === f}
                onClick={() => setFamily(f)}
                className={`min-h-[40px] flex-none rounded-full border px-3.5 text-sm transition-colors ${family === f ? "border-ink bg-ink font-semibold text-white" : "border-hair bg-surface"}`}
              >
                {f}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {list.length === 0 ? <p className="text-sm text-muted">찾는 진로가 아직 없어요. 비슷한 진로를 골라 보세요.</p> : null}
          {list.map((w) => (
            <PathCard key={w.id} world={w} on={chosen.includes(w.id)} fit={fitOf(w)} related={majorMatch(w, [profile.major, ...stdMajors].join(" ")) > 0} onToggle={() => toggle(w.id)} />
          ))}
        </div>
      </section>

      {third && !chosen.includes(third.id) ? (
        <section aria-labelledby="third" className="mt-6 animate-rise rounded-card border-2 border-dashed p-5" style={{ borderColor: third.color }}>
          <div className="flex items-center gap-3">
            <LineBadge world={third} size={36} outline />
            <div>
              <p className="label">생각 못 했을 수도 있는 제3의 길</p>
              <h2 id="third" className="text-lg font-bold">
                {third.name}
              </h2>
            </div>
            <span className="num ml-auto text-sm font-semibold">{fitOf(third)}%</span>
          </div>
          <p className="mt-3 text-base">{third.thirdPathReason}</p>
          <button onClick={() => toggle(third.id)} className="chip mt-4 font-semibold">
            <Plus aria-hidden="true" size={16} /> 이 길도 살아보기
          </button>
        </section>
      ) : null}

      {questions.length ? (
        <section aria-labelledby="ready" className="card mt-8 animate-rise p-5">
          <h2 id="ready" className="text-lg font-bold">
            고른 진로의 준비 상태
          </h2>
          <p className="mt-1 text-sm text-muted">합격·취업 확률에 바로 쓰여요. 모르면 그대로 두세요.</p>
          <div className="mt-4 flex flex-col gap-4">
            {questions.map((id) => {
              const qq = READINESS[id];
              const who = chosenWorlds.filter((w) => w.readiness.includes(id)).map((w) => w.short).join("·");
              return (
                <Seg
                  key={id}
                  label={`${qq.label} (${who})`}
                  value={answerOf(readiness, id)}
                  options={qq.options.map((o, i) => ({ v: i, t: o.t }))}
                  onChange={(v) => setReadiness((r) => ({ ...r, [id]: v }))}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="period" className="mt-8">
        <h2 id="period" className="text-xl font-bold">
          얼마나 살아볼까요?
        </h2>
        <div role="radiogroup" aria-labelledby="period" className="mt-4 grid grid-cols-5 gap-1 rounded-full bg-hair/70 p-1">
          {PERIODS.map((p) => {
            const on = months === p.months;
            return (
              <button
                key={p.months}
                role="radio"
                aria-checked={on}
                onClick={() => setMonths(p.months)}
                className={`h-11 rounded-full text-sm transition-colors ${on ? "bg-ink font-bold text-white" : "font-medium text-muted hover:text-ink"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="num mt-3 text-sm text-muted">
          {plan.labels[0].split(" ")[0]} {startYm.slice(5).replace(/^0/, "")}월부터 한 달씩, 진로마다 100번 살아봐요. 화면에는 {plan.size === 1 ? "한 달" : `${plan.size}개월`}씩 묶어 {plan.count}개 역으로 보여 줘요.
        </p>
      </section>
    </Screen>
  );
}

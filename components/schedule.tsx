"use client";
// 리포트 월별 일정. 계산은 lib/schedule.ts(AI 없음), 고친 값은 이 기기에만.
import { useEffect, useMemo, useRef, useState } from "react";
import { CI_NOTE, Ci } from "@/components/ui";
import { durationLabel, monthLabel } from "@/lib/calendar";
import type { PriorityRow } from "@/lib/gap";
import { computePlanRerun } from "@/lib/levers-client";
import { planHorizon, planInput, type PlanRerun } from "@/lib/plan-sim";
import { retrainMonths, tuitionNote } from "@/lib/retrain";
import { buildPlan, itemsToCut, overText, rangeLabel, type Plan, type PlanEdits, type PlanRow } from "@/lib/schedule";
import { store } from "@/lib/store";
import type { Profile, WorldTemplate } from "@/lib/types";
import { W } from "@/lib/weights";
import { T, plain } from "@/lib/copy";

interface Course {
  title: string;
  org: string;
  url?: string;
  start?: string;
  rate6: number | null;
}

function Training({ q }: { q: string }) {
  const [state, setState] = useState<"idle" | "busy" | "none" | "done">("idle");
  const [items, setItems] = useState<Course[]>([]);
  const open = () => {
    setState("busy");
    fetch(`/api/training?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { items: Course[] }) => {
        setItems(d.items);
        setState(d.items.length ? "done" : "none");
      })
      .catch(() => setState("none"));
  };
  if (state === "idle" || state === "busy")
    return (
      <button type="button" disabled={state === "busy"} className="mt-1 min-h-11 text-cap font-medium underline" onClick={open}>
        {state === "busy" ? "찾는 중이에요…" : "훈련과정 찾아보기(내일배움카드)"}
      </button>
    );
  if (state === "none") return <p className="mt-1 text-cap text-muted">지금 찾은 훈련과정이 없어요.</p>;
  return (
    <ul className="mt-1 flex flex-col gap-1 text-cap">
      {items.map((c) => (
        <li key={c.title}>
          {c.url ? (
            <a className="underline" href={c.url} target="_blank" rel="noreferrer">
              {c.title}
            </a>
          ) : (
            c.title
          )}{" "}
          <span className="text-muted">
            · {c.org} · {c.rate6 === null ? "6개월 취업률 아직 없음" : `6개월 취업률 ${c.rate6}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bar({ r, months }: { r: PlanRow; months: number }) {
  const span = Math.max(months, r.end + 1);
  const left = (r.start / span) * 100;
  const width = Math.max(3, ((r.end - r.start + 1) / span) * 100);
  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-ground" aria-hidden="true">
      <div className="h-full rounded-full bg-ink" style={{ marginLeft: `${left}%`, width: `${Math.min(width, 100 - left)}%`, opacity: r.lane === "practice" ? 0.55 : 1 }} />
    </div>
  );
}

// 합격자 하루 평균 10.2시간 × 7(수험생 평균은 8.7시간). 9급 공무원 조사 값이라 다른 시험에도 같다는 근거는 없다.
const STUDY_WEEKLY = 71;
const STUDY_SOURCE = { label: "이대중 외 「7급, 9급 공무원시험 합격자 실태에 관한 연구」(2016 조사)", url: "https://v.daum.net/v/738XCOSgCW" };

// 계획대로 했다고 보고 다시 살아 보기. 무거워서 Worker에서, 누를 때만. 결과는 이 기기에만.
function PlanRerunBox({ plan, rows, profile, world, startYm, onEdit }: { plan: Plan; rows: PriorityRow[]; profile: Profile; world: WorldTemplate; startYm: string; onEdit: (e: Partial<PlanEdits>) => void }) {
  const months = planHorizon(plan);
  const input = useMemo(() => planInput(plan, rows, world), [plan, rows, world]);
  const sig = JSON.stringify([input, months, startYm, profile.readiness, profile.spec, profile.life]);
  const [saved, setSaved] = useState(() => store.getPlanReruns()[world.id] ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = () => {
    setBusy(true);
    setFailed(false);
    computePlanRerun(profile, world.id, months, startYm, input)
      .then((result) => {
        if (!result) return setFailed(true);
        const next = { sig, result };
        setSaved(next);
        store.setPlanReruns({ ...store.getPlanReruns(), [world.id]: next });
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };
  // 기간·공부 시간 버튼: 일정을 고친 뒤 새 계획으로 바로 다시 돈다.
  const rerunNext = useRef(false);
  const editAndRun = (e: Partial<PlanEdits>) => {
    rerunNext.current = true;
    onEdit(e);
  };
  useEffect(() => {
    if (!rerunNext.current) return;
    rerunNext.current = false;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const r: PlanRerun | null = saved?.result ?? null;
  const stale = saved !== null && saved.sig !== sig;
  const nothing = r !== null && r.applied.length === 0 && r.weekly === null;

  return (
    <div className="mt-4 rounded-lg bg-ground p-3" data-testid={`plan-rerun-${world.id}`}>
      <p className="text-sm font-bold">이 계획대로 다시 살아 보기</p>
      <p className="mt-1 text-cap text-muted">항목을 끝낸 달부터 그 조건을 갖췄다고 보고 1,000번 다시 살아요. 같은 시드로 지금 조건과 비교해요.</p>
      <button type="button" disabled={busy} className="mt-2 min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium disabled:opacity-60" onClick={run}>
        {busy ? "1,000번 다시 사는 중이에요…" : r ? "지금 계획으로 다시 계산하기" : "다시 살아 보기"}
      </button>
      {failed ? <p className="mt-2 text-cap font-medium" role="alert">계산하지 못했어요. 다시 눌러 주세요.</p> : null}
      {r ? (
        <div className="mt-3" aria-live="polite">
          {stale ? <p className="mb-2 text-cap font-medium">계획이 바뀌었어요. 아래는 바꾸기 전 계획의 결과예요.</p> : null}
          <p className="text-sm">
            이 계획대로 하면 {durationLabel(r.months)} 안에 {r.label}
          </p>
          <p className="mt-1 text-lg font-bold">
            <span className="num">{r.before}%</span> <Ci pct={r.before} n={r.n} /> → <span className="num">{r.after}%</span> <Ci pct={r.after} n={r.n} />
          </p>
          {nothing && r.notInSim.length ? <p className="mt-1 text-cap font-medium">이 계획의 항목은 시뮬레이션이 보는 조건을 바꾸지 않아요. 숫자가 같아도 소용없는 항목이라는 뜻은 아니에요.{world.archetype === "exam" ? " 시험형은 주당 쓸 수 있는 시간을 고치면 달라져요." : ""}</p> : null}
          {nothing && !r.notInSim.length ? <p className="mt-1 text-cap font-medium">이 기간 안에 끝나는 항목이 없어요. 계획 기간을 늘리면 달라질 수 있어요.</p> : null}
          {!nothing && r.before === r.after ? <p className="mt-1 text-cap font-medium">이 기간 안에는 숫자가 달라지지 않았어요. 계획 기간을 늘리면 달라질 수 있어요.</p> : null}
          {r.after === 0 && plan.schoolMonths > 0 && !stale ? (
            <div className="mt-2" data-testid={`plan-extend-${world.id}`}>
              <p className="text-cap font-medium">학과 과정 {plan.schoolMonths}개월 때문에 {durationLabel(r.months)} 안에는 닿지 못해요. 기간을 늘려 볼까요?</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {[60, 120].filter((m) => m > r.months).map((m) => (
                  <button key={m} type="button" disabled={busy} className="min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium disabled:opacity-60" onClick={() => editAndRun({ months: m })}>
                    {durationLabel(m)}으로 보기
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {world.archetype === "exam" && !stale && plan.weekly < STUDY_WEEKLY ? (
            <div className="mt-2">
              <button type="button" disabled={busy} className="min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium disabled:opacity-60" onClick={() => editAndRun({ weekly: STUDY_WEEKLY })}>
                합격자 평균 공부량(주 {STUDY_WEEKLY}시간)으로 해 보기
              </button>
              <p className="mt-1 text-cap text-muted">
                합격자 하루 평균 10.2시간 × 7일(수험생 평균은 8.7시간).{" "}
                <a className="underline" href={STUDY_SOURCE.url} target="_blank" rel="noreferrer">
                  {STUDY_SOURCE.label}
                </a>
                . 9급 합격자 조사라 다른 시험에 그대로 맞는다는 근거는 없어요.
              </p>
            </div>
          ) : null}
          {r.weekly || r.applied.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-cap">
              {r.weekly ? <li>처음부터: 주당 공부 {r.weekly.from}시간 → {r.weekly.to}시간</li> : null}
              {r.applied.map((a) => (
                <li key={a.label}>
                  {monthLabel(startYm, a.month)}부터: {a.title} <span className="text-muted">({plain(a.label)})</span>
                </li>
              ))}
            </ul>
          ) : null}
          {r.notInSim.length ? <p className="mt-2 text-cap text-muted">시뮬레이션에 안 들어가는 줄: {r.notInSim.join(", ")}</p> : null}
          {r.late.length ? <p className="mt-1 text-cap text-muted">기간 안에 안 끝나서 뺀 줄: {r.late.join(", ")}</p> : null}
          {r.undated.length ? <p className="mt-1 text-cap text-muted">시점을 정하지 않아 뺀 항목: {r.undated.join(", ")}</p> : null}
          <p className="mt-2 text-cap text-muted">계획을 제때 다 해낸다고 본 값이고, 항목 하나는 조건 한 단계로 쳐요. 자격증·준비도 배수는 대부분 {T.assumedFull}이에요. 합격·취업을 보장하지 않아요. {CI_NOTE}</p>
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleSection({ rows, profile, world, months, startYm }: { rows: PriorityRow[]; profile: Profile; world: WorldTemplate; months: number; startYm: string }) {
  const [edits, setEdits] = useState<PlanEdits>(() => store.getPlanEdits()[world.id] ?? {});
  const save = (next: PlanEdits) => {
    setEdits(next);
    store.setPlanEdits({ ...store.getPlanEdits(), [world.id]: next });
  };
  const plan = useMemo(() => buildPlan(rows, profile, world, months, edits), [rows, profile, world, months, edits]);
  const removedIds = edits.removed ?? [];

  return (
    <div className="mt-5" data-testid={`plan-${world.id}`}>
      <h4 className="text-sm font-bold">월별 일정</h4>
      <p className="mt-1 text-cap text-muted">
        {monthLabel(startYm, 0)}부터 {plan.months}개월. 시간의 {Math.round(W("report.plan.spare") * 100)}%는 여유로 비웠어요({T.assumed}). 시간은 항목마다 NCS 훈련 기준 또는 {T.assumed}이라고 적었어요.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        주당 쓸 수 있는 시간
        <input type="number" min={0} max={100} value={plan.weekly} aria-describedby={`weekly-note-${world.id}`} className="min-h-11 w-20 rounded-lg border border-hair px-2" onChange={(e) => save({ ...edits, weekly: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        시간
      </label>
      <p id={`weekly-note-${world.id}`} className="mt-1 text-cap text-muted">공부 가능 시간에서 알바 시간을 뺀 값이에요.</p>

      {plan.over ? (
        <div className="mt-2 rounded-lg bg-ground p-3" role="status">
          <p className="text-sm font-medium">{overText(plan)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.neededMonths !== null ? (
              <button type="button" className="min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium" onClick={() => save({ ...edits, months: plan.neededMonths! })}>
                기간을 {plan.neededMonths}개월로 늘리기
              </button>
            ) : null}
            <button type="button" className="min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium" onClick={() => save({ ...edits, removed: itemsToCut(rows, profile, world, plan.months, plan.weekly, removedIds) })}>
              뒤쪽 항목 줄이기
            </button>
          </div>
        </div>
      ) : null}

      <ol className="mt-3 flex flex-col gap-3">
        {plan.rows.map((r) => (
          <li key={r.id} className="text-sm">
            <p className="font-medium">
              {r.title}
              {r.lane === "practice" ? <span className="ml-1.5 text-cap font-normal text-muted">공부와 나란히</span> : null}
            </p>
            <p className="text-cap text-muted">
              {rangeLabel(startYm, r)}
              {r.hours ? ` · 약 ${r.hours}시간(${r.hoursOfficial ? "NCS 훈련 기준" : T.assumed})` : ""}
              {r.lane === "school" ? ` · 기간은 ${T.assumed}${retrainMonths(profile, world) ? ` · ${plain(tuitionNote(world.id))}` : ""}` : ""}
              {r.overflow ? " · 계획 기간을 넘겨요" : ""}
            </p>
            <Bar r={r} months={plan.months} />
            {r.examMonth !== null ? (
              <label className="mt-1.5 flex flex-wrap items-center gap-2 text-cap">
                시험 대략적인 위치
                <input
                  type="number"
                  min={0}
                  aria-label={`${r.title} 시험 위치, 시작부터 몇 개월 뒤`}
                  value={r.examMonth}
                  className="min-h-11 w-16 rounded-lg border border-hair px-2"
                  onChange={(e) => save({ ...edits, examMonth: { ...edits.examMonth, [r.id]: Math.max(0, Number(e.target.value) || 0) } })}
                />
                개월 뒤({monthLabel(startYm, r.examMonth)}){r.examTooEarly ? <span className="font-medium">준비가 끝나기 전이에요</span> : null}
              </label>
            ) : null}
            {!r.required && r.lane !== "school" ? (
              <button type="button" className="mr-3 min-h-11 text-cap underline" onClick={() => save({ ...edits, removed: [...removedIds, r.id] })}>
                일정에서 빼기
              </button>
            ) : null}
            {r.searchWord ? <Training q={r.searchWord} /> : null}
          </li>
        ))}
      </ol>

      {plan.milestones.length ? (
        <p className="mt-3 text-cap">
          <span className="font-medium">시간을 정하지 않은 필수·선택 항목: </span>
          {plan.milestones.map((m) => m.title).join(", ")}
        </p>
      ) : null}
      {plan.later.length ? (
        <details className="mt-2 text-sm" data-testid={`plan-later-${world.id}`}>
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">나중에 볼 자격 {plan.later.length}개</summary>
          <p className="text-cap text-muted">우선순위 상위 {W("report.plan.certLimit")}개만 일정에 넣었어요(개수는 {T.assumed}).</p>
          <ul className="mt-1 flex flex-col gap-1">
            {plan.later.map((r) => (
              <li key={r.item.id} className="flex flex-wrap items-center justify-between gap-2 text-cap">
                {r.title}
                <button type="button" className="min-h-11 underline" onClick={() => save({ ...edits, added: [...(edits.added ?? []), r.item.id] })}>
                  일정에 넣기
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {plan.removed.length ? (
        <p className="mt-2 text-cap text-muted">
          뺀 항목: {plan.removed.map((r) => r.title).join(", ")}{" "}
          <button type="button" className="min-h-11 underline" onClick={() => save({ ...edits, removed: [] })}>
            되돌리기
          </button>
        </p>
      ) : null}
      {edits.months || edits.weekly !== undefined || removedIds.length || edits.examMonth || edits.added?.length ? (
        <button type="button" className="mt-1 min-h-11 text-cap underline" onClick={() => save({})}>
          처음 일정으로
        </button>
      ) : null}
      <p className="mt-2 text-cap text-muted">시험 위치는 대략적인 자리예요. 실제 일정은 공식 사이트에서 확인하고 직접 고쳐 주세요.</p>
      <PlanRerunBox plan={plan} rows={rows} profile={profile} world={world} startYm={startYm} onEdit={(e) => save({ ...edits, ...e })} />
    </div>
  );
}

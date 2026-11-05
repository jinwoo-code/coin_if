"use client";
// 리포트 월별 일정. 계산은 lib/schedule.ts(AI 없음), 고친 값은 이 기기에만.
import { useMemo, useState } from "react";
import { monthLabel } from "@/lib/calendar";
import type { PriorityRow } from "@/lib/gap";
import { buildPlan, itemsToCut, overText, rangeLabel, type PlanEdits, type PlanRow } from "@/lib/schedule";
import { store } from "@/lib/store";
import type { Profile, WorldTemplate } from "@/lib/types";
import { W } from "@/lib/weights";

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
        {monthLabel(startYm, 0)}부터 {plan.months}개월. 시간의 {Math.round(W("report.plan.spare") * 100)}%는 여유로 비웠어요(가정값). 시간은 항목마다 NCS 훈련 기준 또는 가정값이라고 적었어요.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        주당 공부 시간
        <input type="number" min={0} max={100} value={plan.weekly} className="min-h-11 w-20 rounded-lg border border-hair px-2" onChange={(e) => save({ ...edits, weekly: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        시간
      </label>

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
              {r.hours ? ` · 약 ${r.hours}시간(${r.hoursOfficial ? "NCS 훈련 기준" : "가정값"})` : ""}
              {r.lane === "school" ? " · 기간은 가정값이고 등록금은 안 넣었어요" : ""}
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
          <p className="text-cap text-muted">우선순위 상위 {W("report.plan.certLimit")}개만 일정에 넣었어요(개수는 가정값).</p>
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
    </div>
  );
}

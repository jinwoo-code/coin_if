// 계획 넣고 다시 살아 보기. 일정의 항목이 끝나는 달부터 그 조건을 갖췄다고 보고 1,000번 다시 돌려, 같은 시드로 전후를 비교한다.
// 계획을 제때 다 해낸다는 가정이고, 조건이 합격·취업에 주는 배수는 대부분 가정값이다.
import type { PlanStage } from "./engine";
import { tweakOf, type PriorityRow } from "./gap";
import { RUNS, runAll, statsOf } from "./multiverse";
import type { RequirementItem } from "./requirements";
import { isSchool, weeklyOf, type Plan } from "./schedule";
import type { Profile, WorldTemplate } from "./types";

const MAX_MONTHS = 120; // 엔진을 10년 넘게 돌리지 않는다. 기간을 더 늘린 일정도 10년까지만 본다.

export interface PlanStep {
  month: number; // 이 달부터 갖춘 것으로 본다
  title: string; // 일정의 줄 이름
  item: RequirementItem;
}
// Worker로 보내는 값(함수 없음)
export interface PlanInput {
  steps: PlanStep[];
  late: string[]; // 기간 안에 안 끝나는 줄
  undated: string[]; // 시점을 정하지 않은 항목
  weekly: number;
}
export interface PlanRerun {
  label: string;
  months: number;
  n: number;
  before: number;
  after: number;
  applied: { month: number; title: string; label: string }[];
  notInSim: string[]; // 시뮬레이션이 보는 조건을 안 바꾸는 줄
  late: string[];
  undated: string[];
  weekly: { from: number; to: number } | null;
}

export const planHorizon = (plan: Plan) => Math.min(plan.months, MAX_MONTHS);

// 일정 → 단계. 자격증은 시험 위치 다음 달, 나머지는 끝난 다음 달부터.
export function planInput(plan: Plan, rows: PriorityRow[], w: WorldTemplate): PlanInput {
  const months = planHorizon(plan);
  const byId = new Map(rows.map((r) => [r.item.id, r]));
  const steps: PlanStep[] = [];
  const late: string[] = [];
  for (const r of plan.rows) {
    const month = Math.max(r.end, r.examMonth ?? 0) + 1;
    if (r.overflow || month >= months) {
      late.push(r.title);
      continue;
    }
    const members = r.id === "school" ? rows.filter((x) => isSchool(x, w)) : (byId.get(r.id)?.members ?? []);
    for (const m of members) steps.push({ month, title: r.title, item: m.item });
  }
  return { steps, late, undated: plan.milestones.map((m) => m.title), weekly: plan.weekly };
}

// 주당 공부 시간을 고친 만큼 하루 공부 시간을 처음부터 바꾼다(엔진이 보는 것은 하루 시간).
function withWeekly(p: Profile, weekly: number): Profile {
  const gap = weekly - weeklyOf(p);
  return gap === 0 ? p : { ...p, life: { ...p.life, studyHours: Math.max(0, Math.round((p.life.studyHours + gap / 7) * 10) / 10) } };
}

export function planStages(p: Profile, w: WorldTemplate, input: PlanInput) {
  let cur = withWeekly(p, input.weekly);
  const stages: PlanStage[] = cur === p ? [] : [{ month: 0, profile: cur }];
  const applied: PlanRerun["applied"] = [];
  const used = new Set<string>();
  const hit = new Set<string>();
  for (const s of input.steps.toSorted((a, b) => a.month - b.month)) {
    const t = tweakOf(s.item, w);
    // 항목을 끝낸다고 공부 시간이 늘지는 않는다. 공부 시간은 사용자가 고친 주당 시간으로만 움직인다.
    if (!t || t.key === "study" || used.has(t.key)) continue;
    const next = t.apply(cur);
    if (!next) continue;
    used.add(t.key);
    hit.add(s.title);
    cur = next;
    applied.push({ month: s.month, title: s.title, label: t.label });
    const last = stages.at(-1);
    if (last?.month === s.month) last.profile = cur;
    else stages.push({ month: s.month, profile: cur });
  }
  const notInSim = [...new Set(input.steps.map((s) => s.title))].filter((x) => !hit.has(x));
  return { stages, applied, notInSim };
}

export function planRerun(p: Profile, w: WorldTemplate, months: number, startYm: string, input: PlanInput, n = RUNS): PlanRerun | null {
  const before = statsOf(p, w, runAll(p, w, months, startYm, undefined, n)).gate;
  if (!before) return null;
  const { stages, applied, notInSim } = planStages(p, w, input);
  const after = stages.length ? statsOf(p, w, runAll(p, w, months, startYm, undefined, n, stages)).gate : before;
  const from = weeklyOf(p);
  return {
    label: before.label,
    months,
    n,
    before: before.share,
    after: after?.share ?? 0,
    applied,
    notInSim,
    late: input.late,
    undated: input.undated,
    weekly: from === input.weekly ? null : { from, to: input.weekly },
  };
}

// 월별 일정(코드만, AI 없음). 우선순위 순서로 빈 시간에 채운다. 시간은 전부 가정값이고, 시험 시점은 '대략적인 위치'다.
// 시험 일정은 연동하지 않는다. 사용자가 직접 고칠 수 있다.
import { monthLabel } from "./calendar";
import type { PriorityRow } from "./gap";
import { retrainMonths } from "./retrain";
import type { Profile, WorldTemplate } from "./types";
import { W } from "./weights";

export interface PlanEdits {
  months?: number; // 계획 기간
  weekly?: number; // 주당 공부 시간
  removed?: string[]; // 뺀 항목(row id)
  added?: string[]; // '나중에'에서 일정으로 올린 자격
  examMonth?: Record<string, number>; // 사용자가 고친 시험 위치(시작부터 몇 개월째)
}
export interface PlanRow {
  id: string;
  title: string;
  kind: PriorityRow["item"]["kind"];
  lane: "study" | "practice" | "school";
  hours: number;
  hoursOfficial: boolean; // NCS 훈련 기준 시간이면 true
  start: number; // 시작 달(0부터)
  end: number; // 끝나는 달(포함)
  overflow: boolean; // 계획 기간을 넘김
  examMonth: number | null; // 자격증의 대략적인 시험 위치
  examEdited: boolean;
  examTooEarly: boolean; // 준비가 끝나기 전 달로 고침
  required: boolean;
  searchWord: string | null; // 훈련과정 검색어
}
export interface Plan {
  rows: PlanRow[];
  milestones: PriorityRow[]; // 시간 없는 필수 항목(면허 등)
  removed: PriorityRow[];
  later: PriorityRow[]; // 상위 몇 개 밖의 선택 자격. 접어 둔다
  months: number;
  weekly: number;
  capacityPerMonth: number;
  schoolMonths: number;
  neededWeekly: number; // 기간 안에 끝내려면 필요한 주당 시간(여유 포함)
  neededMonths: number | null; // 지금 주당 시간으로 끝내려면 필요한 기간
  over: boolean;
}

const WEEKS_PER_MONTH = 4.345;
const isPractice = (r: PriorityRow) => r.item.kind === "experience";
// 학과 과정 안에서 하는 것: 해당 학과가 필요한 진로의 학과·실습
export const isSchool = (r: PriorityRow, w: WorldTemplate) => needsSchool(w) && r.item.kind === "experience" && /학과|졸업|실습/.test(r.item.name);
const needsSchool = (w: WorldTemplate) => w.archetype === "license" || w.id === "teacher-elem" || w.id === "teacher-sec";

// 지금 조건의 주당 공부 시간(근로 시간을 뺀 값. lib/factors examPower와 같은 식)
export function weeklyOf(p: Profile): number {
  return Math.round(Math.max(0, p.life.studyHours - (p.life.partTimeHours / 7) * 0.8) * 7);
}

function searchWord(r: PriorityRow, w: WorldTemplate): string | null {
  if (r.item.kind === "skill") return w.name.replace(/\(.*\)/, "");
  if (r.item.kind === "cert" && !r.item.required) return r.item.name;
  return null;
}

export function buildPlan(rows: PriorityRow[], p: Profile, w: WorldTemplate, defaultMonths: number, edits: PlanEdits = {}): Plan {
  const months = edits.months ?? defaultMonths;
  const weekly = edits.weekly ?? weeklyOf(p);
  const capacityPerMonth = weekly * WEEKS_PER_MONTH * (1 - W("report.plan.spare"));
  const removedIds = new Set(edits.removed ?? []);
  const removed = rows.filter((r) => removedIds.has(r.item.id));
  const addedIds = new Set(edits.added ?? []);
  // 필수가 아닌 자격은 우선순위 상위 몇 개만 일정에 넣는다(개수는 가정값).
  const optionalCerts = rows.filter((r) => r.item.kind === "cert" && !r.item.required && !removedIds.has(r.item.id));
  const inPlan = new Set(optionalCerts.slice(0, W("report.plan.certLimit")).map((r) => r.item.id));
  const later = optionalCerts.filter((r) => !inPlan.has(r.item.id) && !addedIds.has(r.item.id));
  const laterIds = new Set(later.map((r) => r.item.id));
  const active = rows.filter((r) => !removedIds.has(r.item.id) && !laterIds.has(r.item.id));

  const retrain = retrainMonths(p, w); // 학과를 새로 다니면 그 뒤 일정이 시작된다. 지금 학과에 다니는 사람은 졸업 전에 나란히 준비한다.
  const schoolMonths = Math.max(retrain, needsSchool(w) && !retrainMonths(p, w) ? p.spec.gradIn : 0);
  const school = active.filter((r) => isSchool(r, w));
  const timed = active.filter((r) => !isSchool(r, w) && r.hoursLeft !== null);
  const milestones = active.filter((r) => !isSchool(r, w) && r.hoursLeft === null);

  // 두 줄을 한 달씩 채운다: 공부와 경험을 나란히, 한쪽이 끝나면 남은 쪽이 전부 쓴다.
  const study = timed.filter((r) => !isPractice(r));
  const practice = timed.filter(isPractice);
  const left = new Map(timed.map((r) => [r.item.id, r.hoursLeft!]));
  const start = new Map<string, number>();
  const end = new Map<string, number>();
  const practiceShare = W("report.plan.practiceShare");
  const fill = (queue: PriorityRow[], budget: number, month: number) => {
    let b = budget;
    for (const r of queue) {
      const l = left.get(r.item.id)!;
      if (l <= 0) continue;
      if (b <= 0) break;
      if (!start.has(r.item.id)) start.set(r.item.id, month);
      const used = Math.min(l, b);
      left.set(r.item.id, l - used);
      b -= used;
      if (l - used <= 0) end.set(r.item.id, month);
    }
    return b;
  };
  const total = timed.reduce((a, r) => a + r.hoursLeft!, 0);
  let last = -1;
  if (capacityPerMonth > 0) {
    for (let m = retrain; m < 600 && [...left.values()].some((x) => x > 0); m++) {
      const anyPractice = practice.some((r) => left.get(r.item.id)! > 0);
      const anyStudy = study.some((r) => left.get(r.item.id)! > 0);
      const pb = anyPractice ? (anyStudy ? capacityPerMonth * practiceShare : capacityPerMonth) : 0;
      const spareP = fill(practice, pb, m);
      fill(study, capacityPerMonth - pb + spareP, m);
      last = m;
    }
  }

  const planRows: PlanRow[] = timed.map((r) => {
    const e = end.get(r.item.id) ?? (capacityPerMonth > 0 ? last : months - 1);
    const s = start.get(r.item.id) ?? 0;
    const isCert = r.item.kind === "cert";
    const edited = isCert ? edits.examMonth?.[r.item.id] : undefined;
    const exam = isCert ? (edited ?? e) : null;
    return {
      id: r.item.id,
      title: r.title,
      kind: r.item.kind,
      lane: isPractice(r) ? "practice" : "study",
      hours: r.hoursLeft!,
      hoursOfficial: r.hoursOfficial,
      start: s,
      end: e,
      overflow: capacityPerMonth <= 0 || e >= months,
      examMonth: exam,
      examEdited: edited !== undefined,
      examTooEarly: edited !== undefined && edited < e,
      required: Boolean(r.item.required),
      searchWord: searchWord(r, w),
    };
  });
  const schoolRows: PlanRow[] = [
    {
      id: "school",
      title: retrainMonths(p, w) ? "학과 다시 다니기(편입·재입학)" : "학과 과정 마치기",
      kind: "experience",
      lane: "school",
      hours: school.reduce((a, r) => a + (r.hoursLeft ?? 0), 0),
      hoursOfficial: false,
      start: 0,
      end: Math.max(0, schoolMonths - 1),
      overflow: schoolMonths > months,
      examMonth: null,
      examEdited: false,
      examTooEarly: false,
      required: true,
      searchWord: null,
    },
  ];

  const usable = months - retrain;
  const neededWeekly = usable > 0 ? Math.ceil(total / usable / WEEKS_PER_MONTH / (1 - W("report.plan.spare"))) : 0;
  const neededMonths = capacityPerMonth > 0 ? retrain + Math.ceil(total / capacityPerMonth) : null;
  return {
    rows: [...(schoolMonths > 0 ? schoolRows : []), ...planRows.toSorted((a, b) => a.start - b.start || a.end - b.end)],
    milestones,
    removed,
    later,
    months,
    weekly,
    capacityPerMonth,
    schoolMonths,
    neededWeekly,
    neededMonths,
    over: usable <= 0 ? total > 0 : neededWeekly > weekly,
  };
}

// '항목 줄이기': 필수가 아닌 항목을 우선순위 뒤에서부터 빼서 시간 안에 맞춘다.
export function itemsToCut(rows: PriorityRow[], p: Profile, w: WorldTemplate, months: number, weekly: number, already: string[] = []): string[] {
  const removed = [...already];
  const later = new Set(buildPlan(rows, p, w, months, { months, weekly, removed: already }).later.map((r) => r.item.id));
  const cuttable = rows.filter((r) => !r.item.required && !removed.includes(r.item.id) && !later.has(r.item.id) && r.hoursLeft !== null && !isSchool(r, w)).toReversed();
  for (const r of cuttable) {
    if (!buildPlan(rows, p, w, months, { months, weekly, removed }).over) break;
    removed.push(r.item.id);
  }
  return removed;
}

export function overText(plan: Plan): string {
  if (plan.neededWeekly === 0) return `학과 과정만 ${plan.schoolMonths}개월이라 ${plan.months}개월 안에는 끝나지 않아요. 기간을 늘리거나 항목을 줄여야 해요.`;
  return `주 ${plan.neededWeekly}시간이 필요한데 지금은 ${plan.weekly}시간이에요. 기간을 늘리거나 항목을 줄여야 해요.`;
}

export const rangeLabel = (startYm: string, r: { start: number; end: number }) => (r.start === r.end ? monthLabel(startYm, r.start) : `${monthLabel(startYm, r.start)} ~ ${monthLabel(startYm, r.end)}`);

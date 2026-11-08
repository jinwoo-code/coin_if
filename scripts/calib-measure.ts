// scripts/calibrate.ts·scripts/fit-base.ts가 같이 쓰는 측정(엔진·데이터는 안 바꿈).
import norms from "../data/norms.json";
import { runAll, statsOf } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { READINESS } from "../lib/readiness";
import type { Path, Profile, WorldTemplate } from "../lib/types";

export const START = "2026-12";

// scripts/validate.ts의 평범한 지원자와 같은 사람
const avgReadiness = Object.fromEntries(Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]));
export const AVG = normalizeProfile({
  name: "평균",
  dilemma: "보정",
  values: [],
  bigFive: norms.bigFive.mean,
  behavior: { ...norms.behavior.mean },
  readiness: avgReadiness,
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});

export const HERE = /개월차$/; // 이 진로에서 일하는 중
const working = (s: string) => HERE.test(s) || s === "다른 길에서 일하는 중";
const nth = (s: string) => Number(/(\d+)개월차$/.exec(s)?.[1] ?? 0);

// 한 회차의 첫 직장: 시작 달, 끝난 달(없으면 null), 이 진로의 일이었는지
export function firstJob(p: Path) {
  const ms = p.months;
  const start = ms.findIndex((m) => working(m.status));
  if (start < 0) return null;
  const here = HERE.test(ms[start].status);
  for (let i = start + 1; i < ms.length; i++) {
    const s = ms[i].status;
    if (!working(s)) return { start, end: i, here };
    if (HERE.test(s) && nth(s) === 1 && HERE.test(ms[i - 1].status)) return { start, end: i, here }; // 이직(moved)
  }
  return { start, end: null as number | null, here };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function measure(p: Profile, w: WorldTemplate, runs: number, months: number) {
  const paths = runAll(p, w, months, START, undefined, runs);
  const grad = Math.max(0, p.spec.gradIn ?? 0);
  const jobs = paths.map(firstJob);
  const had = jobs.filter((j) => j);
  const ended = had.filter((j) => j!.end !== null);
  // 졸업 뒤 t개월까지 첫 일을 못 구한 비율 S(t) → 재고 비율(해마다 같은 수가 졸업한다고 봄)
  const S: number[] = [];
  for (let t = 0; grad + t < months; t++) S.push(jobs.filter((j) => !j || j.start > grad + t).length / paths.length);
  const sum = (from: number) => S.slice(from).reduce((a, b) => a + b, 0);
  const total = sum(0);
  // 간호사형: 이 진로 첫 출근 뒤 12개월 이상 보이는 회차
  const obs = had.filter((j) => j!.here && j!.start + 12 < months);
  const quit1y = obs.filter((j) => j!.end !== null && j!.end - j!.start <= 12);
  const leftField = quit1y.filter((j) => {
    const path = paths[jobs.indexOf(j)];
    return !path.months.slice(j!.end!).some((m) => HERE.test(m.status));
  });
  // 3년 안 이 진로 취업(합격) 비율
  const in3y = paths.filter((x) => x.months.slice(0, 36).some((m) => HERE.test(m.status))).length / paths.length;
  const firstHere = paths.map((x) => x.months.findIndex((m) => HERE.test(m.status))).filter((i) => i >= 0);
  return {
    satisfied: statsOf(p, w, paths).satisfiedShare, // 기간 끝에 이 진로에서 만족하며 끝남
    n: paths.length,
    hadJob: had.length / paths.length,
    quitShare: had.length ? ended.length / had.length : NaN,
    tenures: ended.map((j) => j!.end! - j!.start),
    tenure: mean(ended.map((j) => j!.end! - j!.start)),
    tenureN: ended.length,
    u1y: total ? sum(12) / total : NaN,
    u3y: total ? sum(36) / total : NaN,
    neverByEnd: S.at(-1) ?? NaN,
    resign1y: obs.length ? quit1y.length / obs.length : NaN,
    resign1yN: obs.length,
    leaveField: quit1y.length ? leftField.length / quit1y.length : NaN,
    in3y,
    firstHereMedian: firstHere.length ? firstHere.toSorted((a, b) => a - b)[Math.floor(firstHere.length / 2)] : NaN,
  };
}

// 갈림길 보정 준비: data/calibration-targets.json의 목표마다 지금 시뮬레이션 값을 나란히 보여 준다(엔진·데이터는 안 바꿈).
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/calibrate.ts [--runs 1000] [--months 120] [--only id,id]
// 평균 인물(scripts/validate.ts와 같은 사람)로 진로 53개를 돌리고, 시연 인물 2명은 따로 본다(AI 판단 없이 규칙 계산).
import targetsFile from "../data/calibration-targets.json";
import norms from "../data/norms.json";
import { DEMO_PROFILE, NURSE_DEMO_PROFILE } from "../lib/demo";
import { runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { READINESS } from "../lib/readiness";
import type { Path, Profile, WorldTemplate } from "../lib/types";
import { getWorld, WORLDS } from "../lib/worlds";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RUNS = Number(arg("--runs") ?? 1000);
const MONTHS = Number(arg("--months") ?? 120);
const START = "2026-12";
const ONLY = arg("--only")?.split(",");

type Target = { id: string; name: string; value: number | null; unit: string; appliesTo: string | string[]; use: string };
const TARGETS = (targetsFile as { targets: Target[] }).targets;
const T = (id: string) => TARGETS.find((t) => t.id === id)!;

// scripts/validate.ts의 평범한 지원자와 같은 사람
const avgReadiness = Object.fromEntries(Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]));
const AVG = normalizeProfile({
  name: "평균",
  dilemma: "보정",
  values: [],
  bigFive: norms.bigFive.mean,
  behavior: { ...norms.behavior.mean },
  readiness: avgReadiness,
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});

const HERE = /개월차$/; // 이 진로에서 일하는 중
const working = (s: string) => HERE.test(s) || s === "다른 길에서 일하는 중";
const nth = (s: string) => Number(/(\d+)개월차$/.exec(s)?.[1] ?? 0);

// 한 회차의 첫 직장: 시작 달, 끝난 달(없으면 null), 이 진로의 일이었는지
function firstJob(p: Path) {
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

function measure(p: Profile, w: WorldTemplate) {
  const paths = runAll(p, w, MONTHS, START, undefined, RUNS);
  const grad = Math.max(0, p.spec.gradIn ?? 0);
  const jobs = paths.map(firstJob);
  const had = jobs.filter((j) => j);
  const ended = had.filter((j) => j!.end !== null);
  // 졸업 뒤 t개월까지 첫 일을 못 구한 비율 S(t) → 재고 비율(해마다 같은 수가 졸업한다고 봄)
  const S: number[] = [];
  for (let t = 0; grad + t < MONTHS; t++) S.push(jobs.filter((j) => !j || j.start > grad + t).length / paths.length);
  const sum = (from: number) => S.slice(from).reduce((a, b) => a + b, 0);
  const total = sum(0);
  // 간호사형: 이 진로 첫 출근 뒤 12개월 이상 보이는 회차
  const obs = had.filter((j) => j!.here && j!.start + 12 < MONTHS);
  const quit1y = obs.filter((j) => j!.end !== null && j!.end - j!.start <= 12);
  const leftField = quit1y.filter((j) => {
    const path = paths[jobs.indexOf(j)];
    return !path.months.slice(j!.end!).some((m) => HERE.test(m.status));
  });
  return {
    n: paths.length,
    hadJob: had.length / paths.length,
    quitShare: had.length ? ended.length / had.length : NaN,
    tenure: mean(ended.map((j) => j!.end! - j!.start)),
    tenureN: ended.length,
    u1y: total ? sum(12) / total : NaN,
    u3y: total ? sum(36) / total : NaN,
    neverByEnd: S.at(-1) ?? NaN,
    resign1y: obs.length ? quit1y.length / obs.length : NaN,
    resign1yN: obs.length,
    leaveField: quit1y.length ? leftField.length / quit1y.length : NaN,
  };
}

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const pc = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) : "-");
const err = (sim: number, target: number) => (Number.isFinite(sim) ? `${sim - target >= 0 ? "+" : ""}${(sim - target).toFixed(1)}` : "-");

const tTen = T("common.firstJobTenure").value!;
const tQuit = T("common.firstJobQuitShare").value!;
const t1 = T("common.unemployed1y").value!;
const t3 = T("common.unemployed3y").value!;
const tNr = T("nurse.firstYearResign").value!;
const tNl = T("nurse.leaveField").value!;
const EXAMLIKE = new Set(["exam", "public"]);

console.log(`# 보정 전 비교: 평균 인물, ${RUNS}번, ${MONTHS}개월, 시작 ${START}\n`);
console.log("목표: ① 첫 직장 그만둔 사람의 평균 근속 18.4개월(보정), 미취업 졸업자 중 1년 이상 48.6%·3년 이상 19.4%(보정), 첫 직장 그만둔 비율 70.7%(참고). ③ 간호사 1년 안 사직 52.8%·그중 현장 이탈 12.1%. ② 진로별 상대값은 대기(KOSIS 키 없음).\n");
console.log("| 진로 | 유형 | 적용 목표 | 근속 목표 | 근속 지금 | 오차 | 1년+ 목표 | 지금 | 오차 | 3년+ 목표 | 지금 | 오차 | 그만둔 비율(참고 70.7) | 첫 일 구함 | 그만둔 회차 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
const rows: { id: string; tenErr: number; u1Err: number; u3Err: number }[] = [];
const nurseRows: string[] = [];
const t0 = Date.now();
for (const w of WORLDS.filter((x) => !ONLY || ONLY.includes(x.id))) {
  const m = measure(AVG, w);
  const examLike = EXAMLIKE.has(w.archetype);
  const applied = ["①"].concat(w.id === "nurse" ? ["③"] : []).concat(examLike ? ["(①근속은 시험형·공채형이라 참고)"] : []).join(" ");
  console.log(
    `| ${w.short} | ${w.archetype} | ${applied} | ${tTen} | ${f1(m.tenure)} | ${err(m.tenure, tTen)} | ${t1} | ${pc(m.u1y)} | ${err(m.u1y * 100, t1)} | ${t3} | ${pc(m.u3y)} | ${err(m.u3y * 100, t3)} | ${pc(m.quitShare)} | ${pc(m.hadJob)} | ${m.tenureN} |`,
  );
  rows.push({ id: w.id, tenErr: examLike ? NaN : m.tenure - tTen, u1Err: m.u1y * 100 - t1, u3Err: m.u3y * 100 - t3 });
  if (w.id === "nurse") nurseRows.push(`| 평균 인물 | ${tNr} | ${pc(m.resign1y)} | ${err(m.resign1y * 100, tNr)} | ${tNl} | ${pc(m.leaveField)} | ${err(m.leaveField * 100, tNl)} | ${m.resign1yN} |`);
}
const absMean = (xs: number[]) => mean(xs.filter(Number.isFinite).map(Math.abs));
console.log(`\n평균 절대 오차: 근속 ${f1(absMean(rows.map((r) => r.tenErr)))}개월(시험형·공채형 빼고), 1년+ ${f1(absMean(rows.map((r) => r.u1Err)))}%p, 3년+ ${f1(absMean(rows.map((r) => r.u3Err)))}%p`);

// 시연 인물(규칙 계산)
console.log("\n## 시연 인물\n");
console.log("| 인물 | 진로 | 근속 지금(목표 18.4) | 1년+ 지금(48.6) | 3년+ 지금(19.4) | 그만둔 비율(참고 70.7) | 첫 일 구함 |");
console.log("|---|---|---|---|---|---|---|");
for (const [name, p, ids] of [
  ["김민준", DEMO_PROFILE, ["developer", "civil-servant"]],
  ["이서연", NURSE_DEMO_PROFILE, ["nurse", "civil-servant"]],
] as const) {
  for (const id of ids) {
    const m = measure({ ...p, judges: {} } as Profile, getWorld(id));
    console.log(`| ${name} | ${getWorld(id).short} | ${f1(m.tenure)} | ${pc(m.u1y)} | ${pc(m.u3y)} | ${pc(m.quitShare)} | ${pc(m.hadJob)} |`);
    if (id === "nurse") nurseRows.push(`| 이서연 | ${tNr} | ${pc(m.resign1y)} | ${err(m.resign1y * 100, tNr)} | ${tNl} | ${pc(m.leaveField)} | ${err(m.leaveField * 100, tNl)} | ${m.resign1yN} |`);
  }
}
console.log("\n## 간호사(③)\n");
console.log("| 인물 | 1년 안 사직 목표 | 지금 | 오차 | 그중 현장 이탈 목표 | 지금 | 오차 | 관찰한 신규 간호사 회차 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of nurseRows) console.log(r);
console.error(`걸린 시간 ${Math.round((Date.now() - t0) / 1000)}초`);

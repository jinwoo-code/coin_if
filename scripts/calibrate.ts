// 갈림길 보정 준비: data/calibration-targets.json의 목표마다 지금 시뮬레이션 값을 나란히 보여 준다(엔진·데이터는 안 바꿈).
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/calibrate.ts [--runs 1000] [--months 120] [--only id,id]
// 평균 인물(scripts/validate.ts와 같은 사람)로 진로 53개를 돌리고, 시연 인물 2명은 따로 본다(AI 판단 없이 규칙 계산).
import { writeFileSync } from "node:fs";
import targetsFile from "../data/calibration-targets.json";
import { DEMO_PROFILE, NURSE_DEMO_PROFILE } from "../lib/demo";
import type { Profile } from "../lib/types";
import { getWorld, WORLDS } from "../lib/worlds";
import { AVG, measure as measureWith, START } from "./calib-measure";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RUNS = Number(arg("--runs") ?? 1000);
const MONTHS = Number(arg("--months") ?? 120);
const ONLY = arg("--only")?.split(",");
const JSON_OUT = arg("--json"); // 결과를 파일로(전후 비교용)

type Target = { id: string; name: string; value: number | null; unit: string; appliesTo: string | string[]; use: string };
const TARGETS = (targetsFile as { targets: Target[] }).targets;
const T = (id: string) => TARGETS.find((t) => t.id === id)!;
const measure = (p: Profile, w: Parameters<typeof measureWith>[1]) => measureWith(p, w, RUNS, MONTHS);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const dump: Record<string, unknown> = {};

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const pc = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) : "-");
const err = (sim: number, target: number) => (Number.isFinite(sim) ? `${sim - target >= 0 ? "+" : ""}${(sim - target).toFixed(1)}` : "-");

const tTen = T("common.firstJobTenure").value!;
const tQuit = T("common.firstJobQuitShare").value!;
const t1 = T("common.unemployed1y").value!;
const t3 = T("common.unemployed3y").value!;
const tNr = T("nurse.firstYearResign").value!;
const tNl = T("nurse.leaveField").value!;
const EXAMLIKE = new Set(["exam", "public", "grad", "startup"]); // 근속 목표를 안 쓰는 유형(시험형·공채형은 분모 없음, 대학원·창업은 일반 직장이 아님)

console.log(`# 보정 전 비교: 평균 인물, ${RUNS}번, ${MONTHS}개월, 시작 ${START}\n`);
console.log("목표: ① 첫 직장 그만둔 사람의 평균 근속 18.4개월(보정), 첫 직장 그만둔 비율 70.7%(참고), 미취업 졸업자 중 1년 이상 48.6%·3년 이상 19.4%(참고). ③ 간호사 1년 안 사직 52.8%·그중 현장 이탈 12.1%(보정). ② 진로별 상대값은 대기(KOSIS 키 없음).\n");
console.log("| 진로 | 유형 | 적용 목표 | 근속 목표 | 근속 지금 | 오차 | 1년+ 참고 | 지금 | 오차 | 3년+ 참고 | 지금 | 오차 | 그만둔 비율(참고 70.7) | 첫 일 구함 | 그만둔 회차 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
const rows: { id: string; tenErr: number; u1Err: number; u3Err: number }[] = [];
const nurseRows: string[] = [];
const t0 = Date.now();
for (const w of WORLDS.filter((x) => !ONLY || ONLY.includes(x.id))) {
  const m = measure(AVG, w);
  const examLike = EXAMLIKE.has(w.archetype);
  const applied = ["①"].concat(w.id === "nurse" ? ["③"] : []).concat(examLike ? ["(①근속 참고)"] : []).join(" ");
  console.log(
    `| ${w.short} | ${w.archetype} | ${applied} | ${tTen} | ${f1(m.tenure)} | ${err(m.tenure, tTen)} | ${t1} | ${pc(m.u1y)} | ${err(m.u1y * 100, t1)} | ${t3} | ${pc(m.u3y)} | ${err(m.u3y * 100, t3)} | ${pc(m.quitShare)} | ${pc(m.hadJob)} | ${m.tenureN} |`,
  );
  dump[`avg|${w.id}`] = { ...m, tenures: undefined };
  rows.push({ id: w.id, tenErr: examLike ? NaN : m.tenure - tTen, u1Err: m.u1y * 100 - t1, u3Err: m.u3y * 100 - t3 });
  if (w.id === "nurse") nurseRows.push(`| 평균 인물 | ${tNr} | ${pc(m.resign1y)} | ${err(m.resign1y * 100, tNr)} | ${tNl} | ${pc(m.leaveField)} | ${err(m.leaveField * 100, tNl)} | ${m.resign1yN} |`);
}
const absMean = (xs: number[]) => mean(xs.filter(Number.isFinite).map(Math.abs));
console.log(`\n평균 절대 오차: 근속 ${f1(absMean(rows.map((r) => r.tenErr)))}개월(시험형·공채형·대학원·창업 빼고), 1년+ ${f1(absMean(rows.map((r) => r.u1Err)))}%p, 3년+ ${f1(absMean(rows.map((r) => r.u3Err)))}%p`);

// 시연 인물(규칙 계산)
console.log("\n## 시연 인물\n");
console.log("| 인물 | 진로 | 첫 출근(가운데, 몇 개월째) | 3년 안 이 진로 취업·합격 | 근속(목표 18.4) | 1년+ 참고(48.6) | 3년+ 참고(19.4) | 그만둔 비율(참고 70.7) | 1년 안 사직(간호사 목표 52.8) | 만족하며 끝남 |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const [name, p, ids] of [
  ["김민준", DEMO_PROFILE, ["developer", "civil-servant"]],
  ["이서연", NURSE_DEMO_PROFILE, ["nurse", "civil-servant"]],
] as const) {
  for (const id of ids) {
    const m = measure({ ...p, judges: {} } as Profile, getWorld(id));
    dump[`${name}|${id}`] = { ...m, tenures: undefined };
    console.log(`| ${name} | ${getWorld(id).short} | ${m.firstHereMedian + 1} | ${pc(m.in3y)} | ${f1(m.tenure)} | ${pc(m.u1y)} | ${pc(m.u3y)} | ${pc(m.quitShare)} | ${pc(m.resign1y)} | ${f1(m.satisfied)} |`);
    if (id === "nurse") nurseRows.push(`| 이서연 | ${tNr} | ${pc(m.resign1y)} | ${err(m.resign1y * 100, tNr)} | ${tNl} | ${pc(m.leaveField)} | ${err(m.leaveField * 100, tNl)} | ${m.resign1yN} |`);
  }
}
console.log("\n## 간호사(③)\n");
console.log("| 인물 | 1년 안 사직 목표 | 지금 | 오차 | 그중 현장 이탈 목표 | 지금 | 오차 | 관찰한 신규 간호사 회차 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of nurseRows) console.log(r);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(dump, null, 1));
console.error(`걸린 시간 ${Math.round((Date.now() - t0) / 1000)}초`);

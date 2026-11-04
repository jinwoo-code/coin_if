// 시험형 '준비된 응시자 보정 k'를 9급 합격자 통계로 찾는다(보기만, 값은 data/weights.json의 exam.readyK에 손으로 넣는다).
// 시험 한 번 합격 확률 = k ÷ 경쟁률. 맞추는 통계: 합격자 평균 준비 20개월, 합격자 중 2년 안 73.3%(이대중 외).
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-exam-k.ts
// 평범한 지원자는 scripts/validate.ts와 같은 사람이다.
import norms from "../data/norms.json";
import { runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { READINESS } from "../lib/readiness";
import { WEIGHTS } from "../lib/weights";
import { getWorld } from "../lib/worlds";

const RUNS = 2000;
const MONTHS = 120;
const TARGET = { mean: 20, within2y: 0.733 };
const avgReadiness = Object.fromEntries(Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]));
const avg = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: [],
  bigFive: norms.bigFive.mean,
  behavior: { ...norms.behavior.mean },
  readiness: avgReadiness,
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});

const world = getWorld("civil-servant");
function at(k: number) {
  WEIGHTS["exam.readyK"].value = k;
  const paths = runAll(avg, world, MONTHS, "2026-11", undefined, RUNS);
  const passed = paths
    .map((p) => p.months.findIndex((m) => m.event?.id.startsWith("exam-pass")))
    .filter((m) => m >= 0)
    .map((m) => m + 1);
  const mean = passed.reduce((s, x) => s + x, 0) / Math.max(1, passed.length);
  const within2y = passed.filter((m) => m <= 24).length / Math.max(1, passed.length);
  const in3y = passed.filter((m) => m <= 36).length / paths.length;
  const loss = ((mean - TARGET.mean) / TARGET.mean) ** 2 + ((within2y - TARGET.within2y) / TARGET.within2y) ** 2;
  return { k, mean, within2y, in3y, in10y: passed.length / paths.length, loss };
}

const rows = [];
for (let k = 1; k <= 5.001; k += 0.25) rows.push(at(Math.round(k * 100) / 100));
const coarse = rows.toSorted((a, b) => a.loss - b.loss)[0].k;
for (let k = coarse - 0.2; k <= coarse + 0.2001; k += 0.05) if (!rows.some((r) => Math.abs(r.k - k) < 0.001)) rows.push(at(Math.round(k * 100) / 100));
rows.sort((a, b) => a.k - b.k);
console.log(`9급 평범한 지원자 ${RUNS}번, ${MONTHS / 12}년. 통계: 합격자 평균 ${TARGET.mean}개월, 2년 안 ${TARGET.within2y * 100}%\n`);
console.log("| k | 국가직 | 지방직 | 합격자 평균 | 2년 안(합격자) | 3년 안(전체) | 10년 안(전체) | 어긋남 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows)
  console.log(
    `| ${r.k.toFixed(2)} | ${(r.k / 21.43).toFixed(3)} | ${Math.min(0.95, r.k / 6.05).toFixed(3)} | ${r.mean.toFixed(1)} | ${(r.within2y * 100).toFixed(1)}% | ${(r.in3y * 100).toFixed(1)}% | ${(r.in10y * 100).toFixed(1)}% | ${r.loss.toFixed(4)} |`,
  );
const best = rows.toSorted((a, b) => a.loss - b.loss)[0];
console.log(`\n가장 가까운 k = ${best.k}`);

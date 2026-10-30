// 검증: '평범한 지원자'로 살아본 결과가 실제 통계와 비슷한지 비교한다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/validate.ts
//
// 통계와 같은 기준으로 잰다.
// - 평범한 지원자 = 모든 개인 배수가 ×1인 사람(lib/factors.ts의 기준). 준비도 질문은 배수 1인 보기로 답한다.
//   (답을 안 하면 한 단계 낮은 보기로 보기 때문에, 답 없는 사람으로 재면 평범한 사람보다 느리게 나온다.)
// - 취업 기간은 '졸업한 달부터' 센다. 통계청 수치가 졸업 후 첫 취업까지라서다.
// - 평균은 붙은 사람끼리 낸다(통계도 취업 경험자·합격자 기준). 기간이 짧으면 오래 걸린 사람이 빠져 평균이 작아지므로 10년을 돌린다.
//   (예전에는 3년만 돌려서 공무원이 통계와 맞아 보였지만, 3년 넘게 걸린 합격자가 빠진 착시였다.)
// 공무원은 공부 시작부터 '합격 발표 달'까지 센다(비교 통계가 합격자의 준비 기간이라서. 첫 출근은 그 뒤).
import { runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { READINESS } from "../lib/readiness";
import { getWorld, WORLDS } from "../lib/worlds";

const RUNS = 400;
const MONTHS = 120;

// 준비도 질문마다 배수가 1에 가장 가까운 보기
const avgReadiness = Object.fromEntries(
  Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]),
);

const avg = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: ["안정", "돈", "성장", "여유"],
  readiness: avgReadiness,
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  // 공시생 하루 평균 8.7시간(이대중 외)과 맞추려고 수험 조건은 알바 없이 8.7시간. 사는 곳은 배수 ×1인 서울.
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});

function hiredMonths(id: string) {
  const paths = runAll(avg, getWorld(id), MONTHS, "2026-11", undefined, RUNS);
  // 0부터 세므로 +1 = 졸업(공부 시작) 후 몇 달째에 붙었나. 시험형은 합격 발표 달, 나머지는 첫 출근 달.
  const at = (p: (typeof paths)[number]) => (getWorld(id).archetype === "exam" ? p.months.findIndex((m) => m.event?.id.startsWith("exam-pass")) : (p.employedAt ?? -1));
  const hired = paths.map(at).filter((m) => m >= 0).map((m) => m + 1).toSorted((a, b) => a - b);
  return { hired, n: paths.length };
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const median = (xs: number[]) => xs[Math.floor(xs.length / 2)];
const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;

console.log(`평범한 지원자(4년제·서울·준비도 보통, 모든 배수 ×1)로 ${RUNS}번씩, ${MONTHS / 12}년 돌림\n`);
console.log("| 진로 | 붙은 사람 평균 | 가운데 값 | 붙은 사람 중 2년 안 | 10년 안 붙음 | 실제 통계 |");
console.log("|---|---|---|---|---|---|");
for (const [id, real] of [
  ["civil-servant", "합격자 평균 준비 1년 8개월(20개월), 2년 안에 73.3% (합격자 기준)"],
  ["developer", "졸업 후 첫 취업까지 평균 11.2개월 (전체 청년, 모든 일자리)"],
  ["marketer", "졸업 후 첫 취업까지 평균 11.2개월 (전체 청년, 모든 일자리)"],
  ["data-analyst", "통계 없음(공공기관 경쟁률 확인 필요)"],
] as const) {
  const { hired, n } = hiredMonths(id);
  const w = getWorld(id);
  console.log(`| ${w.short} | ${mean(hired).toFixed(1)}개월 | ${median(hired)}개월 | ${pct(hired.filter((m) => m <= 24).length, hired.length)} | ${pct(hired.length, n)} | ${real} |`);
}

// 상시 채용 진로 전체: 기본 확률이 보통(0.065~0.08)인 진로들의 평균이 통계와 맞는지
const typical: number[] = [];
const hard: string[] = [];
for (const w of WORLDS.filter((x) => ["open", "portfolio", "trade"].includes(x.archetype))) {
  const gate = w.events.find((e) => e.hires && e.chance !== undefined && !e.requires?.length);
  const { hired } = hiredMonths(w.id);
  if (gate?.chance && gate.chance >= 0.065 && gate.chance <= 0.08) typical.push(...hired);
  else if (gate?.chance && gate.chance < 0.05) hard.push(`${w.short} ${mean(hired).toFixed(0)}개월`);
}
console.log(`\n상시 채용 진로 중 기본 확률이 보통인 진로들의 붙은 사람 평균: ${mean(typical).toFixed(1)}개월 (통계 11.2개월)`);
console.log(`일부러 어렵게 둔 진로(기본 확률 0.05 미만, 가정값): ${hard.join(", ")}`);

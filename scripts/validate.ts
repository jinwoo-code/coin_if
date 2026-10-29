// 검증: '평범한 조건의 가상 인물'로 100번 살아본 결과가 실제 통계와 비슷한지 비교한다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/validate.ts
import { buildMultiverse } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { getWorld } from "../lib/worlds";

const avg = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: ["안정", "돈", "성장", "여유"],
  // 공시생 하루 평균 8.7시간(이대중 외)과 맞추려고 수험 조건은 알바 없이 8.7시간
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 8.7, partTimeHours: 0 },
});

const rows: string[] = [];
for (const [id, real] of [
  ["civil-servant", "합격자 평균 준비 1년 8개월, 2년 안에 73.3% (합격자 기준)"],
  ["developer", "청년 첫 취업까지 평균 11.2개월 (전체 청년)"],
  ["data-analyst", "통계 없음(공공기관 경쟁률 확인 필요)"],
  ["marketer", "청년 첫 취업까지 평균 11.2개월 (전체 청년)"],
] as const) {
  const w = getWorld(id);
  const { mv, paths } = buildMultiverse(avg, w, 36, "2026-11");
  const hired = paths.filter((p) => p.employedAt !== null).map((p) => p.employedAt!).toSorted((a, b) => a - b);
  const med = hired.length ? hired[Math.floor(hired.length / 2)] + 1 : null;
  const within24 = Math.round((hired.filter((m) => m < 24).length / Math.max(1, hired.length)) * 100);
  rows.push(`| ${w.short} | ${mv.stats.gate?.share}% | ${med ? `${med}개월` : "-"} | ${within24}% | ${real} |`);
}
console.log("| 진로 | 3년 안에 합격·취업 | 걸린 기간(가운데 값) | 붙은 사람 중 2년 안 | 실제 통계 |");
console.log("|---|---|---|---|---|");
console.log(rows.join("\n"));

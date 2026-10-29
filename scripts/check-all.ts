// 모든 진로가 에러 없이 돌아가는지, 결과가 말이 되는지 한눈에 본다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-all.ts
import { buildMultiverse, levers } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { WORLDS } from "../lib/worlds";

const p = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: ["안정", "성장", "돈", "여유"],
  spec: { school: "4년제", status: "졸업예정", gradIn: 3, gpa: 3.5, certs: [], toeic: null, projects: 1, workMonths: 6, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 50, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 8, partTimeHours: 0 },
});
console.log("| 진로 | 유형 | 3년 안 | 걸린 기간 | 만족 | 세계선 | 본선 | Top 레버 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const w of WORLDS) {
  const { mv, paths } = buildMultiverse(p, w, 36, "2026-11");
  const main = mv.lines.find((l) => l.isMain);
  const lv = levers(p, w, 36, "2026-11", paths)[0];
  console.log(`| ${w.short} | ${w.archetype} | ${mv.stats.gate?.share}% | ${mv.stats.gate?.typicalMonth ?? "-"} | ${mv.stats.satisfiedShare}% | ${mv.lines.length} | ${main?.title} (${main?.count}) | ${lv ? `${lv.title}: ${lv.before}→${lv.after}` : "-"} |`);
}

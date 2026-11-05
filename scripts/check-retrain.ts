// 전공이 다를 때 학과 다니기 전후 비교(해당 진로만, 1,000번). 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-retrain.ts [전공]
import { buildMultiverse } from "@/lib/multiverse";
import { normalizeProfile } from "@/lib/profile";
import { retrainMonths } from "@/lib/retrain";
import type { Profile } from "@/lib/types";
import { WT } from "@/lib/weights";
import { getWorld } from "@/lib/worlds";

const major = process.argv[2] ?? "경영학과";
const base = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: ["안정", "성장", "돈", "여유"],
  spec: { school: "4년제", status: "졸업예정", gradIn: 3, gpa: 3.5, certs: [], toeic: null, projects: 1, workMonths: 6, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 50, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 8, partTimeHours: 0 },
} as unknown as Profile);
const row = (p: Profile, id: string, months: number) => {
  const s = buildMultiverse(p, getWorld(id), months, "2026-11").mv.stats;
  return `${s.gate?.share}%·${s.gate?.typicalMonth ?? "-"}개월·만족 ${s.satisfiedShare}%`;
};
console.log(`| 진로 | 앞 구간 | 3년 전(전공 맞음) | 3년 후(${major}) | 10년 전 | 10년 후 |\n|---|---|---|---|---|---|`);
for (const id of Object.keys(WT("retrain.months"))) {
  const w = getWorld(id);
  const fit = { ...base, major: w.majors[0] };
  const off = { ...base, major };
  console.log(`| ${w.short} | ${retrainMonths(off, w)}개월 | ${row(fit, id, 36)} | ${row(off, id, 36)} | ${row(fit, id, 120)} | ${row(off, id, 120)} |`);
}

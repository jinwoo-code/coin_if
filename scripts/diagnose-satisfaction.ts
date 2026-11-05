// 10년 만족 비율이 왜 낮은지 재는 진단(엔진을 안 바꾼다, AI·네트워크 없음). 평범한 지원자·예시 인물로 대표 진로 5개를 1,000번.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/diagnose-satisfaction.ts > 결과.md
import { readFileSync } from "node:fs";
import norms from "../data/norms.json";
import { isSatisfied, runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { DEMO_PROFILE } from "../lib/demo";
import { READINESS } from "../lib/readiness";
import { W } from "../lib/weights";
import { getWorld, valueFit } from "../lib/worlds";

const IDS = ["developer", "civil-servant", "marketer", "nurse", "teacher-elem"];
const AT = [12, 24, 36, 60, 84, 120];
const avgReadiness = Object.fromEntries(Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]));
const avg = normalizeProfile({
  name: "평균",
  dilemma: "진단",
  values: [],
  bigFive: norms.bigFive.mean,
  behavior: { ...norms.behavior.mean },
  readiness: avgReadiness,
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});
const extra = JSON.parse(readFileSync("data/jobdata/extra-facts.json", "utf8")) as Record<string, { label: string; value: string }[]>;
const q = (xs: number[], p: number) => xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;

for (const [who, person] of [["평범한 지원자(가치관 안 고름)", avg], ["예시 인물", DEMO_PROFILE]] as const) {
  console.log(`## ${who}\n`);
  for (const id of IDS) {
    const w = getWorld(id);
    const paths = runAll(person, w, 120, "2026-11", undefined, 1000);
    const jobSat = Math.round(48 + W("value.jobSat") * valueFit(w, person));
    const score = extra[id]?.find((f) => f.label.includes("만족도"))?.value.match(/[\d.]+/)?.[0] ?? "없음";
    console.log(`### ${w.name} (일할 때 평소 수준 ${jobSat}, 고용24 재직자 만족도 ${score}점)\n`);
    console.log("| 달 | 평균 | 하위 10% | 가운데 | 상위 10% | 60 이상 | 55 이상 | 50 이상 | 일하는 사람 | 그중 평균 | 그중 60 이상 |\n|---|---|---|---|---|---|---|---|---|---|---|");
    for (const m of AT) {
      const sat = paths.map((p) => p.months[m - 1].state.satisfaction);
      const emp = paths.filter((p) => p.months[m - 1].salary > 0);
      console.log(`| ${m} | ${mean(sat).toFixed(1)} | ${Math.round(q(sat, 0.1))} | ${Math.round(q(sat, 0.5))} | ${Math.round(q(sat, 0.9))} | ${pct(sat.filter((s) => s >= 60).length, 1000)} | ${pct(sat.filter((s) => s >= 55).length, 1000)} | ${pct(sat.filter((s) => s >= 50).length, 1000)} | ${pct(emp.length, 1000)} | ${mean(emp.map((p) => p.months[m - 1].state.satisfaction)).toFixed(1)} | ${pct(emp.filter((p) => p.months[m - 1].state.satisfaction >= 60).length, emp.length)} |`);
    }
    // 37개월째부터 일하는 달만: 사건과 평소 수준으로 돌아가는 힘을 1년치로 나눈다
    let pos = 0, neg = 0, back = 0, n = 0;
    const hist = new Map<number, number>();
    const bad = new Map<string, number>();
    for (const p of paths) {
      const end = p.months[119].state.satisfaction;
      hist.set(end, (hist.get(end) ?? 0) + 1);
      for (let i = 36; i < 120; i++) {
        const cur = p.months[i];
        if (cur.salary <= 0) continue;
        const d = cur.delta.satisfaction ?? 0;
        if (d > 0) pos += d;
        else neg += d;
        if (d < 0 && cur.event) bad.set(cur.event.title, (bad.get(cur.event.title) ?? 0) + d);
        back += cur.state.satisfaction - p.months[i - 1].state.satisfaction - d;
        n++;
      }
    }
    const y = (x: number) => ((x / Math.max(1, n)) * 12).toFixed(1);
    const top = [...hist].toSorted((a, b) => b[1] - a[1]).slice(0, 4).map(([s, c]) => `${s}점 ${pct(c, 1000)}`).join(", ");
    const worst = [...bad].toSorted((a, b) => a[1] - b[1]).slice(0, 3).map(([t, d]) => `${t} ${y(d)}`).join(", ");
    console.log(`\n37개월째부터 일하는 동안 1년치 평균: 좋은 사건 +${y(pos)}, 나쁜 사건 ${y(neg)}, 평소 수준으로 돌아감 ${y(back)}. 만족도를 많이 내린 사건: ${worst || "없음"}. 10년째 많은 점수: ${top}. 만족 비율(60 이상): ${pct(paths.filter(isSatisfied).length, 1000)}.\n`);
  }
}

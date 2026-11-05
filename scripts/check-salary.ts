// 경고만: 진로의 첫 연봉(엔진)이 고용24 재직자 하위 25% 임금보다 높은 곳. 값은 안 바꾼다. 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/check-salary.ts
import { JOBCODES } from "@/data/jobcodes";
import { ALL_WORLD_IDS } from "@/lib/job-codes";
import { jobDetail } from "@/lib/work24";
import { getWorld } from "@/lib/worlds";

(async () => {
  const over: string[] = [];
  let compared = 0;
  const unknown: string[] = [];
  for (const id of ALL_WORLD_IDS) {
    const w = getWorld(id);
    const all = (w.events as unknown as { tiers?: { salary: number; weight: number }[]; choices?: { tiers?: { salary: number; weight: number }[] }[] }[]).flatMap((e) => [...(e.tiers ?? []), ...(e.choices ?? []).flatMap((c) => c.tiers ?? [])]);
    const sum = all.reduce((a, t) => a + t.weight, 0);
    const code = JOBCODES[id]?.code;
    if (!sum || !code) {
      unknown.push(w.name);
      continue;
    }
    const first = Math.round(all.reduce((a, t) => a + t.salary * t.weight, 0) / sum);
    const d = await jobDetail(code);
    if (!d?.salLow) {
      unknown.push(w.name);
      continue;
    }
    compared++;
    if (first > d.salLow) over.push(`| ${w.name} | ${first} | ${d.salLow} | +${first - d.salLow} |`);
  }
  console.log(`비교 ${compared}개, 초임이 하위 25%보다 높은 곳 ${over.length}개, 비교 못 함 ${unknown.length}개(${unknown.join(", ")})`);
  console.log("| 진로 | 엔진 첫 연봉 평균(만원) | 재직자 하위 25%(만원) | 차이 |\n|---|---|---|---|\n" + over.join("\n"));
})();

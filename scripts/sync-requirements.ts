// 필요한 것 목록의 공식 데이터를 모아 data/requirements/snapshot.json에 저장한다(공식 API 실패 때 쓰는 마지막 값, 기준일 포함).
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/sync-requirements.ts
import { writeFileSync } from "node:fs";
import { careernetJob } from "@/lib/careernet";
import { ALL_WORLD_IDS, codeName, everyCode } from "@/lib/job-codes";
import type { Snapshot } from "@/lib/requirements-build";
import { jobWay, ncsUnitsFor } from "@/lib/work24";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const out: Snapshot = { date: new Date().toISOString().slice(0, 10), ncs: {}, careernet: {}, work24: {} };
  const failed: string[] = [];
  for (const id of ALL_WORLD_IDS) {
    const n = await ncsUnitsFor(id);
    if (n) out.ncs[id] = n;
    else failed.push(`ncs:${id}`);
    const codes = everyCode(id);
    for (const c of codes.careernet)
      if (!out.careernet[c]) {
        const r = await careernetJob(c);
        if (r) out.careernet[c] = r;
        else failed.push(`careernet:${c}`);
        await sleep(100);
      }
    for (const c of codes.work24)
      if (!out.work24[c]) {
        const r = await jobWay(c, codeName(c));
        if (r) out.work24[c] = r;
        else failed.push(`work24:${c}`);
        await sleep(100);
      }
    console.log(id, out.ncs[id]?.length ?? "-");
  }
  writeFileSync("data/requirements/snapshot.json", JSON.stringify(out, null, 1) + "\n");
  console.log("실패", failed);
})();

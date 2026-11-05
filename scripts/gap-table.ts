// 시연 인물로 진로별 격차·우선순위 표(보기만). 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/gap-table.ts developer,nurse,civil-servant
import { readFileSync } from "node:fs";
import { DEMO_PROFILE } from "@/lib/demo";
import { gapItems, prioritize } from "@/lib/gap";
import { gapDeltas } from "@/lib/gap-sim";
import { majorFamily } from "@/lib/job-codes";
import type { RequirementsFile } from "@/lib/requirements";
import { getWorld } from "@/lib/worlds";

const ids = (process.argv[2] ?? "developer,nurse,civil-servant").split(",");
for (const id of ids) {
  const w = getWorld(id);
  const f = JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as RequirementsFile;
  const fam = majorFamily(DEMO_PROFILE.major);
  const r = (fam && f.byFamily?.[fam]) || f.default;
  const t0 = Date.now();
  const gaps = gapItems(r, DEMO_PROFILE, w);
  const deltas = gapDeltas(DEMO_PROFILE, w, 36, "2026-11", gaps);
  const rows = prioritize(gaps, w, DEMO_PROFILE, deltas);
  const c = (s: string) => gaps.filter((g) => g.status === s).length;
  console.log(`\n## ${w.name}: 있음 ${c("have")} 부분적 ${c("partial")} 없음 ${c("none")} (${Date.now() - t0}ms)`, deltas);
  console.log(
    "있음:",
    gaps
      .filter((g) => g.status === "have")
      .map((g) => g.item.name)
      .join(", ") || "없음",
  );
  rows.slice(0, 6).forEach((x, i) => console.log(`${i + 1}. [${x.status}${x.item.required ? " 필수" : ""}] ${x.title} ${x.score.toFixed(2)} | ${x.evidence.join(" · ")} | ${x.basis}`));
}

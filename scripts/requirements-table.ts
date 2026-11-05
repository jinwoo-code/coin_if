// 저장된 53개 진로의 필요한 것 목록을 표로 쓴다 → docs/필요한-것-목록.md. 네트워크 없음.
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_WORLD_IDS } from "@/lib/job-codes";
import type { Requirements, RequirementsFile } from "@/lib/requirements";
import { getWorld } from "@/lib/worlds";

const count = (r: Requirements, f: (i: Requirements["items"][number]) => boolean) => r.items.filter(f).length;

(async () => {
  let baseDate = "";
  let droppedTotal = 0;
  let inventedTotal = 0;
  const rows: string[] = [];
  const few: string[] = [];
  const noSkill: string[] = [];
  const noCert: string[] = [];
  for (const id of ALL_WORLD_IDS) {
    const w = getWorld(id);
    const file = JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as RequirementsFile;
    baseDate = file.builtAt;
    for (const [fam, r] of file.byFamily ? Object.entries(file.byFamily) : ([[null, file.default]] as const)) {
      droppedTotal += r.filter?.dropped.length ?? 0;
      inventedTotal += r.filter?.invented ?? 0;
      const official = count(r, (i) => i.grade !== "assumed");
      const label = fam ? `${w.name}(${fam})` : w.name;
      rows.push(
        `| ${label} | ${w.archetype} | ${r.items.length} | ${count(r, (i) => i.kind === "skill")} | ${count(r, (i) => i.kind === "cert")} | ${count(r, (i) => i.kind === "exam")} | ${count(r, (i) => i.kind === "experience" || i.kind === "step")} | ${count(r, (i) => i.source === "curated")} | ${count(r, (i) => i.source === "ncs")} | ${count(r, (i) => i.source === "careernet")} | ${count(r, (i) => i.source === "work24-job")} | ${count(r, (i) => Boolean(i.alsoIn?.length))} | ${count(r, (i) => i.source === "assumed")} | ${r.prep.length} |`,
      );
      if (official < 3) few.push(`${label}(${official}개)`);
      if (!count(r, (i) => i.kind === "skill")) noSkill.push(label);
      if (!count(r, (i) => i.kind === "cert")) noCert.push(label);
    }
  }
  const md = [
    "# 진로별 필요한 것 목록",
    "",
    `\`scripts/requirements-table.ts\`로 만든 표. 공식 데이터 기준일 ${baseDate}. '3개 미만'은 가정값을 뺀 항목(공식 API + 공식 문서 정리)으로 센다. AI가 걸러 낸 자격 ${droppedTotal}개, 목록에 없어 버린 응답 ${inventedTotal}개(data/requirements/filter-log.json).`,
    "",
    `## 공식 항목이 3개 미만인 진로 (${few.length}개)`,
    "",
    few.length ? few.map((x) => `- ${x}`).join("\n") : "없음",
    "",
    `능력(NCS) 없음 ${noSkill.length}개: ${noSkill.join(", ") || "없음"}`,
    "",
    `자격 없음 ${noCert.length}개: ${noCert.join(", ") || "없음"}`,
    "",
    "## 전체",
    "",
    "| 진로 | 유형 | 합계 | 능력 | 자격 | 시험 | 경험·절차 | 직접 정리 | NCS | 커리어넷 | 고용24 | 두 출처 겹침 | 가정값 | 준비 방법 문장 |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync("docs/필요한-것-목록.md", md);
  console.log(md);
})();

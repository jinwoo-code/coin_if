// 진로별 필요한 것 목록을 data/requirements/{진로id}.json으로 쓴다. 리포트는 이 파일만 읽는다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/build-requirements.ts [--sync 공식 데이터부터 다시] [--no-ai 지난 거르기 결과 재사용, 없으면 안 거름] [--only id,id]
// 걸러진 자격증은 data/requirements/filter-log.json에 남는다. 자격 후보가 그대로면 AI를 다시 안 부른다(같은 목록 유지).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import raw from "@/data/job-codes.json";
import { ALL_WORLD_IDS, type MajorFamily } from "@/lib/job-codes";
import { applyCertFilter, buildRequirements, type Requirements, type RequirementsFile } from "@/lib/requirements";
import { aiFilterCerts, curatedOf, groupSkills, resolveSources, type Snapshot } from "@/lib/requirements-build";
import { getWorld } from "@/lib/worlds";

const arg = (n: string) => process.argv.includes(n);
const only = arg("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const none = { ncs: async () => null, careernet: async () => null, work24: async () => null };

// 지난 결과와 자격 후보가 같으면 그 결정을 그대로 쓴다.
const certNames = (r: Requirements) => r.items.filter((i) => i.kind === "cert").map((i) => i.name);
function reuse(fresh: Requirements, old: Requirements | undefined): Requirements | null {
  if (!old?.filter || old.filter.mode !== "ai") return null;
  const before = [...certNames(old), ...old.filter.dropped.map((d) => d.name)].sort().join("|");
  if (before !== certNames(fresh).sort().join("|")) return null;
  const drop = new Set(old.filter.dropped.map((d) => d.name));
  return { ...fresh, items: fresh.items.filter((i) => !(i.kind === "cert" && drop.has(i.name))), filter: old.filter };
}

(async () => {
  if (arg("--sync")) execSync("npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/sync-requirements.ts", { stdio: "inherit" });
  const snap = JSON.parse(readFileSync("data/requirements/snapshot.json", "utf8")) as Snapshot;
  const log: Record<string, unknown> = existsSync("data/requirements/filter-log.json") ? JSON.parse(readFileSync("data/requirements/filter-log.json", "utf8")) : {};
  for (const id of only ?? ALL_WORLD_IDS) {
    const w = getWorld(id);
    const path = `data/requirements/${id}.json`;
    const prev = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as RequirementsFile) : null;
    const fams = Object.keys((raw as unknown as Record<string, { byFamily?: object }>)[id].byFamily ?? {}) as MajorFamily[];
    const make = async (fam: MajorFamily | null, old: Requirements | undefined) => {
      const { src } = await resolveSources(id, fam, none, snap, snap.date);
      const r = buildRequirements(id, w.archetype, src, snap.date, false, undefined, curatedOf(id));
      let out: Requirements;
      if (r.certPolicy === "curated-only") out = r;
      else out = reuse(r, old) ?? (arg("--no-ai") ? applyCertFilter(r, null) : await aiFilterCerts(r, w.name));
      // 능력 목록이 그대로면 지난 묶음을 쓴다(같은 목록 유지). AI 없이 나눈 묶음은 --no-ai가 아닐 때 다시 묶는다.
      const ids = (x: Requirements | undefined) =>
        x?.items
          .filter((i) => i.kind === "skill")
          .map((i) => i.id)
          .sort()
          .join("|");
      const oldGroups = ids(old) === ids(out) && old?.skillGroups?.length && (arg("--no-ai") || !old.skillGroups.some((g) => g.name.includes(" 등 "))) ? old.skillGroups : null;
      return oldGroups ? { ...out, skillGroups: oldGroups } : groupSkills(out, w.archetype, w.name, !arg("--no-ai"));
    };
    const def = await make(null, prev?.default);
    const file: RequirementsFile = { worldId: id, builtAt: snap.date, default: def };
    if (fams.length) {
      file.byFamily = {};
      for (const fam of fams) file.byFamily[fam] = await make(fam, prev?.byFamily?.[fam]);
    }
    writeFileSync(path, JSON.stringify(file, null, 1) + "\n");
    const all = [["기본", def] as const, ...Object.entries(file.byFamily ?? {})];
    log[id] = Object.fromEntries(all.map(([k, r]) => [k, r.filter ?? null]));
    const f = def.filter;
    console.log(id, def.items.length, f?.mode, f?.dropped.length ?? 0, f?.invented ?? 0);
  }
  writeFileSync("data/requirements/filter-log.json", JSON.stringify(log, null, 1) + "\n");
})();

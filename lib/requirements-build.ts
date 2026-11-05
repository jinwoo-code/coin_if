// 필요한 것 목록 만들기(스크립트 전용): 스냅샷 대체, 정리 파일 읽기, 자격증 AI 거르기.
import { readFileSync, existsSync } from "node:fs";
import type { MajorFamily } from "./job-codes";
import { codesFor } from "./job-codes";
import { generateJSON } from "./llm";
import { isNotCert } from "./cert-eligibility";
import { isEntryUnit, positionLevelOf, type NcsDutyFile } from "./ncs-data";
import { applyCertFilter, applySkillGroups, chunkSkills, type CareernetSource, type CuratedFile, type NcsBasic, type NcsUnit, type Requirements, type RequirementSources, type Work24Source } from "./requirements";

export interface Snapshot {
  date: string;
  ncs: Record<string, NcsUnit[]>;
  careernet: Record<string, CareernetSource>;
  work24: Record<string, Work24Source>;
}

export function curatedOf(worldId: string): CuratedFile | null {
  const p = `data/requirements/curated/${worldId}.json`;
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as CuratedFile) : null;
}

// 진로의 NCS 저장 파일(data/ncs/)을 목록 재료로 바꾼다. 코드가 없는 진로는 비어 있다.
export function ncsSourcesOf(worldId: string): { ncs: NcsUnit[]; ncsCerts: { name: string; job: string }[]; ncsBasics: NcsBasic[] } {
  const cfg = JSON.parse(readFileSync("data/ncs/duties.json", "utf8")) as { worlds: Record<string, { dutyCd: string }[]> };
  const files = (cfg.worlds[worldId] ?? []).map((d) => JSON.parse(readFileSync(`data/ncs/${d.dutyCd}.json`, "utf8")) as NcsDutyFile);
  return {
    ncs: files.flatMap((f) =>
      f.units.map((u) => ({
        name: u.name,
        def: u.def,
        job: f.dutyNm,
        ksa: [...u.knowledge, ...u.skills],
        criteria: u.elements.flatMap((e) => e.criteria),
        evalConsider: u.evalConsider,
        trainTime: u.trainTime,
        positionLevel: positionLevelOf(f, u),
        entry: isEntryUnit(f, u),
        ref: `국가직무능력표준 정보(${f.dutyNm} ${f.dutyCd}, 조회 ${f.fetchedAt})`,
      })),
    ),
    ncsCerts: files.flatMap((f) => f.certs.filter((name) => !isNotCert(name)).map((name) => ({ name, job: f.dutyNm }))),
    ncsBasics: files.flatMap((f) => f.basics ?? []),
  };
}

export async function resolveSources(
  worldId: string,
  family: MajorFamily | null,
  get: { ncs: (id: string) => Promise<NcsUnit[] | null>; careernet: (id: string) => Promise<CareernetSource | null>; work24: (code: string) => Promise<Work24Source | null> },
  fallback: Snapshot,
  today: string,
): Promise<{ src: RequirementSources; baseDate: string; stale: boolean }> {
  const codes = codesFor(worldId, family);
  let stale = false;
  const orSnap = <T>(live: T | null, old: T | undefined): T | null => {
    if (live) return live;
    if (old) stale = true;
    return old ?? null;
  };
  const [ncs, cn, wk] = await Promise.all([get.ncs(worldId), Promise.all(codes.careernet.map(get.careernet)), Promise.all(codes.work24.map(get.work24))]);
  const src: RequirementSources = {
    ncs: orSnap(ncs, fallback.ncs[worldId]) ?? [],
    careernet: cn.map((c, i) => orSnap(c, fallback.careernet[codes.careernet[i]])).filter((x): x is CareernetSource => Boolean(x)),
    work24: wk.map((w, i) => orSnap(w, fallback.work24[codes.work24[i]])).filter((x): x is Work24Source => Boolean(x)),
  };
  return { src, baseDate: stale ? fallback.date : today, stale };
}

// 시험형·면허형이 아닌 진로의 자격증에서 이 직업과 무관한 것을 AI가 고른다. 숫자·이름을 만들지 않고 후보 id만 답한다.
export async function aiFilterCerts(r: Requirements, jobName: string): Promise<Requirements> {
  const certs = r.items.filter((i) => i.kind === "cert");
  if (!certs.length) return { ...r, filter: { mode: "none", dropped: [], invented: 0 } };
  const res = await generateJSON<{ drop?: { id?: string; why?: string }[] } | null>({
    tag: "req-filter",
    model: "fast",
    system: '직업 준비 자격증 목록에서 이 직업과 무관한 항목만 고릅니다. 애매하면 남깁니다. 목록의 id만 씁니다. JSON으로만 답합니다: {"drop":[{"id":"목록의 id","why":"20자 이내 이유"}]}',
    prompt: `직업: ${jobName}\n자격증 후보:\n${certs.map((c) => `- ${c.id}: ${c.name}`).join("\n")}`,
    fallback: () => null,
  });
  return applyCertFilter(r, res);
}

// 능력단위를 3~4개로 묶는다. 시험형은 능력단위를 안 묻는다. 4개 이하면 AI 없이 낱개로.
export async function groupSkills(r: Requirements, archetype: string, jobName: string, useAi: boolean): Promise<Requirements> {
  if (archetype === "exam") return r;
  // 신입 뒤에 익힐 능력은 묻지 않는다.
  const skills = r.items.filter((i) => i.kind === "skill" && i.entry !== false);
  if (!skills.length) return r;
  if (skills.length <= 4 || !useAi) return { ...r, skillGroups: chunkSkills(skills) };
  const res = await generateJSON<{ groups?: { name?: string; ids?: string[] }[] } | null>({
    tag: "req-groups",
    model: "fast",
    system:
      '직업 능력단위를 비슷한 일끼리 3~4개로 묶습니다. 목록의 id만 쓰고 모든 id를 한 번씩 넣습니다. 이름은 학생이 "할 줄 안다"고 답할 수 있는 짧은 말(12자 이내)로 씁니다. JSON으로만 답합니다: {"groups":[{"name":"묶음 이름","ids":["목록의 id"]}]}',
    prompt: `직업: ${jobName}\n능력단위:\n${skills.map((s) => `- ${s.id}: ${s.name}`).join("\n")}`,
    fallback: () => null,
  });
  const out = applySkillGroups(skills, res);
  if (out.invented) console.log(`[능력 묶음] ${r.worldId}: 목록에 없는 id ${out.invented}개 버림`);
  return { ...r, skillGroups: out.groups };
}

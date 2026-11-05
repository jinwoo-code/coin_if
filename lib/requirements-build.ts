// 필요한 것 목록 만들기(스크립트 전용): 스냅샷 대체, 정리 파일 읽기, 자격증 AI 거르기.
import { readFileSync, existsSync } from "node:fs";
import type { MajorFamily } from "./job-codes";
import { codesFor } from "./job-codes";
import { generateJSON } from "./llm";
import { applyCertFilter, type CareernetSource, type CuratedFile, type NcsUnit, type Requirements, type RequirementSources, type Work24Source } from "./requirements";

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

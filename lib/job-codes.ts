// 진로 → 커리어넷 직업 번호·고용24 직업 코드(data/job-codes.json, 팀장 확인 2026-11-05).
// 출처별로 코드 최대 2개. 대학원·중등교사는 사용자 전공 계열로 고른다(byFamily).
import raw from "@/data/job-codes.json";

export type MajorFamily = "인문" | "사회" | "자연";
export interface CodeSet {
  careernet: string[];
  work24: string[];
}
interface Entry extends CodeSet {
  byFamily?: Partial<Record<MajorFamily, CodeSet>>;
  note?: string;
}

const data = raw as unknown as Record<string, Entry> & { _이름: Record<string, string> };
export const codeName = (id: string): string => data._이름[id] ?? id;
export const ALL_WORLD_IDS = Object.keys(data).filter((k) => !k.startsWith("_"));

// 전공 글자 → 계열. 공학·의약은 자연, 교육·예체능은 인문으로 묶는다(코드를 고르는 데만 쓴다). 모르면 null → 기본 코드.
export function majorFamily(major: string): MajorFamily | null {
  const m = major ?? "";
  if (/수학|과학|물리|화학|생물|생명|지구|천문|통계|컴퓨터|소프트웨어|전자|전기|기계|공학|건축|토목|의학|간호|약학|보건|치의|한의|수의|농|환경/.test(m)) return "자연";
  if (/경영|경제|사회|행정|법|정치|외교|심리|회계|세무|무역|금융|미디어|언론|광고|복지|관광/.test(m)) return "사회";
  if (/국어|영어|문학|어문|언어|사학|역사|철학|종교|문화|일어|중어|교육|음악|미술|디자인|체육|예술/.test(m)) return "인문";
  return null;
}

export function codesFor(worldId: string, family: MajorFamily | null = null): CodeSet {
  const e = data[worldId];
  if (!e) return { careernet: [], work24: [] };
  const f = family ? e.byFamily?.[family] : undefined;
  return f ?? { careernet: e.careernet, work24: e.work24 };
}

export const codeNote = (worldId: string): string | undefined => data[worldId]?.note;
// 계열마다 코드가 다른 진로까지 전부(스냅샷 만들 때)
export function everyCode(worldId: string): CodeSet {
  const e = data[worldId];
  if (!e) return { careernet: [], work24: [] };
  const all = [e, ...Object.values(e.byFamily ?? {})];
  return { careernet: [...new Set(all.flatMap((x) => x?.careernet ?? []))], work24: [...new Set(all.flatMap((x) => x?.work24 ?? []))] };
}

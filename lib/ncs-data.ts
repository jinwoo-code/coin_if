// NCS 저장 파일(data/ncs/{직무코드}.json) 모양과 신입 단위 고르기. 네트워크 없음.
import { W } from "./weights";

export interface NcsDutyUnit {
  compUnitCd: string;
  ncsClCd: string;
  name: string;
  def: string;
  level: number; // 능력단위 수준
  trainTime: number | null; // 훈련 기준 시간
  elements: { name: string; criteria: string[] }[]; // 요소와 수행준거
  knowledge: string[];
  skills: string[];
  attitude: string[];
  evalConsider: string[]; // 평가 고려사항
  evalMethodCodes: string[]; // 평가 방법 코드. 뜻을 확인 못 해서 화면에 안 쓴다
}
export interface NcsDutyFile {
  dutyCd: string;
  dutyNm: string;
  dutyDef: string;
  fetchedAt: string;
  units: NcsDutyUnit[];
  certs: string[]; // 관련자격종목
  positions: { level: number; name: string; units: string[] }[]; // 직책과 그 직책의 능력단위
  basics?: { name: string; desc: string; subs: string[] }[]; // 직업기초능력(공공기관 사무직만 받는다)
}

const norm = (s: string) => s.replace(/\s/g, "");

// 이 단위를 맡는 가장 낮은 직책 수준. 직책표에 없으면 능력단위 수준.
export function positionLevelOf(f: NcsDutyFile, u: NcsDutyUnit): number {
  const hits = f.positions.filter((p) => p.units.some((n) => norm(n) === norm(u.name))).map((p) => p.level);
  return hits.length ? Math.min(...hits) : u.level;
}

// 신입이 먼저 할 단위: 수준이 기준(가정값) 이하. 하나도 없으면 가장 낮은 수준의 단위.
export function isEntryUnit(f: NcsDutyFile, u: NcsDutyUnit): boolean {
  const levels = f.units.map((x) => positionLevelOf(f, x));
  const limit = Math.max(W("report.ncs.entryLevel"), Math.min(...levels));
  return positionLevelOf(f, u) <= limit;
}

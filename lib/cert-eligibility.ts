// 자격증 응시자격(신입 기준)과 종류. 규칙은 data/cert-eligibility.json, 판정은 코드(AI 없음).
import rules from "@/data/cert-eligibility.json";
import type { Profile, WorldTemplate } from "./types";

export type Eligibility = "open" | "ok" | "check" | "blocked";
export interface EligibilityResult {
  status: Eligibility; // open 제한 없음·규칙 없음, ok 조건을 채운 듯함, check 답이 없어 확인 필요, blocked 신입 계획에서 뺌
  why: string;
}
export const ELIGIBILITY_SOURCE = rules.source;

const GRADE = /(산업기사|기능장|기술사|기능사|기사)(\s*[(（][^)）]*[)）])?$/;
export function gradeOf(name: string): keyof typeof rules.grades | null {
  const m = name.trim().match(GRADE);
  return m ? (m[1] as keyof typeof rules.grades) : null;
}
const hit = (list: string[], name: string) => list.some((p) => new RegExp(p).test(name.trim()));
export const isVendorCert = (name: string) => hit(rules.vendor.patterns, name);
export const isNotCert = (name: string) => hit(rules.notCert.patterns, name);

function related(p: Profile, w: WorldTemplate): boolean | null {
  const m = p.major.replace(/\s/g, "");
  if (!m) return null;
  return w.majors.some((k) => m.includes(k.replace(/\s/g, "")));
}

export function eligibilityOf(name: string, p: Profile, w: WorldTemplate): EligibilityResult {
  const special = rules.experienceNames.find((x) => new RegExp(x.pattern).test(name.replace(/\s/g, "")));
  if (special) return { status: "blocked", why: special.text };
  const g = gradeOf(name);
  if (!g) return { status: "open", why: "" };
  const rule = rules.grades[g];
  if (rule.rule === "open") return { status: "open", why: "" };
  if (rule.rule === "experience") return { status: "blocked", why: rule.text };
  const rel = related(p, w);
  if (rel === null) return { status: "check", why: `전공을 안 적어 응시자격을 판단하지 못했어요. ${rule.text}` };
  const school = p.spec.school;
  const pass = rel && (school === "4년제" || school === "대학원" || (rule.rule === "college" && school === "전문대"));
  if (pass) return { status: "ok", why: `전공 기준으로 응시할 수 있어 보여요. 관련 학과 여부는 Q-Net에서 확인해 주세요` };
  return { status: "blocked", why: `지금 조건으로는 바로 응시하기 어려워요. ${rule.text}` };
}

// 자격 순서: 국가기술자격이면서 NCS 관련 → 국가기술자격 → NCS 관련 → 그 밖 → 업체 자격.
export function certClass(name: string, ncsRelated?: boolean): number {
  if (isVendorCert(name)) return 4;
  const tech = gradeOf(name) !== null;
  if (tech && ncsRelated) return 0;
  if (tech) return 1;
  return ncsRelated ? 2 : 3;
}

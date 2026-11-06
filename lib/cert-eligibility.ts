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

// 경력이 필요한 전문가급. unlessCerts·unlessSchools면 경력 없이도 응시할 수 있고, alternatives는 같은 분야에서 지금 볼 수 있는 자격이다.
export interface CertAlternative {
  name: string;
  sameAs: string; // 공백을 뺀 이름에 맞으면 이미 후보에 있는 것으로 본다
  ref: string;
  url: string;
}
export interface ExperienceRule {
  pattern: string;
  text: string;
  ref: string;
  url?: string;
  checkedAt?: string;
  unlessCerts?: string[];
  unlessSchools?: string[];
  alternatives?: CertAlternative[];
}
export const EXPERIENCE_RULES = rules.experienceNames as ExperienceRule[];
const squeeze = (s: string) => s.replace(/\s/g, "");

export function eligibilityOf(name: string, p: Profile, w: WorldTemplate): EligibilityResult {
  const special = EXPERIENCE_RULES.find((x) => new RegExp(x.pattern).test(squeeze(name)));
  if (special) {
    const held = special.unlessCerts?.find((c) => p.spec.certs.some((x) => squeeze(x).includes(c)));
    if (held || special.unlessSchools?.includes(p.spec.school)) return { status: "ok", why: `지금 조건으로 응시할 수 있어 보여요. ${special.text}` };
    return { status: "blocked", why: special.text };
  }
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
  // 전공 제한이 없다는 2차 자료만 있는 종목은 막지 않고 확인을 부탁한다.
  if ((school === "4년제" || school === "대학원") && hit(rules.anyMajorNames.patterns, name)) return { status: "check", why: `전공이 달라도 응시할 수 있다고 알려져 있어요. Q-Net 응시자격 자가진단으로 확인해 주세요` };
  return { status: "blocked", why: `지금 조건으로는 바로 응시하기 어려워요. ${rule.text}` };
}

// 같은 종류 안에서는 윗 등급부터(기능사 뒤로 미루기는 lib/gap.ts).
const GRADE_ORDER: Record<string, number> = { 기사: 0, 산업기사: 1 };
export const gradeRank = (name: string) => GRADE_ORDER[gradeOf(name) ?? ""] ?? 2;

// 자격 순서: 국가기술자격이면서 NCS 관련 → 국가기술자격 → NCS 관련 → 그 밖 → 업체 자격.
export function certClass(name: string, ncsRelated?: boolean): number {
  if (isVendorCert(name)) return 4;
  const tech = gradeOf(name) !== null;
  if (tech && ncsRelated) return 0;
  if (tech) return 1;
  return ncsRelated ? 2 : 3;
}

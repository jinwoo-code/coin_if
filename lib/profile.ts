// 프로필 기본값. 사용자가 건너뛴 항목은 '평범한 조건'으로 채운다.
import type { Behavior, Life, Profile, Spec, Wants } from "./types";

export const DEFAULT_SPEC: Spec = {
  school: "전문대",
  status: "재학",
  gpa: null,
  certs: [],
  toeic: null,
  projects: 1,
  gradIn: 12,
  workMonths: 0,
  internMonths: 0,
  awards: 0,
  github: null,
};

export const DEFAULT_LIFE: Life = {
  savings: 300,
  support: 50,
  livingCost: 90,
  military: "해당없음",
  enlistIn: null,
  region: "경기·인천",
  studyHours: 6,
  partTimeHours: 10,
};

export const DEFAULT_WANTS: Wants = { salary: 3500, hates: [] };
export const DEFAULT_BEHAVIOR: Behavior = { persistence: 3, risk: 3, coping: 3, social: 3 };

export function normalizeProfile(p: Partial<Profile> & Pick<Profile, "name">): Profile {
  return {
    major: "",
    dilemma: "",
    experiences: "",
    constraints: "",
    values: ["안정", "성장", "돈", "여유"],
    bigFive: { O: 3, C: 3, E: 3, A: 3, N: 3 },
    speechStyle: "",
    summary: "",
    interests: null,
    ...p,
    readiness: { ...p.readiness },
    spec: { ...DEFAULT_SPEC, ...p.spec },
    life: { ...DEFAULT_LIFE, ...p.life },
    wants: { ...DEFAULT_WANTS, ...p.wants },
    behavior: { ...DEFAULT_BEHAVIOR, ...p.behavior },
    depth: { bfiItems: 0, behaviorItems: 0, interestItems: 0, resume: false, github: false, spec: false, life: false, ...p.depth },
  };
}

// 프로필 정확도(0~100): 얼마나 많은 걸 알려 줬는지
export function precision(p: Profile): { score: number; missing: string[] } {
  const items: [boolean, number, string][] = [
    [p.depth.bfiItems >= 10, 10, "성격 검사"],
    [p.depth.bfiItems >= 50, 15, "정밀 성격 검사(50문항)"],
    [p.depth.behaviorItems >= 6, 15, "상황 질문"],
    [p.depth.interestItems >= 24, 15, "직업 흥미 검사"],
    [p.depth.spec || p.depth.resume, 10, "스펙 입력"],
    [p.depth.resume, 5, "이력서"],
    [p.depth.github, 5, "GitHub 연결"],
    [p.experiences.length > 10, 10, "경험 이야기"],
    [p.depth.life, 15, "생활 조건"],
  ];
  return {
    score: items.reduce((s, [ok, w]) => s + (ok ? w : 0), 0),
    missing: items.filter(([ok]) => !ok).map(([, , label]) => label),
  };
}

// 프로필 기본값. 사용자가 건너뛴 항목은 '평범한 조건'으로 채운다.
import { chaptersDone } from "./chapters";
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
    depthMode: "quick",
    holdout: null,
    holdoutPicks: {},
    story: null,
    since: null,
    corrections: [],
    checkins: [],
    pilot: null,
    ...p,
    storyRaw: { ...p.storyRaw },
    answers: { ...p.answers },
    readiness: { ...p.readiness },
    spec: { ...DEFAULT_SPEC, ...p.spec },
    life: { ...DEFAULT_LIFE, ...p.life },
    wants: { ...DEFAULT_WANTS, ...p.wants },
    behavior: { ...DEFAULT_BEHAVIOR, ...p.behavior },
    depth: { bfiItems: 0, behaviorItems: 0, interestItems: 0, resume: false, github: false, spec: false, life: false, ...p.depth },
  };
}

// 입력한 정보 체크리스트. 많이 입력했다고 분신이 나를 닮았다는 보장은 없어서 점수(%)로 보여 주지 않는다.
// 닮은 정도는 채점용 상황 질문으로 따로 잰다(분신 작업, docs/검사-설계-근거.md '닮은 정도 측정').
export function completeness(p: Profile): { items: { label: string; done: boolean; optional?: boolean }[]; missing: string[] } {
  const items = [
    { label: "가치관", done: p.values.length >= 4 },
    { label: "스펙", done: p.depth.spec || p.depth.resume },
    { label: "생활 조건", done: p.depth.life },
    { label: "성격 10문항", done: p.depth.bfiItems >= 10 },
    { label: "상황 질문 6개", done: p.depth.behaviorItems >= 6 },
    { label: "성격 50문항", done: p.depth.bfiItems >= 50 },
    { label: "흥미 검사", done: p.depth.interestItems >= 24 },
    { label: "상황 질문 18개", done: p.depth.behaviorItems >= 12 },
    { label: "경험 이야기", done: p.experiences.trim().length > 0 },
    { label: "나에 대한 이야기", done: p.story !== null },
    { label: `인생 이야기 ${chaptersDone(p)}/6장`, done: chaptersDone(p) === 6, optional: true },
    { label: "이력서·GitHub", done: p.depth.resume || p.depth.github, optional: true },
  ];
  return { items, missing: items.filter((i) => !i.done && !i.optional).map((i) => i.label) };
}

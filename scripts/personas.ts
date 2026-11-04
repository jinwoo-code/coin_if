// 대표 인물 5명(scripts/sensitivity.ts, scripts/diagnose-judge.ts가 같이 쓴다).
import { normalizeProfile } from "../lib/profile";
import type { StorySignals } from "../lib/story";
import type { Life, Profile, Spec } from "../lib/types";

const ev = "민감도 분석용 가상 인물";
const story = (s: Partial<StorySignals>): StorySignals => ({ decisionStyle: null, persistence: null, familyExpectation: null, regretType: null, coreValues: [], runwayMonths: null, ...s });
const base: { dilemma: string; spec: Spec; life: Life } = {
  dilemma: "민감도",
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 6, partTimeHours: 10 },
};

// 대표 인물 5명. 준비도 질문은 답하지 않음(진로마다 기본 보기). 스펙은 개인 배수가 골고루 걸리도록 조금씩 다르게 둔다.
export const PERSONAS: { id: string; desc: string; p: Profile }[] = [
  {
    id: "평균",
    desc: "성격·상황 질문 모두 3(보통), 가치관 안정·성장·돈·여유, 이야기 없음",
    p: normalizeProfile({ name: "평균", ...base, spec: { ...base.spec }, life: { ...base.life } }),
  },
  {
    id: "끈기 높음",
    desc: "성실성 4.5, 끈기 5, 대처 4, 이야기 끈기 5. 자격증 1개, 학점 3.9",
    p: normalizeProfile({
      name: "끈기 높음",
      ...base,
      values: ["성장", "안정", "인정", "돈"],
      bigFive: { O: 3, C: 4.5, E: 3, A: 3, N: 2.5 },
      behavior: { persistence: 5, risk: 3, coping: 4, social: 3 },
      spec: { ...base.spec, certs: ["정보처리기사"], gpa: 3.9 },
      life: { ...base.life },
      story: story({ persistence: { value: 5, evidence: ev, confidence: 0.8 }, decisionStyle: { value: "deliberate", evidence: ev, confidence: 0.8 } }),
    }),
  },
  {
    id: "도전형",
    desc: "개방성 4.5, 위험 감수 5, 가치관 자율·성장 먼저, 이야기 '일단 하고 보는 편'·'안 해서 후회'. 프로젝트 3개, 수상 1회",
    p: normalizeProfile({
      name: "도전형",
      ...base,
      values: ["자율", "성장", "돈", "인정"],
      bigFive: { O: 4.5, C: 3, E: 4, A: 3, N: 2.5 },
      behavior: { persistence: 3, risk: 5, coping: 3.5, social: 3 },
      spec: { ...base.spec, projects: 3, awards: 1 },
      life: { ...base.life },
      story: story({ decisionStyle: { value: "impulsive", evidence: ev, confidence: 0.8 }, regretType: { value: "inaction", evidence: ev }, coreValues: [{ value: "자율", evidence: ev }] }),
    }),
  },
  {
    id: "가족 기대 큼",
    desc: "가치관 안정·관계 먼저, 이야기 '가족이 안정적인 일을 바람'(강도 5). 서울, 토익 850, 한국사 2급",
    p: normalizeProfile({
      name: "가족 기대 큼",
      ...base,
      values: ["안정", "관계", "돈", "여유"],
      bigFive: { O: 2.5, C: 3.5, E: 3, A: 4, N: 3.5 },
      behavior: { persistence: 3, risk: 2, coping: 3, social: 4 },
      spec: { ...base.spec, toeic: 850, certs: ["한국사2급"] },
      life: { ...base.life, region: "서울", support: 100 },
      story: story({ familyExpectation: { value: "stable", strength: 5, evidence: ev }, decisionStyle: { value: "follow", evidence: ev, confidence: 0.8 }, coreValues: [{ value: "안정", evidence: ev }] }),
    }),
  },
  {
    id: "후회형",
    desc: "신경성 4.5, 위험 감수 2, 대처 2, 이야기 '해서 후회한 적이 많음'. 인턴 3개월, 지방 광역시",
    p: normalizeProfile({
      name: "후회형",
      ...base,
      values: ["안정", "여유", "성장", "관계"],
      bigFive: { O: 3, C: 3, E: 2.5, A: 3, N: 4.5 },
      behavior: { persistence: 2.5, risk: 2, coping: 2, social: 3 },
      spec: { ...base.spec, internMonths: 3 },
      life: { ...base.life, region: "지방 광역시" },
      story: story({ regretType: { value: "action", evidence: ev }, persistence: { value: 2, evidence: ev, confidence: 0.7 } }),
    }),
  },
];

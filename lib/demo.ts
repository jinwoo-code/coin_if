// 발표용 예시 인물. 첫 화면의 '예시로 바로 보기'에서 쓴다.
import { normalizeProfile } from "./profile";
import type { Selection } from "./types";
import { nextMonthYm } from "./calendar";

export const DEMO_PROFILE = normalizeProfile({
  name: "김민준",
  major: "컴퓨터모바일융합과 2학년",
  dilemma: "개발자로 바로 취업할지, 공무원 시험을 준비할지 모르겠어요",
  experiences: "동아리에서 친구들과 학교 공지 알림 앱을 만들어 봤고, 편의점 알바를 1년 했어요",
  constraints: "집이 경기도라 수도권에서 일하고 싶고, 졸업하면 빨리 돈을 벌어야 해요",
  values: ["안정", "성장", "돈", "여유"],
  bigFive: { O: 4, C: 3.5, E: 2.5, A: 3.5, N: 3.5 },
  speechStyle: "짧게 끊어 말하고, 솔직한 속마음을 말할 때는 '솔직히'로 시작하는 편",
  summary: "안정을 가장 중요하게 여기지만 제자리에 머무는 건 싫어해요. 만들어 보는 경험에서 재미를 느낀 적이 있어요.",
  spec: { school: "전문대", status: "졸업예정", gradIn: 3, gpa: 3.6, certs: ["정보처리산업기사"], toeic: null, projects: 2, workMonths: 12, internMonths: 0, awards: 0, github: null },
  readiness: { coding: 2 },
  life: { savings: 400, support: 30, livingCost: 90, military: "군필", enlistIn: null, region: "경기·인천", studyHours: 7, partTimeHours: 12 },
  wants: { salary: 3600, hates: ["주말근무", "민원"] },
  behavior: { persistence: 3.5, risk: 2.5, coping: 3, social: 3 },
  depth: { bfiItems: 10, behaviorItems: 6, interestItems: 0, resume: false, github: false, spec: true, life: true },
});

export const demoSelection = (): Selection => ({ worldIds: ["developer", "civil-servant"], months: 36, startYm: nextMonthYm() });

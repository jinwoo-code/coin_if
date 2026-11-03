// 직무 준비도 질문 모음. 진로마다 이 중 2~3개를 골라 묻는다(진로 파일의 readiness).
// 보기마다 '평범한 지원자 대비 확률 배수'가 붙어 있다. 배수는 data/weights.json(readiness.<id>)에 있고, 가정값이면 화면에 그대로 공개한다.
import { WEIGHTS } from "./weights";

export interface ReadinessQ {
  label: string;
  options: { t: string; mult: number }[];
  def: number; // 답하지 않았을 때 쓰는 보기
  better?: string; // '바꿀 수 있는 것'에 쓰는 문장(한 단계 올리면)
}

const Q: Record<string, Omit<ReadinessQ, "options"> & { options: { t: string }[] }> = {
  coding: {
    label: "코딩 실력",
    options: [{ t: "거의 안 해 봄" }, { t: "기초 문법" }, { t: "코딩테스트 쉬운 문제" }, { t: "코딩테스트 중급 이상" }],
    def: 1,
    better: "코딩 실력을 한 단계 올리면",
  },
  portfolio: {
    label: "포트폴리오",
    options: [{ t: "아직 없음" }, { t: "초안 정도" }, { t: "완성본 있음" }, { t: "수상·외주 경험까지" }],
    def: 1,
    better: "포트폴리오를 한 단계 더 다듬으면",
  },
  practice: {
    label: "현장·임상 실습",
    options: [{ t: "아직 안 함" }, { t: "1번 해 봄" }, { t: "2번 이상" }],
    def: 1,
    better: "실습을 한 번 더 하면",
  },
  license: {
    label: "면허·필수 자격",
    options: [{ t: "공부 시작 전" }, { t: "공부 중" }, { t: "시험 볼 수 있음" }, { t: "이미 땄음" }],
    def: 2,
    better: "면허 준비를 한 단계 앞당기면",
  },
  fieldCert: {
    label: "기능사·산업기사",
    options: [{ t: "없음" }, { t: "기능사" }, { t: "산업기사 이상" }],
    def: 0,
    better: "관련 기능사·산업기사를 따면",
  },
  teaching: {
    label: "교원 자격",
    options: [{ t: "없음" }, { t: "교직 이수 중" }, { t: "취득(예정)" }],
    def: 2,
  },
  language: {
    label: "외국어 회화",
    options: [{ t: "기본" }, { t: "일상 대화" }, { t: "업무 가능" }],
    def: 1,
    better: "외국어 회화를 업무 수준으로 올리면",
  },
  service: {
    label: "고객 응대·영업 경험",
    options: [{ t: "없음" }, { t: "6개월 미만" }, { t: "6개월 이상" }],
    def: 0,
    better: "고객 응대 경험을 6개월 이상 쌓으면",
  },
  research: {
    label: "연구 경험",
    options: [{ t: "없음" }, { t: "학부연구생" }, { t: "논문·학회 발표" }],
    def: 0,
    better: "학부연구생을 해 보면",
  },
  fitness: {
    label: "체력 시험 준비",
    options: [{ t: "아직 안 함" }, { t: "준비 중" }, { t: "기준 통과 수준" }],
    def: 1,
    better: "체력 시험을 기준 통과 수준까지 올리면",
  },
  writing: {
    label: "글쓰기·취재 경험",
    options: [{ t: "없음" }, { t: "학보·블로그" }, { t: "수상·기고" }],
    def: 0,
    better: "학보사나 기고로 글을 실어 보면",
  },
  idea: {
    label: "창업 아이템 단계",
    options: [{ t: "아이디어만" }, { t: "시제품 있음" }, { t: "첫 매출 있음" }],
    def: 0,
    better: "시제품을 먼저 만들어 보면",
  },
  dataTool: {
    label: "엑셀·SQL·통계 도구",
    options: [{ t: "기초" }, { t: "실습 수준" }, { t: "분석 프로젝트 경험" }],
    def: 0,
    better: "데이터 분석 프로젝트를 하나 해 보면",
  },
  sns: {
    label: "SNS·콘텐츠 운영",
    options: [{ t: "없음" }, { t: "개인 계정 운영" }, { t: "팔로워 1천+ 또는 성과" }],
    def: 0,
    better: "SNS 계정을 키워 성과를 만들면",
  },
  office: {
    label: "사무 도구(엑셀·문서)",
    options: [{ t: "기초" }, { t: "능숙" }, { t: "컴활 등 자격까지" }],
    def: 1,
    better: "엑셀·문서 실력을 자격증 수준으로 올리면",
  },
};

// 배수는 파일 값(민감도 분석의 배율은 factors.ts가 WA로 따로 읽는다)
export const READINESS: Record<string, ReadinessQ> = Object.fromEntries(Object.entries(Q).map(([id, q]) => [id, { ...q, options: q.options.map((o, i) => ({ ...o, mult: (WEIGHTS[`readiness.${id}`].value as number[])[i] })) }]));

export function answerOf(readiness: Record<string, number>, id: string) {
  const q = READINESS[id];
  const v = readiness[id];
  return v === undefined || !q?.options[v] ? (q?.def ?? 0) : v;
}

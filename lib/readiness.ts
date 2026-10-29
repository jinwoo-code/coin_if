// 직무 준비도 질문 모음. 진로마다 이 중 2~3개를 골라 묻는다(진로 파일의 readiness).
// 보기마다 '평범한 지원자 대비 확률 배수'가 붙어 있다. 배수는 가정값이고 화면에 그대로 공개한다.

export interface ReadinessQ {
  label: string;
  options: { t: string; mult: number }[];
  def: number; // 답하지 않았을 때 쓰는 보기
  better?: string; // '바꿀 수 있는 것'에 쓰는 문장(한 단계 올리면)
}

export const READINESS: Record<string, ReadinessQ> = {
  coding: {
    label: "코딩 실력",
    options: [
      { t: "거의 안 해 봄", mult: 0.4 },
      { t: "기초 문법", mult: 0.7 },
      { t: "코딩테스트 쉬운 문제", mult: 1 },
      { t: "코딩테스트 중급 이상", mult: 1.4 },
    ],
    def: 1,
    better: "코딩 실력을 한 단계 올리면",
  },
  portfolio: {
    label: "포트폴리오",
    options: [
      { t: "아직 없음", mult: 0.5 },
      { t: "초안 정도", mult: 0.8 },
      { t: "완성본 있음", mult: 1.1 },
      { t: "수상·외주 경험까지", mult: 1.4 },
    ],
    def: 1,
    better: "포트폴리오를 한 단계 더 다듬으면",
  },
  practice: {
    label: "현장·임상 실습",
    options: [
      { t: "아직 안 함", mult: 0.7 },
      { t: "1번 해 봄", mult: 1 },
      { t: "2번 이상", mult: 1.15 },
    ],
    def: 1,
    better: "실습을 한 번 더 하면",
  },
  license: {
    label: "면허·필수 자격",
    options: [
      { t: "공부 시작 전", mult: 0.6 },
      { t: "공부 중", mult: 0.9 },
      { t: "시험 볼 수 있음", mult: 1 },
      { t: "이미 땄음", mult: 1.3 },
    ],
    def: 2,
    better: "면허 준비를 한 단계 앞당기면",
  },
  fieldCert: {
    label: "기능사·산업기사",
    options: [
      { t: "없음", mult: 0.7 },
      { t: "기능사", mult: 1 },
      { t: "산업기사 이상", mult: 1.25 },
    ],
    def: 0,
    better: "관련 기능사·산업기사를 따면",
  },
  teaching: {
    label: "교원 자격",
    options: [
      { t: "없음", mult: 0.15 },
      { t: "교직 이수 중", mult: 0.9 },
      { t: "취득(예정)", mult: 1 },
    ],
    def: 2,
  },
  language: {
    label: "외국어 회화",
    options: [
      { t: "기본", mult: 0.75 },
      { t: "일상 대화", mult: 1 },
      { t: "업무 가능", mult: 1.3 },
    ],
    def: 1,
    better: "외국어 회화를 업무 수준으로 올리면",
  },
  service: {
    label: "고객 응대·영업 경험",
    options: [
      { t: "없음", mult: 0.85 },
      { t: "6개월 미만", mult: 1 },
      { t: "6개월 이상", mult: 1.2 },
    ],
    def: 0,
    better: "고객 응대 경험을 6개월 이상 쌓으면",
  },
  research: {
    label: "연구 경험",
    options: [
      { t: "없음", mult: 0.7 },
      { t: "학부연구생", mult: 1 },
      { t: "논문·학회 발표", mult: 1.3 },
    ],
    def: 0,
    better: "학부연구생을 해 보면",
  },
  fitness: {
    label: "체력 시험 준비",
    options: [
      { t: "아직 안 함", mult: 0.6 },
      { t: "준비 중", mult: 0.9 },
      { t: "기준 통과 수준", mult: 1.1 },
    ],
    def: 1,
    better: "체력 시험을 기준 통과 수준까지 올리면",
  },
  writing: {
    label: "글쓰기·취재 경험",
    options: [
      { t: "없음", mult: 0.7 },
      { t: "학보·블로그", mult: 1 },
      { t: "수상·기고", mult: 1.3 },
    ],
    def: 0,
    better: "학보사나 기고로 글을 실어 보면",
  },
  idea: {
    label: "창업 아이템 단계",
    options: [
      { t: "아이디어만", mult: 0.6 },
      { t: "시제품 있음", mult: 1 },
      { t: "첫 매출 있음", mult: 1.5 },
    ],
    def: 0,
    better: "시제품을 먼저 만들어 보면",
  },
  dataTool: {
    label: "엑셀·SQL·통계 도구",
    options: [
      { t: "기초", mult: 0.8 },
      { t: "실습 수준", mult: 1 },
      { t: "분석 프로젝트 경험", mult: 1.3 },
    ],
    def: 0,
    better: "데이터 분석 프로젝트를 하나 해 보면",
  },
  sns: {
    label: "SNS·콘텐츠 운영",
    options: [
      { t: "없음", mult: 0.8 },
      { t: "개인 계정 운영", mult: 1 },
      { t: "팔로워 1천+ 또는 성과", mult: 1.3 },
    ],
    def: 0,
    better: "SNS 계정을 키워 성과를 만들면",
  },
  office: {
    label: "사무 도구(엑셀·문서)",
    options: [
      { t: "기초", mult: 0.85 },
      { t: "능숙", mult: 1 },
      { t: "컴활 등 자격까지", mult: 1.15 },
    ],
    def: 1,
    better: "엑셀·문서 실력을 자격증 수준으로 올리면",
  },
};

export function answerOf(readiness: Record<string, number>, id: string) {
  const q = READINESS[id];
  const v = readiness[id];
  return v === undefined || !q?.options[v] ? (q?.def ?? 0) : v;
}

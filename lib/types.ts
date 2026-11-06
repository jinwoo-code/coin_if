// 서비스 전체에서 쓰는 데이터 모양. 여기만 보면 어떤 데이터가 오가는지 알 수 있다.

// ---------- 나(프로필) ----------

import type { StorySignals } from "./story";

export type DepthMode = "quick" | "standard" | "deep" | "ongoing";

export interface Answers {
  sjt?: Record<string, number>; // 상황 질문 id → 고른 보기 번호(학습용만, 채점용은 holdoutPicks)
  ipip?: Record<string, number>; // IPIP 50 문항 id → 1~5
  riasec?: Record<string, number>; // 흥미 24 문항 id → 1~5
}

export type ValueKey = "안정" | "성장" | "돈" | "여유" | "인정" | "자율" | "기여" | "관계";

// 성격 5요인, 1~5
export interface BigFive {
  O: number; // 개방성
  C: number; // 성실성
  E: number; // 외향성
  A: number; // 우호성
  N: number; // 신경성(불안)
}

// 직업 흥미(홀랜드 RIASEC), 1~5
export interface Interests {
  R: number; // 현실형: 손으로 만들고 고치기
  I: number; // 탐구형: 분석하고 원리 찾기
  A: number; // 예술형: 표현하고 새로 만들기
  S: number; // 사회형: 사람 돕고 가르치기
  E: number; // 진취형: 설득하고 이끌기
  C: number; // 관습형: 정리하고 정확히 처리하기
}

export type CertId = string; // 자격증 이름(전공마다 달라서 자유 입력)

// 스펙
export interface Spec {
  school: "고졸" | "전문대" | "4년제" | "대학원";
  status: "재학" | "졸업예정" | "졸업";
  gpa: number | null; // 4.5 만점
  gradIn: number; // 졸업까지 남은 개월(졸업했으면 0). 정규직 채용은 졸업 뒤부터
  certs: CertId[];
  toeic: number | null;
  projects: number; // 끝까지 해 본 프로젝트·작품·실습 수(전공 무관)
  workMonths: number; // 근로·알바 경력(개월)
  internMonths: number; // 인턴·현장실습(개월)
  awards: number; // 공모전·대회 수상
  github: string | null;
}

// 생활 조건
export interface Life {
  savings: number; // 지금 모아 둔 돈(만원)
  support: number; // 집에서 매달 받을 수 있는 돈(만원)
  livingCost: number; // 한 달 생활비(만원)
  military: "군필" | "면제" | "해당없음" | "미필";
  enlistIn: number | null; // 미필이면 몇 개월 뒤 입대 예정(null이면 기간 안에 안 감)
  region: "서울" | "경기·인천" | "지방 광역시" | "그 외 지역";
  studyHours: number; // 하루에 공부·준비에 쓸 수 있는 시간
  partTimeHours: number; // 주당 알바·근로 시간
}

export type HateTag = "야근" | "주말근무" | "민원" | "반복업무" | "낮은연봉" | "불안정" | "지방근무" | "실적압박";

export interface Wants {
  salary: number; // 희망 첫 연봉(만원)
  hates: HateTag[];
}

// 상황 질문으로 본 실제 행동 성향, 1~5
export interface Behavior {
  persistence: number; // 끈기: 안 풀려도 계속 하는지
  risk: number; // 위험 감수: 불확실해도 움직이는지
  coping: number; // 스트레스 대처: 힘들 때 회복하는지
  social: number; // 도움 요청: 막히면 사람에게 묻는지
}

// 인터뷰로 만든 '나'
// 파일럿 사용 전·후 설문(lib/pilot.ts). 같은 질문을 두 번 묻는다.
export interface PilotSurveyAnswer {
  confidence: number; // 진로 결정 확신도 1~5
  careers: string[]; // 고려 중인 진로
  hasAction: boolean; // 이번 주에 할 일이 있는가
  at: string;
  usedBefore?: boolean; // 사전 설문 전에 이미 앱을 쓴 사람(전후 비교에서 뺀다)
}
export interface PilotSurvey {
  pre?: PilotSurveyAnswer;
  post?: PilotSurveyAnswer;
  changed?: string; // "판단이 바뀌었나요? 무엇이요?" 자유 답
}

export interface Profile {
  name: string;
  major: string;
  dilemma: string; // 고민 중인 선택
  experiences: string; // 지금까지의 경험
  constraints: string; // 현실 제약(돈, 가족, 지역 등)
  values: ValueKey[]; // 중요한 순서대로(4개)
  bigFive: BigFive;
  speechStyle: string; // '그때의 나'가 따라 할 말투 설명
  summary: string; // AI가 이해한 나, 한두 문장
  spec: Spec;
  life: Life;
  wants: Wants;
  behavior: Behavior;
  interests: Interests | null;
  readiness: Record<string, number>; // 진로별 직무 준비도 질문 답(lib/readiness.ts의 보기 번호)
  // 커리어넷 직업가치관검사 결과(점수는 안 주고 결과 페이지 주소만 준다). 시뮬레이션에는 쓰지 않는다.
  valuesTest?: { seq: number; url: string; at: string };
  // 검사 깊이(사용자가 고름, lib/assessment.ts). 정밀·계속 닮아 가기는 아직 준비 중이라 고를 수 없다.
  depthMode: DepthMode;
  // 검사 원답. 깊이를 올릴 때 이미 답한 건 다시 묻지 않고, 점수를 다시 계산하는 데 쓴다.
  answers: Answers;
  // 채점용 상황 질문(사람마다 시드로 고정, lib/tests.ts pickHoldout)과 그 답. 답은 성향 점수에 넣지 않는다.
  // 분신 채점(lib/twin.ts)이 이 답으로 맞힌 개수·브라이어 점수를 낸다.
  holdout: { seed: string; ids: string[] } | null;
  holdoutPicks: Record<string, number>;
  // 인생 이야기에서 뽑아 사용자가 '맞아요'로 확인한 값만(lib/story.ts). 원문은 storyRaw.
  // 엔진에서 쓰는 곳: lib/story.ts 아래쪽(끈기·부합도·이유 인용), lib/engine.ts pushes(결정 방식·가족 기대·후회 → tone)·생활비 바닥(버틸 기간).
  story: StorySignals | null;
  // 인생 이야기 원문, 장별 { 장: { 질문 id: 답 } }. 이 기기에만 저장(계정 동기화에서 뺀다). 대화·이야기 문장에만 쓰고 확률·선택 계산에는 쓰지 않는다.
  storyRaw: Record<string, Record<string, string>>;
  // 계속 닮아 가기(docs/검사-설계-근거.md). since: 검사를 처음 끝낸 때(한 달 체크인 기준)
  since: string | null;
  // 시뮬레이션에서 '나라면 이렇게 안 해'로 고친 선택, 체크인에서 말한 실제 선택. 엔진 pushes가 tone 무게에 더한다.
  corrections: Correction[];
  checkins: Checkin[];
  checkinMail?: boolean; // 체크인 때가 되면 메일 받기(본인이 켠 경우만)
  // 파일럿(lib/pilot.ts): 파일럿 동의 판·때, 빠진 때. 파일럿 답은 holdoutPicks의 p1~p20.
  pilot: { version: string; consentAt: string; withdrawnAt: string | null; survey?: PilotSurvey } | null;
  // AI 분신 판단 캐시(lib/judge.ts). 큰 갈림길 × 상황 칸마다 보기별 확률·이유. 키에 프로필 해시가 있어 프로필이 바뀌면 안 쓰인다.
  judges?: Record<string, { probs: number[]; reasons: string[]; shift?: string; src: "ai" | "mock" | "fallback" }>;
  // 어떤 검사를 했는지(입력한 정보 표시용)
  legacyBigFive?: boolean; // 예전 검사(10문항)로 잰 성격 값. Mini-IPIP를 답할 때까지 그대로 쓰고 다시 답하라고 안내한다
  depth: { bigFiveItems: number; behaviorItems: number; interestItems: number; resume: boolean; github: boolean; spec: boolean; life: boolean };
}

// ---------- 시뮬레이션 상태 ----------

// 0~100 점수 + 실제 단위 값
export interface LifeState {
  skill: number; // 직무 역량 0~100
  stress: number; // 스트레스 0~100
  satisfaction: number; // 만족도 0~100
  relation: number; // 인간관계 0~100
  money: number; // 모은 돈(만원, 빚이면 음수)
}

export interface StatEvidence {
  label: string; // 화면에 뜨는 한 줄(실제 숫자)
  source: string; // 출처 이름
  url?: string;
}

// 직업 세계의 '사실'(근거 패널에 그대로 보여 준다)
export interface Fact {
  label: string;
  value: string;
  source: string;
  year: string;
  url?: string;
}

// 개인 조건이 확률을 바꾸는 요인 이름(lib/factors.ts에서 계산)
export type FactorKey = "jobReady" | "examPower" | "region" | "school" | "persistence" | "military";

export interface Choice {
  text: string;
  tone: "push" | "change" | "safe"; // 더 밀어붙임(노력·재도전) / 바꿈(이직·전향) / 신중함(쉬기·남기)
  effect?: Partial<LifeState>;
  sets?: string; // 이 선택을 하면 켜지는 상태(예: "moved" 이직함)
  raise?: number; // 연봉 변화(%). 예: 이직 +12
  quits?: boolean; // 직장을 그만둠
  label?: string; // 갈림길 이름(세계선 나무에 쓰임)
  base?: BaseShare; // 같은 상황에서 실제 사람들이 이 보기를 고른 비율(data/base-shares.json에서 붙임)
}

// 기준 비율의 근거: stat = 공개 통계(ref에 출처·연도·URL), interview = 현직자 인터뷰(ref에 "현직자 N명"), assumed = 가정값
export type BaseGrade = "stat" | "interview" | "assumed";
export interface BasePopulation {
  label: string; // 예: "일 경험 없는 15~29세 남성 실업자 기준"
  noWork?: boolean; // 일 경험(경력·인턴)이 없는 사람 대상
  unchecked?: string[]; // 통계 조건 중 앱이 묻지 않아 확인할 수 없는 것(예: 성별). 있으면 같은 집단이라고 말하지 않는다
}
export interface BaseShare {
  share: number; // 상황을 가리지 않은 전체 비율(한 갈림길의 보기 합 1)
  grade: BaseGrade;
  ref?: string;
  n?: number; // grade "interview"일 때 현직자 인원
  population?: BasePopulation; // grade "stat"일 때 통계의 대상 집단
  byState?: Record<string, number>; // 상황 칸(lib/base.ts bucketOf)별 비율. 없는 칸은 share를 쓴다
}

// 갈림길 기준 비율을 나누는 상황 키(lib/base.ts)
export type StateKey = "stress" | "money" | "prep" | "tenure";

// 진로 세계에 미리 넣어 두는 사건 카드
export interface EventCard {
  id: string;
  title: string;
  kind: "good" | "bad" | "neutral";
  weight: number; // 기본 발생 가중치
  branch?: "luck" | "choice"; // 갈림길: 운으로 갈리는지, 내 선택으로 갈리는지
  branchLabel?: string; // 세계선 나무에 쓰는 짧은 이름
  minMonth?: number; // 시작 후 이 달부터 발생 가능
  maxMonth?: number;
  calendar?: number[]; // 실제 달력에서 이 달에만 일어남(예: 국가직 9급 발표 5월)
  requires?: string[]; // 이 사건/상태가 모두 먼저 있어야 함
  excludes?: string[]; // 이 사건/상태가 하나라도 있으면 안 일어남
  afterGrad?: boolean; // 졸업한 뒤에만(정규직 채용, 면허 시험 등)
  gradGrace?: number; // afterGrad여도 졸업 이만큼(개월) 전부터 가능(예: 국가시험은 졸업 직전 1~2월)
  needsJob?: boolean; // 일하는 중일 때만
  needsNoJob?: boolean; // 일하지 않을 때만
  minTenure?: number; // 지금 직장에서 이만큼(개월) 다닌 뒤에만
  maxTenure?: number; // 지금 직장에서 이만큼(개월) 안에만(예: 첫 실수는 신입 때)
  repeatable?: boolean; // 여러 번 일어나도 되는 일상 사건
  competition?: number; // 시험 관문의 경쟁률. 있으면 확률은 k ÷ 경쟁률(lib/weights.ts examChance)
  chance?: number; // 관문(합격·취업): 조건이 되면 이 확률로 굴린다(한 달 기준, calendar가 있으면 그 달 한 번)
  factors?: FactorKey[]; // 관문 확률에 곱하는 개인 요인
  warmup?: number; // 준비를 시작하고 이 개월 수가 지나야 확률이 온전히 적용됨(그 전엔 비례해서 낮음)
  hires?: boolean; // 이 사건으로 일을 시작함
  tiers?: { id: string; group: string; label: string; salary: number; weight: number }[]; // 합격한 곳의 규모별 연봉(만원)과 비율, group은 세계선 나무에서 묶는 단위
  onlyTier?: string[]; // 이 규모의 회사에 다닐 때만(예: 구조조정은 작은 회사)
  tags?: HateTag[]; // 이 사건이 '싫은 것'에 해당하면 만족도가 더 깎임
  text: string; // 목업 모드에서 쓰는 기본 서술
  choices: Choice[];
  stateKeys?: StateKey[]; // 기준 비율을 상황별로 나누는 키 1~2개(보기가 2개 이상인 갈림길)
  effect: Partial<LifeState>;
  evidence?: StatEvidence;
}

export interface Npc {
  name: string;
  role: string;
  persona: string;
}

export type Archetype = "open" | "exam" | "license" | "portfolio" | "trade" | "public" | "grad" | "startup";

export interface WorldTemplate {
  id: string;
  family: string; // 계열(공학, 사회·경영 ...)
  archetype: Archetype;
  majors: string[]; // 관련 전공 키워드
  readiness: string[]; // 묻는 직무 준비도 질문(lib/readiness.ts)
  certs: string[]; // 도움이 되는 자격증
  curated?: boolean; // 사람이 사건을 하나하나 쓴 진로(나머지는 유형 틀로 만든 진로)
  name: string; // 예: "웹 백엔드 개발자"
  short: string; // 예: "개발자"
  subtitle: string;
  color: string; // 노선 색
  onColor: string; // 노선 색 위에 올라가는 글자 색(대비 4.5:1 이상)
  badge: string; // 노선 기호 A, B, C...
  fitValues: Partial<Record<ValueKey, number>>; // 이 길이 각 가치를 얼마나 채워 주는지 0~1
  fitTraits: Partial<BigFive>;
  fitInterests: Partial<Interests>;
  thirdPathReason: string;
  prepCost: number; // 준비 기간 한 달 추가 비용(학원·인강 등, 만원)
  hoursPerWeek: number; // 일을 시작한 뒤 평균 주당 근무시간
  startSkill: FactorKey; // 시작 역량을 정하는 요인
  facts: Fact[];
  npcs: Npc[];
  events: EventCard[];
}

// ---------- 시뮬레이션 결과 ----------

// 갈림길에서 고른 보기의 숫자와 설명 재료
export interface PickInfo {
  base: number; // 기준 비율(이 상황 칸)
  mine: number; // 내가 그 보기를 고를 확률
  byAi: boolean; // 내 확률이 AI 분신 판단에서 왔는지(아니면 규칙 기울기)
  aiFailed: boolean; // AI 판단을 받으려다 실패해서 규칙 기울기로 처리됨
  forced: boolean; // '여기서 다르게 골랐다면'으로 강제한 선택
  stress: number; // 고를 때의 스트레스(고친 선택을 가중치 보정에 쓸 때 필요)
  situation?: string; // 지금 상태 때문에 이쪽으로 민 이유(예: 스트레스가 많이 쌓여 있어서)
  shift?: string; // AI가 쓴, 보통 사람과 비교해 어느 쪽으로 기우는지
  otherGroup?: string; // 통계 대상 집단과 다르거나 확인할 수 없을 때 그 까닭
}

// 한 달에 일어난 일(규칙 엔진 결과)
export interface MonthLog {
  month: number; // 0부터
  event: EventCard | null;
  choiceIndex: number;
  reason: string;
  pick?: PickInfo; // 보기가 둘 이상일 때
  tierLabel?: string;
  delta: Partial<LifeState>;
  state: LifeState;
  status: string; // 그 달의 처지(예: "수험생", "중소기업 2개월차")
  salary: number; // 연봉(만원), 일 안 하면 0
}

export interface Path {
  seed: string;
  months: MonthLog[];
  signature: string[]; // 갈림길 순서(세계선 나무를 만드는 키)
  sigMonths: number[]; // 각 갈림길을 만난 달
  choiceKeys: string[]; // 내 선택이 갈린 모든 갈림길(작은 선택 포함)
  final: LifeState;
  employedAt: number | null; // 처음 일을 시작한 달
  salary: number; // 끝났을 때 연봉
}

// 세계선 나무의 마디
export interface LineNode {
  id: string; // 경로 키(예: "got-job@mid>offer:0")
  key: string; // 이 마디의 갈림길 키
  label: string;
  cause: "luck" | "choice" | "start";
  count: number; // 1,000번 중 이 마디를 지난 횟수
  typicalMonth: number; // 보통 이 갈림길을 만나는 달
  children: LineNode[];
  other: number; // 너무 드물어서 묶은 가지들의 횟수
}

// 세계선(나무의 끝 하나)
export interface Line {
  id: string; // 끝 마디 id
  title: string; // 예: "2년차에 합격해 주민센터로"
  path: string[]; // 지나온 마디 id
  count: number;
  isMain: boolean; // AI가 먼저 간 길(가장 흔한 길)
  repSeed: string; // 이 세계선을 대표하는 회차
  satisfiedShare: number;
  stressedShare: number;
  final: Record<keyof LifeState, { p10: number; p50: number; p90: number }>;
  salary: number; // 끝 연봉 가운데 값
  // 절반 넘는 회차가 다른 진로로 갈아탄 길. 엔진은 갈아탄 뒤의 진로를 살아보지 않으므로 만족 비율을 결과로 쓰지 않는다.
  switched?: boolean;
}

// 갈림길 장면의 "보통은 60% → 나는 73%"
export interface ChoiceOdds {
  base: number; // 기준 비율(%)
  mine: number; // 내 확률(%)
  grade: BaseGrade;
  ref?: string; // 통계·인터뷰 출처(가정값은 안 담음)
  n?: number; // 현직자 인원
  population?: string; // 통계의 대상 집단
  otherGroup?: string; // 대상 집단과 다르거나 확인할 수 없는 까닭(있으면 배지가 '통계(다른 집단 기준)')
  byAi: boolean;
  aiFailed?: boolean;
  forced?: boolean;
  stress?: number; // 고를 때의 스트레스
  situation?: string;
  shift?: string;
}

// 화면에 보여 주는 한 장면(분기 단위 역)
export interface SimEvent {
  worldId: string;
  lineId: string;
  station: number; // 몇 번째 역
  month: number;
  label: string; // 예: "2027년 4월"
  eventId: string;
  title: string;
  kind: EventCard["kind"];
  narration: string;
  choice: string;
  choiceIndex: number;
  reason: string;
  odds?: ChoiceOdds;
  tierLabel?: string;
  delta: Partial<LifeState>;
  state: LifeState;
  status: string;
  eventStatus?: string; // 사건이 일어난 달의 처지(status는 장면 칸 끝의 처지)
  salary: number;
  evidence?: StatEvidence;
  freq: number; // 1,000번 중 이 사건이 일어난 횟수
  routine: boolean;
  branch?: "luck" | "choice";
  minor: string[]; // 같은 역의 작은 일들
  reactions?: { name: string; role: string; line: string }[]; // 등장인물이 따로 말한 한마디(문장뿐, NPC_AGENTS=0이면 없음)
}

export interface FactorNote {
  key: FactorKey;
  label: string; // 예: "코딩 실력"
  mult: number; // 확률 배수
  why: string; // 예: "프로그래머스 Lv2 수준, 프로젝트 2개"
}

export interface WorldStats {
  runs: number;
  events: Record<string, { count: number; typicalMonth: number }>;
  final: Record<keyof LifeState, { p10: number; p50: number; p90: number }>;
  medianState: LifeState;
  satisfiedShare: number;
  stressedShare: number;
  gate: { label: string; share: number; typicalMonth: number | null } | null; // 합격·취업
  salary: { p10: number; p50: number; p90: number };
  factors: FactorNote[];
}

export interface Lever {
  kind: "input" | "choice";
  title: string; // 예: "정보처리기사를 따면"
  metric: string; // 예: "3년 안에 취업"
  before: string;
  after: string;
  gain: number; // 정렬용(좋아지는 정도)
}

export interface Multiverse {
  worldId: string;
  months: number;
  startYm: string; // 시작 연월 "2026-11"
  stats: WorldStats;
  tree: LineNode;
  lines: Line[];
  live?: boolean; // 실시간 판단 30개의 삶(store.getLiveResults). 1,000번 결과와 따로 저장하고 계정에 안 올린다
}

export interface Selection {
  worldIds: string[];
  months: number;
  startYm: string; // 시뮬레이션을 시작하는 연월(다음 달), 예: "2026-11"
  mode?: "basic" | "live"; // 기본 모드(1,000번) | 실시간 판단 모드(30번). 없으면 기본
}

export interface ChatMessage {
  role: "user" | "self";
  text: string;
  memory?: string;
}

export interface Report {
  stamp?: string; // 만들 때의 프로필·시뮬레이션. 지금 값과 다르면 화면에 다시 만들기 버튼
  worlds: {
    worldId: string;
    fit: number;
    good: string;
    hard: string;
  }[];
  woop: {
    wish: string;
    outcome: string;
    obstacle: string;
    plan: string;
  };
  todos: string[];
  example?: { when: string; where: string; what: string }; // 이번 주 할 일 예시 1개
  woopForks?: WoopFork[]; // 장애물의 근거: 자주 나온 큰 갈림길(엔진 값)
}

export interface WoopFork {
  worldId: string;
  worldName: string;
  label: string;
  share: number; // 그 진로의 삶 중 이 갈림길을 만난 비율(%)
}

// 프리미엄 리포트: 막히는 세계선(엔진 값)과 그때 할 일(AI 문장)
export interface PremiumItem {
  worldId: string;
  lineId: string;
  line: string;
  share: number; // 살아본 횟수 중 몇 %(2026-11-03 전에 저장한 것은 100번 중 몇 번 = 같은 값)
  satisfied: number; // 만족하며 끝난 비율(%)
  steps: string[];
}

export type Tone = "push" | "change" | "safe";

export interface Correction {
  at: string;
  source: "sim" | "checkin";
  eventId: string; // 같은 사건을 다시 고치면 덮어쓴다(체크인은 "checkin:날짜")
  title: string;
  from: Tone | null; // 엔진이 고른 쪽(체크인은 null)
  to: Tone; // 내가 고른 쪽
  stress?: number; // 고칠 때 본 장면의 스트레스(체크인·예전 기록은 없음)
  tones?: Tone[]; // 그 갈림길 보기들의 tone(체크인·예전 기록은 없음)
}

// 한 달 체크인: 채점용 상황 질문을 다시 묻는다(본인 일치율 = 사람이 자기 답을 얼마나 되풀이하는지, 분신 점수의 기준선)
export interface Checkin {
  at: string;
  picks: Record<string, number>;
  real: Tone | "none"; // 지난 한 달 실제로 어떻게 했는지
  demo: boolean; // 한 달을 안 기다리고 시연용으로 한 것
  mini?: Record<string, number>; // 성격 20문항(Mini-IPIP)을 다시 답했으면 그 답(선택)
}

// 서비스 전체에서 쓰는 데이터 모양. 여기만 보면 어떤 데이터가 오가는지 알 수 있다.

// ---------- 나(프로필) ----------

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
  // 어떤 검사를 했는지(정확도 표시용)
  depth: { bfiItems: number; behaviorItems: number; interestItems: number; resume: boolean; github: boolean; spec: boolean; life: boolean };
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
}

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
  chance?: number; // 관문(합격·취업): 조건이 되면 이 확률로 굴린다(한 달 기준, calendar가 있으면 그 달 한 번)
  factors?: FactorKey[]; // 관문 확률에 곱하는 개인 요인
  warmup?: number; // 준비를 시작하고 이 개월 수가 지나야 확률이 온전히 적용됨(그 전엔 비례해서 낮음)
  hires?: boolean; // 이 사건으로 일을 시작함
  tiers?: { id: string; group: string; label: string; salary: number; weight: number }[]; // 합격한 곳의 규모별 연봉(만원)과 비율, group은 세계선 나무에서 묶는 단위
  onlyTier?: string[]; // 이 규모의 회사에 다닐 때만(예: 구조조정은 작은 회사)
  tags?: HateTag[]; // 이 사건이 '싫은 것'에 해당하면 만족도가 더 깎임
  text: string; // 목업 모드에서 쓰는 기본 서술
  choices: Choice[];
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

// 한 달에 일어난 일(규칙 엔진 결과)
export interface MonthLog {
  month: number; // 0부터
  event: EventCard | null;
  choiceIndex: number;
  reason: string;
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
  count: number; // 100번 중 이 마디를 지난 횟수
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
  tierLabel?: string;
  delta: Partial<LifeState>;
  state: LifeState;
  status: string;
  salary: number;
  evidence?: StatEvidence;
  freq: number; // 100번 중 이 사건이 일어난 횟수
  routine: boolean;
  branch?: "luck" | "choice";
  minor: string[]; // 같은 역의 작은 일들
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
}

export interface Selection {
  worldIds: string[];
  months: number;
  startYm: string; // 시뮬레이션을 시작하는 연월(다음 달), 예: "2026-11"
}

export interface ChatMessage {
  role: "user" | "self";
  text: string;
  memory?: string;
}

export interface Report {
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
}

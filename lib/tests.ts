// 검사 문항 모음
// 1) IPIP Big-Five Factor Markers 50문항(Goldberg, 1992; ipip.ori.org, 공개 문항). 한국어는 우리가 옮겼다(공식 번역본 아님).
// 2) 직업 흥미 간이 검사 24문항: 홀랜드 RIASEC 6유형을 우리가 직접 쓴 문항으로 잰다(표준화 검사 아님).
//    인터뷰의 표준 깊이(lib/assessment.ts)에서 묻는다. 커리어넷 흥미검사는 중·고등학생용이라 쓰지 않는다.
// 3) 상황 질문 18개: 실제로 어떻게 행동하는지(끈기·위험 감수·스트레스 대처·도움 요청)를 본다.
//    s1~s6은 늘 학습용(성향 점수에 씀). s7~s18 중 6개는 사람마다 시드로 골라 채점용(holdout)으로 떼어 둔다.
//    채점용 답은 성향 점수에 넣지 않고, 나중에 분신이 같은 문항에서 뭘 고를지 맞히는지 재는 데 쓴다(docs/검사-설계-근거.md '닮은 정도 측정').
import { seededRandom } from "./engine";
import type { Behavior, BigFive, Interests } from "./types";

export interface ScaleItem {
  id: string;
  text: string;
  key: string; // 어느 점수에 더하는지
  reverse?: boolean;
}

const B = (id: number, key: keyof BigFive, text: string, reverse = false): ScaleItem => ({ id: `b${id}`, key, text, reverse });

export const IPIP50: ScaleItem[] = [
  B(1, "E", "모임에서 분위기를 띄우는 편이다"),
  B(2, "A", "다른 사람에게 별로 관심이 없다", true),
  B(3, "C", "늘 미리 준비해 둔다"),
  B(4, "N", "쉽게 스트레스를 받는다"),
  B(5, "O", "어휘력이 풍부한 편이다"),
  B(6, "E", "말을 많이 하지 않는다", true),
  B(7, "A", "사람들에게 관심이 많다"),
  B(8, "C", "물건을 여기저기 늘어놓는다", true),
  B(9, "N", "대체로 마음이 편안하다", true),
  B(10, "O", "추상적인 개념을 이해하기 어렵다", true),
  B(11, "E", "사람들 사이에 있으면 편하다"),
  B(12, "A", "남에게 상처 주는 말을 하곤 한다", true),
  B(13, "C", "세세한 부분까지 신경 쓴다"),
  B(14, "N", "이런저런 걱정을 많이 한다"),
  B(15, "O", "상상력이 풍부하다"),
  B(16, "E", "앞에 나서기보다 뒤에 있는 편이다", true),
  B(17, "A", "다른 사람의 감정에 공감한다"),
  B(18, "C", "일을 엉망으로 만들 때가 있다", true),
  B(19, "N", "우울한 기분이 잘 들지 않는다", true),
  B(20, "O", "추상적인 생각에는 관심이 없다", true),
  B(21, "E", "먼저 말을 거는 편이다"),
  B(22, "A", "남의 문제에는 관심이 없다", true),
  B(23, "C", "해야 할 일을 바로 끝낸다"),
  B(24, "N", "쉽게 마음이 흔들린다"),
  B(25, "O", "좋은 아이디어를 잘 떠올린다"),
  B(26, "E", "할 말이 별로 없는 편이다", true),
  B(27, "A", "마음이 여린 편이다"),
  B(28, "C", "쓴 물건을 제자리에 두는 걸 자주 잊는다", true),
  B(29, "N", "쉽게 속상해한다"),
  B(30, "O", "상상력이 별로 없다", true),
  B(31, "E", "모임에서 여러 사람과 이야기한다"),
  B(32, "A", "다른 사람에게 그다지 관심이 없다", true),
  B(33, "C", "정리된 상태를 좋아한다"),
  B(34, "N", "기분이 자주 바뀐다"),
  B(35, "O", "이해가 빠른 편이다"),
  B(36, "E", "주목받는 걸 좋아하지 않는다", true),
  B(37, "A", "다른 사람을 위해 시간을 낸다"),
  B(38, "C", "해야 할 일을 슬쩍 미룬다", true),
  B(39, "N", "기분 변화가 심하다"),
  B(40, "O", "어려운 단어를 쓰는 편이다"),
  B(41, "E", "주목받아도 개의치 않는다"),
  B(42, "A", "다른 사람의 감정을 잘 느낀다"),
  B(43, "C", "계획표대로 움직인다"),
  B(44, "N", "쉽게 짜증이 난다"),
  B(45, "O", "이것저것 곰곰이 생각하는 시간이 많다"),
  B(46, "E", "낯선 사람 앞에서는 조용하다", true),
  B(47, "A", "사람들을 편하게 해 준다"),
  B(48, "C", "일을 꼼꼼하게 처리한다"),
  B(49, "N", "자주 우울해진다"),
  B(50, "O", "아이디어가 넘친다"),
];

const R = (id: number, key: keyof Interests, text: string): ScaleItem => ({ id: `r${id}`, key, text });
export const RIASEC24: ScaleItem[] = [
  R(1, "R", "고장 난 물건을 직접 고쳐 보는 게 재밌다"),
  R(2, "I", "왜 그런지 원리를 파고드는 걸 좋아한다"),
  R(3, "A", "글, 그림, 영상으로 표현하는 걸 좋아한다"),
  R(4, "S", "다른 사람의 고민을 잘 들어 주는 편이다"),
  R(5, "E", "사람들을 설득하는 게 자신 있다"),
  R(6, "C", "자료를 정리하고 분류하는 게 편하다"),
  R(7, "R", "손으로 조립하거나 만드는 걸 좋아한다"),
  R(8, "I", "데이터를 보고 패턴을 찾는 게 재밌다"),
  R(9, "A", "정해진 방식보다 나만의 방식으로 하고 싶다"),
  R(10, "S", "누군가를 가르치거나 도울 때 보람을 느낀다"),
  R(11, "E", "모임이나 팀을 이끄는 역할을 자주 맡는다"),
  R(12, "C", "정해진 규칙과 절차대로 일하는 게 좋다"),
  R(13, "R", "기계나 장비를 다루는 일에 끌린다"),
  R(14, "I", "어려운 문제를 오래 붙잡고 푸는 편이다"),
  R(15, "A", "디자인이나 분위기에 민감하다"),
  R(16, "S", "사람들과 함께 일하는 게 좋다"),
  R(17, "E", "목표를 세우고 경쟁하는 게 즐겁다"),
  R(18, "C", "숫자나 서류를 꼼꼼히 확인하는 편이다"),
  R(19, "R", "몸을 움직이며 하는 일이 좋다"),
  R(20, "I", "과학·기술 기사를 찾아 읽는다"),
  R(21, "A", "새로운 아이디어를 떠올리는 게 즐겁다"),
  R(22, "S", "사회에 도움이 되는 일을 하고 싶다"),
  R(23, "E", "사업이나 장사에 관심이 있다"),
  R(24, "C", "계획을 세우고 그대로 지키는 게 좋다"),
];

export const RIASEC_LABEL: Record<keyof Interests, string> = { R: "현실형", I: "탐구형", A: "예술형", S: "사회형", E: "진취형", C: "관습형" };

// 5점 척도 평균(역문항은 6 - 응답)
export function scoreScale<T extends string>(items: ScaleItem[], answers: Record<string, number>, keys: T[]): Record<T, number> {
  const sums = Object.fromEntries(keys.map((k) => [k, [] as number[]])) as Record<T, number[]>;
  for (const it of items) {
    const v = answers[it.id];
    if (v === undefined) continue;
    sums[it.key as T]?.push(it.reverse ? 6 - v : v);
  }
  return Object.fromEntries(keys.map((k) => [k, sums[k].length ? Math.round((sums[k].reduce((a, b) => a + b, 0) / sums[k].length) * 10) / 10 : 3])) as Record<T, number>;
}

// ---------- 상황 질문 ----------

// tone: 엔진 갈림길 선택(lib/engine.ts decide)과 같은 뜻. push 더 밀어붙임 / change 바꿈 / safe 신중함
export type Tone = "push" | "change" | "safe";

export interface SjtItem {
  id: string;
  // train: 늘 학습용. pool: 사람마다 시드로 학습용 또는 채점용(holdout)이 된다(sjtHoldout).
  role: "train" | "pool";
  text: string;
  options: { text: string; score: Partial<Behavior>; tone: Tone }[];
}

export const SJT: SjtItem[] = [
  {
    id: "s1",
    role: "train",
    text: "석 달 준비한 시험에 떨어졌다. 다음 날 나는?",
    options: [
      { text: "바로 오답을 정리하고 다음 시험을 접수한다", score: { persistence: 5, coping: 4 }, tone: "push" },
      { text: "일주일쯤 쉬고 다시 시작한다", score: { persistence: 3.5, coping: 4 }, tone: "safe" },
      { text: "이 길이 맞는지부터 다시 생각한다", score: { persistence: 2, risk: 3.5 }, tone: "change" },
      { text: "한동안 아무것도 손에 안 잡힌다", score: { persistence: 1.5, coping: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s2",
    role: "train",
    text: "연봉은 20% 높은데 처음 들어 보는 스타트업에서 오라고 한다.",
    options: [
      { text: "바로 옮긴다", score: { risk: 5 }, tone: "change" },
      { text: "회사를 알아보고 괜찮으면 옮긴다", score: { risk: 3.5 }, tone: "change" },
      { text: "지금 있는 곳이 낫다", score: { risk: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s3",
    role: "train",
    text: "팀 과제를 하다 막혔다.",
    options: [
      { text: "아는 사람에게 바로 물어본다", score: { social: 5 }, tone: "push" },
      { text: "검색해서 혼자 끝까지 해결한다", score: { social: 2, persistence: 4 }, tone: "push" },
      { text: "일단 미뤄 두고 마감 직전에 한다", score: { social: 2, persistence: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s4",
    role: "train",
    text: "일이 몰려 일주일째 잠을 제대로 못 잤다.",
    options: [
      { text: "운동이나 취미로 푼다", score: { coping: 5 }, tone: "safe" },
      { text: "친구에게 털어놓는다", score: { coping: 4, social: 4.5 }, tone: "safe" },
      { text: "그냥 꾹 참고 버틴다", score: { coping: 2.5, persistence: 4 }, tone: "push" },
      { text: "다 놓아 버리고 싶어진다", score: { coping: 1.5 }, tone: "change" },
    ],
  },
  {
    id: "s5",
    role: "train",
    text: "새해에 세운 공부 계획, 3월쯤의 나는?",
    options: [
      { text: "계획대로 하고 있다", score: { persistence: 5 }, tone: "push" },
      { text: "반쯤은 하고 있다", score: { persistence: 3 }, tone: "safe" },
      { text: "이미 잊었다", score: { persistence: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s6",
    role: "train",
    text: "아무도 안 해 본 방식으로 과제를 해 볼 기회가 생겼다.",
    options: [
      { text: "재밌겠다, 해 본다", score: { risk: 4.5 }, tone: "change" },
      { text: "반만 새롭게 해 본다", score: { risk: 3 }, tone: "safe" },
      { text: "검증된 방식대로 한다", score: { risk: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s7",
    role: "pool",
    text: "첫 직장(알바) 석 달째, 생각했던 일과 많이 다르다.",
    options: [
      { text: "1년은 채워 보고 판단한다", score: { persistence: 4.5, risk: 2 }, tone: "push" },
      { text: "다니면서 다른 곳을 알아본다", score: { risk: 3.5, persistence: 3 }, tone: "change" },
      { text: "바로 그만두고 다시 찾는다", score: { risk: 5, persistence: 1.5 }, tone: "change" },
      { text: "선배나 상사에게 고민을 털어놓는다", score: { social: 5 }, tone: "safe" },
    ],
  },
  {
    id: "s8",
    role: "pool",
    text: "자격증 실기 시험에 두 번 떨어졌다.",
    options: [
      { text: "바로 세 번째 시험을 접수한다", score: { persistence: 5 }, tone: "push" },
      { text: "학원이나 스터디를 찾아 방법을 바꾼다", score: { persistence: 4, social: 4 }, tone: "push" },
      { text: "다른 자격증으로 방향을 바꾼다", score: { risk: 3.5, persistence: 2 }, tone: "change" },
      { text: "당분간 시험은 쉰다", score: { persistence: 1.5, coping: 3 }, tone: "safe" },
    ],
  },
  {
    id: "s9",
    role: "pool",
    text: "같이 준비하던 친구가 먼저 붙었다(취업했다).",
    options: [
      { text: "축하하고 내 계획대로 계속한다", score: { coping: 4.5, persistence: 4 }, tone: "push" },
      { text: "친구에게 어떻게 준비했는지 물어본다", score: { social: 5 }, tone: "push" },
      { text: "며칠은 아무것도 하기 싫다", score: { coping: 1.5 }, tone: "safe" },
      { text: "나도 빨리 아무 데나 들어가야겠다고 생각한다", score: { risk: 4, coping: 2 }, tone: "change" },
    ],
  },
  {
    id: "s10",
    role: "pool",
    text: "졸업이 다가오는데 원하던 곳에서 연락이 없다.",
    options: [
      { text: "원하던 쪽을 1년 더 준비한다", score: { persistence: 4.5, risk: 3.5 }, tone: "push" },
      { text: "지원 범위를 넓혀 일단 취업한다", score: { risk: 2 }, tone: "safe" },
      { text: "아예 다른 분야를 알아본다", score: { risk: 4.5 }, tone: "change" },
      { text: "학교 취업센터나 교수님께 상담을 받는다", score: { social: 5 }, tone: "safe" },
    ],
  },
  {
    id: "s11",
    role: "pool",
    text: "과제(프로젝트) 마감 일주일 전, 중요한 부분이 크게 잘못된 걸 알았다.",
    options: [
      { text: "밤을 새서라도 다시 고친다", score: { persistence: 5, coping: 2.5 }, tone: "push" },
      { text: "팀이나 교수님께 바로 알리고 마감 조정을 부탁한다", score: { social: 5, coping: 4 }, tone: "safe" },
      { text: "고칠 수 있는 만큼만 고치고 낸다", score: { persistence: 2.5, coping: 4 }, tone: "safe" },
      { text: "이참에 방식을 통째로 바꿔 본다", score: { risk: 4.5 }, tone: "change" },
    ],
  },
  {
    id: "s12",
    role: "pool",
    text: "모아 둔 돈이 두 달 치밖에 안 남았다.",
    options: [
      { text: "알바를 늘리고 준비는 계속한다", score: { persistence: 4.5 }, tone: "push" },
      { text: "가족에게 도움을 요청한다", score: { social: 4.5 }, tone: "safe" },
      { text: "준비를 멈추고 일단 바로 취업한다", score: { risk: 2 }, tone: "change" },
      { text: "생활비를 줄이며 버틴다", score: { coping: 3.5, persistence: 3.5 }, tone: "safe" },
    ],
  },
  {
    id: "s13",
    role: "pool",
    text: "팀 과제에서 한 사람이 계속 일을 안 한다.",
    options: [
      { text: "직접 이야기해서 역할을 다시 나눈다", score: { social: 4.5, coping: 4 }, tone: "push" },
      { text: "그 몫까지 내가 해 버린다", score: { persistence: 4.5, social: 1.5 }, tone: "push" },
      { text: "교수님(팀장)께 알린다", score: { social: 4 }, tone: "safe" },
      { text: "신경 쓰지 않고 내 몫만 한다", score: { coping: 3.5, social: 2 }, tone: "safe" },
    ],
  },
  {
    id: "s14",
    role: "pool",
    text: "하고 싶은 일은 연봉이 낮고, 연봉이 높은 일은 흥미가 없다.",
    options: [
      { text: "하고 싶은 일을 고른다", score: { risk: 4 }, tone: "push" },
      { text: "연봉이 높은 일을 고른다", score: { risk: 1.5 }, tone: "safe" },
      { text: "연봉 높은 일을 하면서 하고 싶은 일을 준비한다", score: { persistence: 4, risk: 2.5 }, tone: "safe" },
      { text: "둘 다 아닌 다른 길을 찾아본다", score: { risk: 4 }, tone: "change" },
    ],
  },
  {
    id: "s15",
    role: "pool",
    text: "면접에서 예상 못 한 질문에 말이 막혔다. 끝나고 나서 나는?",
    options: [
      { text: "그 질문의 답을 정리해 다음 면접에 대비한다", score: { persistence: 4.5, coping: 4.5 }, tone: "push" },
      { text: "친구에게 이야기하며 털어 낸다", score: { social: 4.5, coping: 4 }, tone: "safe" },
      { text: "하루 종일 그 장면이 떠오른다", score: { coping: 1.5 }, tone: "safe" },
      { text: "이 분야가 나랑 안 맞나 싶다", score: { coping: 2, persistence: 2 }, tone: "change" },
    ],
  },
  {
    id: "s16",
    role: "pool",
    text: "지방(해외) 근무 기회가 생겼다. 경력엔 좋지만 아는 사람이 없다.",
    options: [
      { text: "바로 간다", score: { risk: 5 }, tone: "change" },
      { text: "먼저 다녀온 사람을 찾아 물어본다", score: { social: 4.5, risk: 3 }, tone: "change" },
      { text: "조건을 더 알아보고 정한다", score: { risk: 3 }, tone: "safe" },
      { text: "지금 자리에 남는다", score: { risk: 1.5 }, tone: "safe" },
    ],
  },
  {
    id: "s17",
    role: "pool",
    text: "300만 원짜리 6개월 교육 과정이 취업에 도움이 된다고 한다. 모은 돈이 딱 그만큼이다.",
    options: [
      { text: "바로 등록한다", score: { risk: 4.5 }, tone: "push" },
      { text: "수료생 후기를 찾아보고 정한다", score: { risk: 3, social: 3.5 }, tone: "safe" },
      { text: "지금 하던 준비를 계속하고 돈은 아껴 둔다", score: { risk: 1.5, persistence: 4 }, tone: "safe" },
      { text: "국비 지원 과정을 찾아본다", score: { risk: 2, social: 3.5 }, tone: "change" },
    ],
  },
  {
    id: "s18",
    role: "pool",
    text: "1년 넘게 준비했는데 계속 안 된다. 주변에서 다른 길을 권한다.",
    options: [
      { text: "1년만 더 해 본다", score: { persistence: 5, risk: 3 }, tone: "push" },
      { text: "준비하면서 다른 길도 같이 알아본다", score: { persistence: 3, risk: 3 }, tone: "safe" },
      { text: "다른 길로 바꾼다", score: { risk: 4, persistence: 1.5 }, tone: "change" },
      { text: "잠시 쉬면서 생각을 정리한다", score: { coping: 4 }, tone: "safe" },
    ],
  },
];

export const HOLDOUT_SIZE = 6;
export const QUICK_HOLDOUT = 3; // 빠르게 모드에서 묻는 채점용 문항 수

// 채점용 문항 고르기. seed는 처음 정할 때 프로필에 저장해서 다시 바뀌지 않게 한다.
export function pickHoldout(seed: string): string[] {
  const rand = seededRandom(`holdout:${seed}`);
  const pool = SJT.filter((q) => q.role === "pool").map((q) => q.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, HOLDOUT_SIZE);
}

// 채점용 답은 성향 점수에 넣지 않는다(holdout을 넘기면 빼고 센다).
export function scoreSjt(picks: Record<string, number>, holdout: string[] = []): Behavior {
  const acc: Record<keyof Behavior, number[]> = { persistence: [], risk: [], coping: [], social: [] };
  for (const item of SJT) {
    if (holdout.includes(item.id)) continue;
    const i = picks[item.id];
    if (i === undefined) continue;
    const sc = item.options[i].score;
    (Object.keys(sc) as (keyof Behavior)[]).forEach((k) => acc[k].push(sc[k]!));
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 3);
  return { persistence: avg(acc.persistence), risk: avg(acc.risk), coping: avg(acc.coping), social: avg(acc.social) };
}

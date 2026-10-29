// 검사 문항 모음
// 1) IPIP Big-Five Factor Markers 50문항(Goldberg, 1992; ipip.ori.org, 공개 문항). 한국어는 우리가 옮겼다(공식 번역본 아님).
// 2) 직업 흥미 간이 검사 24문항: 홀랜드 RIASEC 6유형을 우리가 직접 쓴 문항으로 잰다(표준화 검사 아님).
//    커리어넷 키가 있으면 /deepen에서 커리어넷 직업흥미검사로 바꿔 쓰고, 이 24문항은 폴백으로 남긴다(lib/careernet.ts).
// 3) 상황 질문 6개: 실제로 어떻게 행동하는지(끈기·위험 감수·스트레스 대처·도움 요청)를 본다.
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

export interface SjtItem {
  id: string;
  text: string;
  options: { text: string; score: Partial<Behavior> }[];
}

export const SJT: SjtItem[] = [
  {
    id: "s1",
    text: "석 달 준비한 시험에 떨어졌다. 다음 날 나는?",
    options: [
      { text: "바로 오답을 정리하고 다음 시험을 접수한다", score: { persistence: 5, coping: 4 } },
      { text: "일주일쯤 쉬고 다시 시작한다", score: { persistence: 3.5, coping: 4 } },
      { text: "이 길이 맞는지부터 다시 생각한다", score: { persistence: 2, risk: 3.5 } },
      { text: "한동안 아무것도 손에 안 잡힌다", score: { persistence: 1.5, coping: 1.5 } },
    ],
  },
  {
    id: "s2",
    text: "연봉은 20% 높은데 처음 들어 보는 스타트업에서 오라고 한다.",
    options: [
      { text: "바로 옮긴다", score: { risk: 5 } },
      { text: "회사를 알아보고 괜찮으면 옮긴다", score: { risk: 3.5 } },
      { text: "지금 있는 곳이 낫다", score: { risk: 1.5 } },
    ],
  },
  {
    id: "s3",
    text: "팀 과제를 하다 막혔다.",
    options: [
      { text: "아는 사람에게 바로 물어본다", score: { social: 5 } },
      { text: "검색해서 혼자 끝까지 해결한다", score: { social: 2, persistence: 4 } },
      { text: "일단 미뤄 두고 마감 직전에 한다", score: { social: 2, persistence: 1.5 } },
    ],
  },
  {
    id: "s4",
    text: "일이 몰려 일주일째 잠을 제대로 못 잤다.",
    options: [
      { text: "운동이나 취미로 푼다", score: { coping: 5 } },
      { text: "친구에게 털어놓는다", score: { coping: 4, social: 4.5 } },
      { text: "그냥 꾹 참고 버틴다", score: { coping: 2.5, persistence: 4 } },
      { text: "다 놓아 버리고 싶어진다", score: { coping: 1.5 } },
    ],
  },
  {
    id: "s5",
    text: "새해에 세운 공부 계획, 3월쯤의 나는?",
    options: [
      { text: "계획대로 하고 있다", score: { persistence: 5 } },
      { text: "반쯤은 하고 있다", score: { persistence: 3 } },
      { text: "이미 잊었다", score: { persistence: 1.5 } },
    ],
  },
  {
    id: "s6",
    text: "아무도 안 해 본 방식으로 과제를 해 볼 기회가 생겼다.",
    options: [
      { text: "재밌겠다, 해 본다", score: { risk: 4.5 } },
      { text: "반만 새롭게 해 본다", score: { risk: 3 } },
      { text: "검증된 방식대로 한다", score: { risk: 1.5 } },
    ],
  },
];

export function scoreSjt(picks: Record<string, number>): Behavior {
  const acc: Record<keyof Behavior, number[]> = { persistence: [], risk: [], coping: [], social: [] };
  for (const item of SJT) {
    const i = picks[item.id];
    if (i === undefined) continue;
    const sc = item.options[i].score;
    (Object.keys(sc) as (keyof Behavior)[]).forEach((k) => acc[k].push(sc[k]!));
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 3);
  return { persistence: avg(acc.persistence), risk: avg(acc.risk), coping: avg(acc.coping), social: avg(acc.social) };
}

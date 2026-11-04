// 파일럿(가중치 보정용 데이터 모으기). /interview?pilot=1로 들어온 사람에게만 /pilot을 보여 준다.
// 앱 동의서(lib/consent.ts)와 따로 파일럿 동의를 받는다. 답은 holdoutPicks에 "p1"~"p20"으로 넣고 성향 점수에는 안 쓴다.
// 모은 답은 scripts/fit-weights.ts가 쓴다(파일럿 동의가 있고 빠지기를 안 한 사람만).
import type { Tone } from "./tests";
import type { Profile } from "./types";

// 파일럿 동의 문구의 판. 문구나 쓰는 곳이 바뀌면 올리고 다시 동의를 받는다.
export const PILOT_VERSION = "2026-11-04-pilot-draft";

export const PILOT_CONSENT: { title: string; body: string }[] = [
  { title: "답을 가중치 보정과 분신 비교에 써요", body: "이 상황 질문 답과 검사에서 입력한 성향·가치관·확인한 이야기 값으로, 시뮬레이션이 선택을 정하는 무게를 다시 재요. 같은 값을 AI에 보내 분신이 내 답을 얼마나 맞히는지도 비교해요. 이야기 원문은 쓰지 않아요." },
  { title: "개인을 알아볼 수 없게 묶어서만 분석해요", body: "여러 사람의 답을 합쳐 무게 하나를 추정할 뿐, 한 사람의 답을 따로 보거나 공개하지 않아요. 결과에는 인원 수와 구간만 남아요." },
  { title: "언제든 빼 달라고 할 수 있어요", body: "이 화면의 '파일럿에서 빠지기'를 누르면 답이 지워지고 다음 분석부터 빠져요. 이미 끝난 분석은 다음에 다시 돌릴 때 빠져요." },
];

// 채점 전용 상황 질문. stress: 앞선 상황이 지친 상태를 전제하면 그 정도(0~100, 50 = 평소). 없으면 평소.
export interface PilotItem {
  id: string;
  text: string;
  options: { text: string; tone: Tone }[];
  stress?: number;
}

// 20개(2026-11-03 팀장 확인, 설명: docs/파일럿-상황질문.md). 기존 s1~s18과 상황이 겹치지 않게, 앞선 상황이 들어간 문항 11개(stress가 붙은 문항).
// 한 번 모으기 시작하면 문항·보기 순서를 바꾸지 않는다(답은 보기 번호로 저장된다). 바꾸려면 새 id(p21~)로 넣는다.
export const PILOT_SJT: PilotItem[] = [
  {
    id: "p1",
    text: "인턴 6개월째인데 정규직 전환 얘기가 없다. 그사이 다른 회사 신입 공고가 떴다.",
    stress: 60,
    options: [
      { text: "인턴에서 성과를 더 내서 전환을 노린다", tone: "push" },
      { text: "공고에 지원한다", tone: "change" },
      { text: "담당자에게 전환 가능성부터 물어본다", tone: "safe" },
    ],
  },
  {
    id: "p2",
    text: "교수님이 학부 연구실에서 일해 보라고 했다. 하던 알바를 줄여야 한다.",
    options: [
      { text: "바로 들어가서 해 본다", tone: "push" },
      { text: "연구실 대신 현장 일 경험을 찾아본다", tone: "change" },
      { text: "알바를 유지하고 학기가 끝나면 다시 생각한다", tone: "safe" },
    ],
  },
  {
    id: "p3",
    text: "한 달 동안 매일 지원서를 냈는데 서류에서 다 떨어졌다. 오늘도 불합격 메일이 왔다.",
    stress: 70,
    options: [
      { text: "자소서를 고쳐서 오늘도 낸다", tone: "push" },
      { text: "지원하는 직무를 바꿔 본다", tone: "change" },
      { text: "일주일은 지원을 멈추고 쉰다", tone: "safe" },
      { text: "취업 상담을 신청해서 점검부터 받는다", tone: "safe" },
    ],
  },
  {
    id: "p4",
    text: "동아리 회장을 맡아 달라는 부탁을 받았다. 시험 준비 기간과 겹친다.",
    options: [
      { text: "맡아서 둘 다 해 본다", tone: "push" },
      { text: "회장 대신 작은 역할만 맡는다", tone: "safe" },
      { text: "거절하고 시험에 집중한다", tone: "safe" },
    ],
  },
  {
    id: "p5",
    text: "두 달째 다니는 학원 수업이 나와 안 맞는 것 같다. 환불 기한이 이번 주까지다.",
    stress: 55,
    options: [
      { text: "끝까지 다녀 본다", tone: "push" },
      { text: "환불받고 다른 방법으로 바꾼다", tone: "change" },
      { text: "강사와 상담해 보고 정한다", tone: "safe" },
    ],
  },
  {
    id: "p6",
    text: "가고 싶던 회사의 최종 면접 날이 이미 붙은 회사의 첫 출근 날과 같다.",
    options: [
      { text: "최종 면접에 간다", tone: "push" },
      { text: "붙은 회사에 출근한다", tone: "safe" },
      { text: "붙은 회사에 출근을 미뤄 달라고 부탁해 본다", tone: "safe" },
    ],
  },
  {
    id: "p7",
    text: "공모전 1차에 붙었는데, 같이 하던 팀원 둘이 바빠서 빠지겠다고 한다.",
    stress: 60,
    options: [
      { text: "혼자라도 끝까지 낸다", tone: "push" },
      { text: "새 팀원을 구하고 방향을 바꾼다", tone: "change" },
      { text: "이번엔 접고 다음 공모전을 노린다", tone: "safe" },
    ],
  },
  {
    id: "p8",
    text: "부모님이 아는 분 회사에 자리가 있다며 가 보라고 하신다. 내가 생각한 일과는 조금 다르다.",
    options: [
      { text: "원래 준비하던 쪽을 계속한다", tone: "push" },
      { text: "일단 가서 해 본다", tone: "change" },
      { text: "조건을 더 알아본 뒤 정한다", tone: "safe" },
    ],
  },
  {
    id: "p9",
    text: "반년 넘게 주말에도 일했고 요즘은 아침에 일어나기가 힘들다. 그런데 회사가 큰 프로젝트를 맡아 보라고 한다.",
    stress: 80,
    options: [
      { text: "맡는다", tone: "push" },
      { text: "지금은 어렵다고 말하고 휴가를 쓴다", tone: "safe" },
      { text: "다른 회사나 다른 길을 알아보기 시작한다", tone: "change" },
    ],
  },
  {
    id: "p10",
    text: "해외 단기 연수(3개월)에 뽑혔다. 다녀오면 졸업이 한 학기 늦어진다.",
    options: [
      { text: "다녀온다", tone: "change" },
      { text: "다음 기회로 미루고 지금 준비에 집중한다", tone: "push" },
      { text: "포기하고 제때 졸업한다", tone: "safe" },
    ],
  },
  {
    id: "p11",
    text: "자격증 필기는 붙었고 실기가 한 달 남았다. 그런데 알바 시간이 갑자기 두 배로 늘었다.",
    stress: 65,
    options: [
      { text: "잠을 줄여서라도 실기를 준비한다", tone: "push" },
      { text: "실기를 다음 회차로 미룬다", tone: "safe" },
      { text: "알바를 그만두고 시간이 맞는 곳을 구한다", tone: "change" },
    ],
  },
  {
    id: "p12",
    text: "과 선배가 같이 창업하자고 한다. 아이디어는 좋아 보이지만 1년쯤은 수입이 없다.",
    options: [
      { text: "같이 한다", tone: "change" },
      { text: "지금 준비를 마치고 나서 합류를 얘기해 본다", tone: "push" },
      { text: "거절한다", tone: "safe" },
    ],
  },
  {
    id: "p13",
    text: "첫 출근 한 달 만에 실수로 팀 일정을 하루 늦췄다. 상사가 다들 보는 데서 지적했다.",
    stress: 70,
    options: [
      { text: "실수를 정리해서 다시 안 생기게 할 방법을 낸다", tone: "push" },
      { text: "당분간 맡은 일만 조용히 한다", tone: "safe" },
      { text: "이 회사가 맞는지 다른 곳을 알아본다", tone: "change" },
    ],
  },
  {
    id: "p14",
    text: "관심 있던 분야의 무료 강의가 열렸다. 석 달 동안 매주 토요일 4시간이다.",
    options: [
      { text: "신청하고 끝까지 듣는다", tone: "push" },
      { text: "녹화본이 나오면 시간 날 때 본다", tone: "safe" },
      { text: "이 분야로 진로를 바꿀지 알아본다", tone: "change" },
    ],
  },
  {
    id: "p15",
    text: "1년 준비한 시험의 합격선이 크게 올랐다는 발표가 났다. 시험은 넉 달 뒤다.",
    stress: 70,
    options: [
      { text: "공부 시간을 늘린다", tone: "push" },
      { text: "다른 시험이나 취업을 같이 준비한다", tone: "change" },
      { text: "하던 계획대로 한다", tone: "safe" },
    ],
  },
  {
    id: "p16",
    text: "친구가 자기 회사에 추천해 주겠다고 한다. 연봉은 괜찮지만 내 전공과 거리가 멀다.",
    options: [
      { text: "추천받아 지원한다", tone: "change" },
      { text: "전공 쪽 지원을 더 늘린다", tone: "push" },
      { text: "조금 더 생각해 보고 답한다", tone: "safe" },
    ],
  },
  {
    id: "p17",
    text: "석 달 쉬면서 몸은 회복됐다. 모아 둔 돈이 줄어서 이제 뭔가 시작해야 한다.",
    stress: 40,
    options: [
      { text: "원래 하던 준비를 다시 시작한다", tone: "push" },
      { text: "쉬면서 생각한 새 분야를 시작한다", tone: "change" },
      { text: "우선 알바부터 구해 생활을 안정시킨다", tone: "safe" },
    ],
  },
  {
    id: "p18",
    text: "학교에서 복수전공 신청을 받는다. 학점 부담은 크지만 취업 폭이 넓어진다.",
    options: [
      { text: "신청한다", tone: "push" },
      { text: "아예 다른 학과로 옮길지 알아본다", tone: "change" },
      { text: "신청하지 않는다", tone: "safe" },
    ],
  },
  {
    id: "p19",
    text: '6개월 준비한 포트폴리오를 보여 줬더니 현직자가 "방향이 시장과 안 맞는다"고 했다.',
    stress: 60,
    options: [
      { text: "피드백을 반영해 고쳐서 계속한다", tone: "push" },
      { text: "방향을 완전히 바꿔 새로 만든다", tone: "change" },
      { text: "다른 현직자 의견도 더 들어 본다", tone: "safe" },
    ],
  },
  {
    id: "p20",
    text: "계약직으로 1년 일했다. 정규직 전환은 안 된다면서 계약을 1년 더 하자고 한다.",
    stress: 55,
    options: [
      { text: "연장하면서 전환 조건을 다시 요청한다", tone: "push" },
      { text: "다른 회사 정규직을 찾는다", tone: "change" },
      { text: "일단 연장한다", tone: "safe" },
    ],
  },
];

export const isPilotId = (id: string) => /^p\d+$/.test(id);

export const pilotActive = (p: Profile) => !!p.pilot && !p.pilot.withdrawnAt;
export const pilotAnswered = (p: Profile) => PILOT_SJT.filter((q) => p.holdoutPicks[q.id] !== undefined).length;

// 파일럿에서 빠지기: 답을 지우고 빠진 날을 남긴다(다음 내보내기부터 빠짐)
export function withdrawPilot(p: Profile): Profile {
  return {
    ...p,
    holdoutPicks: Object.fromEntries(Object.entries(p.holdoutPicks).filter(([id]) => !isPilotId(id))),
    pilot: p.pilot ? { ...p.pilot, withdrawnAt: new Date().toISOString() } : null,
  };
}

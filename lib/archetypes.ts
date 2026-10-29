// 진로 유형 틀. 직업 목록(data/jobs.ts)의 한 줄을 받아 '진로 세계'(사건 카드, 관문, 등장인물, 근거)를 만든다.
// 사람이 사건을 하나하나 쓴 진로(data/worlds/*.json)만큼 자세하진 않지만, 어떤 전공의 어떤 직업이든 같은 엔진으로 돌릴 수 있다.
// 숫자(확률·연봉)는 공개 통계가 있는 것만 출처와 함께 쓰고, 없는 것은 '가정'이라고 적는다.
import type { Archetype, Choice, EventCard, Fact, LifeState, StatEvidence, ValueKey, WorldTemplate, Interests, BigFive, HateTag } from "./types";

// ---------- 직업 한 줄의 모양 ----------

export interface Job {
  id: string;
  name: string;
  short: string;
  family: string;
  archetype: Archetype;
  majors: string[];
  certs?: string[];
  readiness: string[];
  values?: Partial<Record<ValueKey, number>>;
  interests?: Partial<Interests>;
  traits?: Partial<BigFive>;
  hours?: number;
  place?: string; // 일하는 곳(회사, 병원, 학교, 현장 ...)
  people?: { boss: string; peer: string; other: string; otherRole: string }; // 등장인물
  hazard?: number; // 상시 채용: 한 달에 붙을 기본 확률(가정)
  tiers?: Tier[];
  exam?: { months: number[]; chance: number; warmup: number; label: string; salary: number; salaryNote: string; firstPost: string };
  license?: { month: number; chance: number; name: string };
  facts?: Fact[];
  tags?: HateTag[]; // 이 일에서 자주 생기는 '싫은 것'
  why?: string; // 제3의 길로 제안할 때 이유
}

export interface Tier {
  id: string;
  group: string;
  label: string;
  salary: number;
  weight: number;
}

// ---------- 공통 사실(출처 있음) ----------

const URL_YOUTH = "https://mobile.newsis.com/view/NISX20260723_0003720080";
const URL_KEF = "https://www.inews24.com/view/1803165";
export const F_FIRSTJOB: Fact = { label: "졸업 후 첫 취업까지 평균", value: "11.2개월", source: "통계청 경제활동인구조사 청년층 부가조사", year: "2026년 5월", url: URL_YOUTH };
export const F_TENURE: Fact = { label: "첫 일자리 평균 근속기간", value: "1년 6.8개월", source: "통계청 경제활동인구조사 청년층 부가조사", year: "2026년 5월", url: URL_YOUTH };
export const F_QUIT: Fact = { label: "첫 직장을 그만둔 이유 1위", value: "보수·근로시간 등 근로여건 불만족 44.4%", source: "통계청 경제활동인구조사 청년층 부가조사", year: "2026년 5월", url: URL_YOUTH };
export const F_WAGE: Fact = { label: "대졸 정규직 신입 초임(회사 규모별, 전 업종)", value: "300인 이상 5,001만원 · 30~299인 3,595만원 · 5~29인 3,070만원 · 5인 미만 2,731만원", source: "한국경영자총협회 「대졸 초임 분석」", year: "2023년 기준", url: URL_KEF };
const EV_WAGE: StatEvidence = { label: "신입 초임(전 업종): 300인 이상 5,001만원, 30~299인 3,595만원", source: "한국경영자총협회(2023)", url: URL_KEF };
const EV_FIRSTJOB: StatEvidence = { label: "청년 첫 취업까지 평균 11.2개월", source: "통계청 청년층 부가조사(2026)", url: URL_YOUTH };
const EV_TENURE: StatEvidence = { label: "청년 첫 일자리 평균 근속 1년 6.8개월", source: "통계청 청년층 부가조사(2026)", url: URL_YOUTH };
const EV_QUIT: StatEvidence = { label: "첫 직장 그만둔 이유 1위: 보수·근로시간 불만족 44.4%", source: "통계청 청년층 부가조사(2026)", url: URL_YOUTH };

// 회사 규모별 초임(경총). weight는 그 직업에서 어느 규모로 많이 가는지(가정).
export function sizeTiers(w: [number, number, number, number], place = "회사"): Tier[] {
  return [
    { id: "large", group: "big", label: `300인 이상 ${place}`, salary: 5001, weight: w[0] },
    { id: "mid", group: "big", label: `30~299인 ${place}`, salary: 3595, weight: w[1] },
    { id: "small", group: "small", label: `5~29인 ${place}`, salary: 3070, weight: w[2] },
    { id: "micro", group: "small", label: `5인 미만 ${place}`, salary: 2731, weight: w[3] },
  ];
}

// ---------- 사건 만드는 도구 ----------

const C = (text: string, tone: Choice["tone"], extra: Partial<Choice> = {}): Choice => ({ text, tone, ...extra });
function E(id: string, title: string, kind: EventCard["kind"], text: string, choices: Choice[], effect: Partial<LifeState>, extra: Partial<EventCard> = {}): EventCard {
  return { id, title, kind, weight: 1, text, choices, effect, ...extra };
}

// 일을 시작한 뒤의 공통 사건(모든 유형)
function workLife(j: Job, ppl: NonNullable<Job["people"]>): EventCard[] {
  const place = j.place ?? "회사";
  const hard = j.tags ?? ["야근"];
  return [
    E("first-mistake", "첫 실수를 했다", "bad", `처음 맡은 일에서 실수가 나왔다. ${ppl.boss}이 조용히 불렀다.`, [C("원인을 정리해서 먼저 보고한다", "push", { effect: { skill: 3, relation: 2 } }), C("다음부터 조심하겠다고만 한다", "safe")], { stress: 9, satisfaction: -5 }, { needsJob: true, maxTenure: 4, weight: 3 }),
    E("daily", `${place}에서의 평범한 한 달`, "neutral", `${j.short} 일이 손에 익어 갔다. 큰일 없이 하루하루가 지나갔다.`, [C("일을 더 잘하는 방법을 하나씩 찾아본다", "push", { effect: { skill: 2 } }), C("퇴근 뒤엔 일 생각을 안 한다", "safe", { effect: { stress: -3 } })], { skill: 1 }, { needsJob: true, repeatable: true, weight: 3 }),
    E("crunch", "일이 몰린 주간", "bad", `마감과 급한 일이 겹쳤다. 일주일 내내 늦게 퇴근했다.`, [C("끝까지 맡아서 끝낸다", "push", { effect: { skill: 3, stress: 4 } }), C("도움을 요청해 나눈다", "safe", { effect: { relation: 2 } })], { stress: 11, satisfaction: -4 }, { needsJob: true, tags: hard, weight: 1.6 }),
    E("praise", `${ppl.boss}에게 인정받았다`, "good", `내가 한 일을 ${ppl.boss}이 회의에서 직접 언급했다.`, [C("다음엔 더 큰 일을 맡겠다고 한다", "push", { effect: { skill: 3, stress: 2 } }), C("이번엔 조용히 기뻐한다", "safe")], { satisfaction: 12, skill: 3 }, { needsJob: true, minTenure: 3, weight: 1.3 }),
    E("peer-leave", `${ppl.peer}가 그만뒀다`, "bad", `같이 버티던 ${ppl.peer}가 그만둔다고 했다. 마지막 날 같이 밥을 먹었다.`, [C("나는 여기서 더 해 본다", "push", { effect: { stress: 2 } }), C("나도 다른 길을 알아보기 시작한다", "change", { effect: { satisfaction: -2 } })], { satisfaction: -6, relation: -4 }, { needsJob: true, minTenure: 6, weight: 1 }),
    E("mentor", `${ppl.other}가 밥을 사 줬다`, "good", `힘들어 보였는지 ${ppl.other}가 퇴근길에 밥을 사 주며 자기 신입 때 얘기를 해 줬다.`, [C("고민을 솔직하게 털어놓는다", "push", { effect: { relation: 6 } }), C("고맙다고만 하고 넘긴다", "safe")], { relation: 6, stress: -6 }, { needsJob: true, weight: 1 }),
    E("raise", "연봉 협상 시즌", "neutral", `1년치 일을 정리해서 ${ppl.boss}과 면담했다.`, [C("성과를 숫자로 정리해 인상을 요구한다", "push", { raise: 6, effect: { stress: 4 } }), C("제시한 대로 받는다", "safe", { raise: 3 })], { satisfaction: 2 }, { needsJob: true, minTenure: 10, calendar: [1, 2], weight: 2 }),
    E("offer", `다른 ${place}에서 연락이 왔다`, "neutral", "조건을 더 주겠다는 제안이 왔다. 지금 사람들과는 정이 들었다.", [C("옮긴다", "change", { sets: "moved", raise: 12, label: "이직함", effect: { stress: 6, satisfaction: 4 } }), C("지금 자리에 남는다", "safe", { label: "남음", effect: { relation: 3 } })], {}, { needsJob: true, minTenure: 12, branch: "choice", branchLabel: "이직 제안", weight: 1.3, evidence: EV_TENURE }),
    E("burnout", "번아웃이 왔다", "bad", "아침에 눈을 떠도 출근할 생각만 하면 숨이 막혔다.", [C("버티면서 일을 줄여 달라고 말한다", "push", { label: "버팀", effect: { stress: -4 } }), C("그만두고 쉬면서 다시 찾는다", "change", { quits: true, label: "그만둠", effect: { stress: -20 } }), C("휴가를 내고 쉰다", "safe", { label: "잠시 쉼", effect: { stress: -14, money: -50 } })], { stress: 14, satisfaction: -12 }, { needsJob: true, minTenure: 8, branch: "choice", branchLabel: "번아웃", tags: hard, weight: 1.1, evidence: EV_QUIT }),
  ];
}

// 졸업 뒤 상시 채용으로 구직하는 공통 사건(open, trade, portfolio, public, license 뒤)
function jobHunt(j: Job, gate: Partial<EventCard>, opts: { hazard: number; tiers: Tier[]; smallTiers?: Tier[] }): EventCard[] {
  return [
    E("apply", "서류 결과가 하나둘 왔다", "bad", `${j.short} 자리에 여러 곳 지원했다. 답이 온 곳은 몇 군데뿐이었다.`, [C("지원서를 고쳐 더 넓게 지원한다", "push", { effect: { skill: 2 } }), C("가고 싶은 곳만 골라 천천히 지원한다", "safe")], { stress: 5, satisfaction: -3 }, { repeatable: true, needsNoJob: true, afterGrad: true, excludes: ["switched"], weight: 3, evidence: EV_FIRSTJOB }),
    E("interview", "최종 면접에서 떨어졌다", "bad", "마지막 질문에서 말이 꼬였다. 일주일 뒤 불합격 메일이 왔다.", [C("면접 질문을 정리해서 다시 연습한다", "push", { effect: { skill: 3 } }), C("운이 없었다고 넘긴다", "safe")], { stress: 7, satisfaction: -5 }, { needsNoJob: true, afterGrad: true, excludes: ["switched"], weight: 1.4 }),
    E("prep", `${j.short} 준비를 한 단계 올렸다`, "neutral", "부족하다고 느낀 부분을 채우려고 계획을 세웠다.", [C("매일 조금씩 끝까지 한다", "push", { effect: { skill: 4 } }), C("부담 없는 만큼만 한다", "safe", { effect: { skill: 1 } })], { skill: 3, stress: 3 }, { needsNoJob: true, excludes: ["switched"], weight: 2 }),
    E("long-hunt", "1년 가까이 자리를 못 잡았다", "bad", "같이 준비하던 친구들은 하나둘 자리를 잡았다.", [C("눈높이를 낮춰 작은 곳도 지원한다", "push", { sets: "lowered", label: "작은 곳도 지원" }), C("다른 길로 방향을 바꾼다", "change", { sets: "switched", label: "다른 길로 전향", effect: { stress: -4 } }), C("지금 기준으로 계속 지원한다", "safe", { label: "기준 유지" })], { stress: 10, satisfaction: -8 }, { needsNoJob: true, afterGrad: true, excludes: ["switched", "long-hunt"], minMonth: 9, branch: "choice", branchLabel: "긴 구직", weight: 4, evidence: EV_FIRSTJOB }),
    E("got-job", `${j.short}로 일하게 됐다`, "good", "최종 합격 연락을 받았다. 다음 달 첫 출근이다.", [C("첫 출근 전에 미리 공부해 둔다", "push", { effect: { skill: 3 } }), C("남은 기간은 푹 쉰다", "safe", { effect: { stress: -6 } })], { satisfaction: 18, stress: -12 }, { chance: opts.hazard, factors: ["jobReady", "region", "school"], hires: true, tiers: opts.tiers, needsNoJob: true, afterGrad: true, excludes: ["switched"], repeatable: true, branch: "luck", branchLabel: "합격", evidence: EV_WAGE, ...gate }),
    E("got-job-small", "작은 곳에 합격했다", "good", "규모는 작지만 바로 실무를 맡긴다고 했다.", [C("일단 들어가서 경력을 쌓는다", "push"), C("조건을 한 번 더 따져 보고 들어간다", "safe")], { satisfaction: 10, stress: -8 }, { chance: opts.hazard * 1.6, factors: ["jobReady"], hires: true, tiers: opts.smallTiers ?? opts.tiers.filter((t) => t.group === "small"), needsNoJob: true, afterGrad: true, requires: ["lowered"], excludes: ["switched"], repeatable: true, branch: "luck", branchLabel: "작은 곳 합격", evidence: EV_WAGE }),
  ];
}

// ---------- 유형별 사건 ----------

const DEFAULT_PEOPLE: Record<Archetype, NonNullable<Job["people"]>> = {
  open: { boss: "박 팀장", peer: "입사 동기 윤", other: "선배 한", otherRole: "선배" },
  public: { boss: "김 차장", peer: "입사 동기 서", other: "선배 오", otherRole: "선배" },
  trade: { boss: "최 반장", peer: "같이 들어온 막내 정", other: "선배 기사 강", otherRole: "선배" },
  portfolio: { boss: "실장 류", peer: "같은 팀 디자이너 문", other: "클라이언트 담당자", otherRole: "클라이언트" },
  exam: { boss: "선배 직원 최", peer: "스터디원 정", other: "같은 기수 동기", otherRole: "동기" },
  license: { boss: "수간호사 박", peer: "입사 동기 이", other: "선배 한", otherRole: "선배" },
  grad: { boss: "지도교수 김", peer: "랩 동기 송", other: "박사과정 선배 허", otherRole: "선배" },
  startup: { boss: "멘토 대표 조", peer: "공동창업자 민", other: "첫 고객", otherRole: "고객" },
};

function examEvents(j: Job, ppl: NonNullable<Job["people"]>): EventCard[] {
  const x = j.exam!;
  const tier: Tier[] = [{ id: "post", group: "post", label: j.short, salary: x.salary, weight: 1 }];
  return [
    E("study-start", "시험 준비를 시작했다", "neutral", `${x.label} 일정표를 붙여 놓고 하루 공부 계획을 세웠다.`, [C("스터디를 만들어 서로 관리한다", "push", { effect: { skill: 3, relation: 3 } }), C("혼자 인강으로 버틴다", "safe")], { stress: 8, skill: 3 }, { chance: 1, maxMonth: 0 }),
    E("study-grind", "다시 책상 앞에 앉았다", "neutral", `독서실과 집만 오가는 날이 이어졌다. ${ppl.peer}과 매일 공부 인증을 주고받았다.`, [C("약한 과목을 집중해서 판다", "push", { effect: { skill: 3, stress: 3 } }), C("컨디션 관리를 우선한다", "safe", { effect: { stress: -3 } })], { skill: 2, stress: 2 }, { repeatable: true, requires: ["study-start"], excludes: ["passed", "switched"], needsNoJob: true, weight: 3 }),
    E("mock-good", "모의고사 점수가 처음으로 합격선을 넘었다", "good", `${ppl.peer}이 진심으로 축하해 줬다.`, [C("이 기세로 공부량을 늘린다", "push", { effect: { skill: 3, stress: 3 } }), C("페이스를 유지한다", "safe")], { satisfaction: 10, skill: 3 }, { requires: ["study-start"], excludes: ["passed", "switched"], minMonth: 4, weight: 1.2 }),
    E("friend-hired", "친구가 먼저 취업했다", "bad", "단톡방에 합격 인증이 올라왔다. 축하한다고 쓰고 한참 화면을 봤다.", [C("자극 받아서 더 집중한다", "push", { effect: { skill: 2, stress: 4 } }), C("오늘은 쉰다", "safe", { effect: { stress: -2 } })], { stress: 8, satisfaction: -8 }, { requires: ["study-start"], excludes: ["passed", "switched"], minMonth: 3, weight: 1.2 }),
    E("family-ask", "명절에 친척들이 물었다", "bad", "\"아직도 공부하니?\" 대답 대신 웃었다.", [C("올해 안에 끝낸다고 다짐한다", "push", { effect: { stress: 4 } }), C("다음 명절엔 안 간다", "safe", { effect: { relation: -4 } })], { stress: 10, satisfaction: -6 }, { requires: ["study-start"], excludes: ["passed", "switched"], calendar: [1, 2, 9, 10], minMonth: 6, weight: 1.5 }),
    E("exam-pass", `${x.label}에 합격했다`, "good", "발표 날, 수험번호를 몇 번이고 다시 확인했다. 합격이었다.", [C("첫 근무 전까지 실무 공부를 해 둔다", "push", { sets: "passed", effect: { skill: 2 } }), C("첫 근무 전까지 푹 쉰다", "safe", { sets: "passed", effect: { stress: -10 } })], { satisfaction: 25, stress: -20 }, { chance: x.chance, warmup: x.warmup, factors: ["examPower", "jobReady", "persistence"], calendar: x.months, minMonth: 4, requires: ["study-start"], excludes: ["passed", "switched"], repeatable: true, branch: "luck", branchLabel: "합격" }),
    E("exam-fail", "시험에 떨어졌다", "bad", `발표 날, 합격선에 몇 점 모자랐다. ${ppl.peer}은 붙었다.`, [C("오답을 분석해서 다음 시험을 준비한다", "push", { effect: { skill: 3 } }), C("한 달은 쉬면서 마음을 추스른다", "safe", { effect: { stress: -6 } })], { stress: 12, satisfaction: -10 }, { chance: 1, calendar: x.months, minMonth: 4, requires: ["study-start"], excludes: ["passed", "switched"], repeatable: true }),
    E("keep-going", "1년이 넘었는데 아직이다", "bad", "처음 계획한 기간이 지났다. 통장 잔고와 나이를 같이 세게 됐다.", [C("딱 1년만 더 한다", "push", { sets: "one-more", label: "1년 더", effect: { stress: 4 } }), C("일반 취업으로 방향을 바꾼다", "change", { sets: "switched", label: "취업으로 전향", effect: { stress: -6 } }), C("알바를 하면서 천천히 계속한다", "safe", { sets: "more-work", label: "알바 병행" })], { stress: 10, satisfaction: -8 }, { requires: ["exam-fail"], excludes: ["passed", "switched", "keep-going"], minMonth: 12, branch: "choice", branchLabel: "계속할지 고민", weight: 4 }),
    E("first-post", x.firstPost, "good", `첫 근무지가 정해졌다. ${ppl.boss}이 첫날 일을 하나씩 알려 줬다.`, [C("업무 매뉴얼부터 다 읽는다", "push", { effect: { skill: 3 } }), C("선배가 하는 걸 보며 따라 한다", "safe", { effect: { relation: 3 } })], { satisfaction: 10 }, { chance: 0.3, requires: ["passed"], needsNoJob: true, hires: true, tiers: tier, branchLabel: "첫 근무", evidence: { label: x.salaryNote, source: "가정(봉급표 확인 필요)" } }),
    E("hard-case", "감당하기 힘든 일을 겪었다", "bad", "현장에서 예상 못 한 일이 터졌다. 퇴근길에 한참 멍하니 있었다.", [C("선배에게 털어놓고 방법을 묻는다", "push", { effect: { relation: 4, skill: 2 } }), C("혼자 삭인다", "safe", { effect: { stress: 4 } })], { stress: 13, satisfaction: -6 }, { needsJob: true, tags: j.tags, repeatable: true, weight: 1.5 }),
    E("meaning", "이 일을 하길 잘했다고 느낀 날", "good", "누군가 진심으로 고맙다고 했다. 처음으로 이 일의 의미가 와닿았다.", [C("이 마음을 기록해 둔다", "push", { effect: { satisfaction: 3 } }), C("동기들과 나눈다", "safe", { effect: { relation: 4 } })], { satisfaction: 14, stress: -6 }, { needsJob: true, minTenure: 2, weight: 1.3 }),
    E("routine", "같은 일이 반복됐다", "neutral", "익숙해진 만큼 지루해졌다.", [C("일을 줄일 방법을 만든다", "push", { effect: { skill: 3 } }), C("그냥 루틴대로 한다", "safe")], { satisfaction: -3 }, { needsJob: true, tags: ["반복업무"], repeatable: true, weight: 2 }),
    E("quit-thought", "그만두고 싶어졌다", "bad", "월급, 근무 환경, 반복되는 일. 같은 기수 한 명이 그만뒀다는 소식을 들었다.", [C("버티면서 다른 자리로 옮길 기회를 본다", "push", { label: "버팀", effect: { stress: 3 } }), C("그만두고 다른 길을 찾는다", "change", { quits: true, sets: "switched", label: "그만둠", effect: { stress: -14 } })], { stress: 10, satisfaction: -10 }, { needsJob: true, minTenure: 6, branch: "choice", branchLabel: "그만둘지 고민", weight: 1.1 }),
  ];
}

function licenseEvents(j: Job, ppl: NonNullable<Job["people"]>): EventCard[] {
  const lic = j.license!;
  return [
    E("lic-study", `${lic.name} 공부`, "neutral", "기출문제를 회독하며 약한 과목을 표시했다.", [C("모의고사를 매주 본다", "push", { effect: { skill: 3, stress: 3 } }), C("페이스대로 한다", "safe")], { skill: 3, stress: 2 }, { needsNoJob: true, excludes: ["licensed", "switched"], repeatable: true, weight: 2 }),
    E("clinical", "실습에서 혼났다", "bad", `실습 중에 실수를 했다. ${ppl.other}가 다른 사람들 앞에서 지적했다.`, [C("잘못을 정리해서 다시 묻는다", "push", { effect: { skill: 3 } }), C("남은 실습만 조용히 버틴다", "safe")], { stress: 9, satisfaction: -5 }, { needsNoJob: true, excludes: ["licensed"], maxMonth: 18, weight: 1.2 }),
    E("lic-pass", `${lic.name}에 합격했다`, "good", "합격자 명단에 내 이름이 있었다. 면허가 나온다.", [C("바로 원하는 곳에 지원한다", "push", { sets: "licensed" }), C("한 달 쉬고 지원한다", "safe", { sets: "licensed", effect: { stress: -8 } })], { satisfaction: 18, stress: -14 }, { chance: lic.chance, factors: ["jobReady"], calendar: [lic.month], afterGrad: true, gradGrace: 3, excludes: ["licensed", "switched"], repeatable: true, branch: "luck", branchLabel: "면허 합격" }),
    E("lic-fail", `${lic.name}에 떨어졌다`, "bad", "합격자 명단에 이름이 없었다. 동기들은 대부분 붙었다.", [C("1년 더 준비한다", "push", { effect: { skill: 3 } }), C("다른 길도 같이 알아본다", "change", { sets: "switched", effect: { stress: -3 } })], { stress: 16, satisfaction: -14 }, { chance: 1, calendar: [lic.month], afterGrad: true, gradGrace: 3, excludes: ["licensed", "switched"], repeatable: true }),
    ...jobHunt(j, { requires: ["licensed"], chance: j.hazard ?? 0.25 }, { hazard: j.hazard ?? 0.25, tiers: j.tiers ?? sizeTiers([0.3, 0.4, 0.2, 0.1], j.place ?? "병원") }).filter((e) => e.id !== "prep").map((e) => (e.id === "apply" || e.id === "interview" || e.id === "long-hunt" ? { ...e, requires: [...(e.requires ?? []), "licensed"] } : e)),
    E("night-shift", "밤 근무가 이어졌다", "bad", "낮과 밤이 바뀌는 근무가 이어졌다. 쉬는 날에도 잠이 오지 않았다.", [C("수면 루틴을 정해서 버틴다", "push", { effect: { stress: -2 } }), C("근무 조정을 요청한다", "safe", { effect: { relation: -2 } })], { stress: 12, satisfaction: -5 }, { needsJob: true, tags: ["야근", "주말근무"], repeatable: true, weight: 2 }),
    E("complaint", "보호자의 강한 항의를 받았다", "bad", "기다리는 시간이 길다며 큰 소리가 났다. 내 잘못은 아니었지만 고개를 숙였다.", [C("상황을 정리해 선배와 공유한다", "push", { effect: { skill: 2, relation: 2 } }), C("속으로 삭인다", "safe", { effect: { stress: 4 } })], { stress: 11, satisfaction: -6 }, { needsJob: true, tags: ["민원"], repeatable: true, weight: 1.5 }),
    E("senior-pressure", "선배의 압박이 심했다", "bad", `${ppl.boss}의 말투가 날카로웠다. 모르는 걸 물어보기가 무서워졌다.`, [C("배울 건 배우고 할 말은 한다", "push", { effect: { skill: 3, stress: 3 } }), C("눈치 보며 버틴다", "safe", { effect: { stress: 5 } })], { stress: 12, satisfaction: -8, relation: -4 }, { needsJob: true, maxMonth: 120, weight: 1.6, evidence: j.id === "nurse" ? { label: "신규 간호사 1년 내 사직률 57.4%(2022)", source: "병원간호사회 자료, 대한간호협회 분석", url: "https://www.newsis.com/view/NISX20240319_0002666727" } : undefined }),
    E("thanks", "환자에게 고맙다는 말을 들었다", "good", "퇴원하던 분이 손을 잡고 고맙다고 했다.", [C("이 일을 더 잘하고 싶어진다", "push", { effect: { skill: 2 } }), C("오늘은 이걸로 충분하다", "safe")], { satisfaction: 14, stress: -6 }, { needsJob: true, minTenure: 2, weight: 1.3 }),
  ];
}

function portfolioEvents(j: Job): EventCard[] {
  return [
    E("work-piece", "새 작업을 하나 끝냈다", "neutral", "포트폴리오에 넣을 작업을 처음부터 끝까지 마무리했다.", [C("공개해서 반응을 본다", "push", { effect: { skill: 3, stress: 2 } }), C("혼자 간직한다", "safe")], { skill: 4, satisfaction: 4 }, { needsNoJob: true, excludes: ["switched"], repeatable: true, weight: 2 }),
    E("contest", "공모전에 냈다", "neutral", "마감 이틀 전까지 밤을 새웠다.", [C("결과와 상관없이 다음 공모전도 낸다", "push", { effect: { skill: 3 } }), C("이번만 해 본다", "safe")], { stress: 6, skill: 3 }, { needsNoJob: true, excludes: ["switched"], weight: 1.2 }),
    E("go-freelance", "회사 대신 혼자 일해 볼까", "neutral", "구직이 길어지자 아는 사람에게서 작은 외주 얘기가 들어왔다.", [C("프리랜서로 시작한다", "change", { sets: "freelance", label: "프리랜서 시작" }), C("회사 입사를 계속 노린다", "safe", { label: "입사 준비 계속" })], { stress: 4 }, { needsNoJob: true, afterGrad: true, minMonth: 6, excludes: ["freelance", "switched"], branch: "choice", branchLabel: "프리랜서 갈림길", weight: 2 }),
    E("first-client", "첫 외주 계약을 했다", "good", "작은 일이지만 내 이름으로 받은 첫 일이다.", [C("기대 이상으로 해 준다", "push", { effect: { skill: 3, stress: 3 } }), C("딱 계약만큼 한다", "safe")], { satisfaction: 14 }, { chance: 0.12, factors: ["jobReady"], requires: ["freelance"], needsNoJob: true, hires: true, tiers: [{ id: "free", group: "free", label: "프리랜서", salary: 2400, weight: 1 }], branch: "luck", branchLabel: "첫 외주", evidence: { label: "프리랜서 수입은 가정값(연 2,400만원 수준)", source: "가정" } }),
    E("revisions", "수정 요청이 열 번째 왔다", "bad", "처음 시안이 제일 좋았다는 말을 듣고 웃었다.", [C("의도를 설명하고 설득한다", "push", { effect: { skill: 3 } }), C("요청대로 다 고친다", "safe", { effect: { stress: 3 } })], { stress: 10, satisfaction: -6 }, { needsJob: true, tags: ["야근"], repeatable: true, weight: 1.8 }),
    E("hit", "작업이 반응을 얻었다", "good", "올린 작업이 생각보다 많이 퍼졌다. 연락이 몇 건 왔다.", [C("후속 작업을 바로 한다", "push", { effect: { skill: 3 } }), C("천천히 즐긴다", "safe")], { satisfaction: 16, skill: 4 }, { needsJob: true, weight: 1 }),
  ];
}

function tradeEvents(j: Job): EventCard[] {
  return [
    E("field-cert", "자격증 실기 시험을 봤다", "neutral", "손이 떨렸지만 시간 안에 끝냈다.", [C("다음 등급 자격증도 준비한다", "push", { effect: { skill: 4 } }), C("일단 지금 걸로 충분하다", "safe")], { skill: 4, stress: 3 }, { excludes: ["switched"], weight: 1.4 }),
    E("safety", "현장에서 아찔한 순간이 있었다", "bad", "안전 수칙을 한 번 건너뛰었다가 큰일 날 뻔했다.", [C("안전 교육을 다시 챙긴다", "push", { effect: { skill: 2 } }), C("운이 좋았다고 넘긴다", "safe", { effect: { stress: 3 } })], { stress: 12 }, { needsJob: true, repeatable: true, weight: 1.2 }),
    E("customer", "손님 불만이 들어왔다", "bad", "결과가 마음에 안 든다는 말을 들었다.", [C("다시 해 드린다", "push", { effect: { skill: 2, stress: 3 } }), C("규정대로 설명한다", "safe")], { stress: 8, satisfaction: -4 }, { needsJob: true, tags: ["민원"], repeatable: true, weight: 1.2 }),
    E("own-shop", "독립해 보라는 제안을 받았다", "neutral", "선배 기사가 같이 가게를 차리자고 했다.", [C("독립한다", "change", { quits: true, sets: "own", label: "독립", effect: { stress: 8, money: -500 } }), C("지금 자리에서 경력을 더 쌓는다", "safe", { label: "남음" })], {}, { needsJob: true, minTenure: 18, branch: "choice", branchLabel: "독립 제안", weight: 1 }),
  ];
}

function gradEvents(j: Job, ppl: NonNullable<Job["people"]>): EventCard[] {
  const tier: Tier[] = [{ id: "grad", group: "grad", label: "대학원생", salary: 1200, weight: 1 }];
  return [
    E("contact-lab", "교수님께 컨택 메일을 보냈다", "neutral", "관심 있는 연구실 세 곳에 메일을 보냈다.", [C("답이 없으면 다시 보낸다", "push", { effect: { skill: 2 } }), C("답이 오는 곳만 기다린다", "safe")], { stress: 5 }, { maxMonth: 6, weight: 3 }),
    E("admit", "대학원에 합격했다", "good", "면접에서 연구 계획을 끝까지 설명했다. 합격이었다.", [C("입학 전에 논문을 미리 읽는다", "push", { sets: "admitted", effect: { skill: 3 } }), C("입학 전까지 쉰다", "safe", { sets: "admitted", effect: { stress: -8 } })], { satisfaction: 16, stress: -10 }, { chance: 0.45, factors: ["jobReady"], calendar: [1, 7], afterGrad: true, gradGrace: 6, excludes: ["admitted", "switched"], repeatable: true, branch: "luck", branchLabel: "입학 합격" }),
    E("enroll", "연구실 생활을 시작했다", "neutral", `${ppl.other}가 실험실 규칙을 알려 줬다. 첫 주부터 일이 많았다.`, [C("선배 실험을 적극적으로 돕는다", "push", { effect: { skill: 3 } }), C("내 과제부터 챙긴다", "safe")], { stress: 6 }, { chance: 0.6, calendar: [3, 9], requires: ["admitted"], needsNoJob: true, hires: true, tiers: tier, evidence: { label: "대학원생 인건비는 가정값(연 1,200만원 수준)", source: "가정" } }),
    E("exp-fail", "실험이 또 실패했다", "bad", "석 달 동안 한 결과가 재현되지 않았다.", [C("원인을 처음부터 다시 찾는다", "push", { effect: { skill: 4, stress: 4 } }), C("주제를 조금 바꾼다", "safe")], { stress: 12, satisfaction: -8 }, { needsJob: true, repeatable: true, weight: 1.8 }),
    E("prof-pressure", `${ppl.boss}의 압박`, "bad", "주말에도 결과를 물어보는 메시지가 왔다.", [C("일정을 정리해서 솔직하게 말한다", "push", { effect: { relation: -2 } }), C("묵묵히 맞춘다", "safe", { effect: { stress: 5 } })], { stress: 11, satisfaction: -6 }, { needsJob: true, tags: ["주말근무"], weight: 1.4 }),
    E("conference", "학회에서 발표했다", "good", "처음으로 내 연구를 사람들 앞에서 발표했다. 질문이 이어졌다.", [C("받은 질문으로 논문을 고친다", "push", { effect: { skill: 4 } }), C("발표한 걸로 만족한다", "safe")], { satisfaction: 16, skill: 4 }, { needsJob: true, minTenure: 6, weight: 1.2 }),
    E("phd-or-job", "박사 과정이냐, 취업이냐", "neutral", "졸업이 다가왔다. 교수님은 박사 과정을 권했다.", [C("박사 과정에 간다", "push", { label: "박사 진학", effect: { stress: 4 } }), C("기업 연구직에 지원한다", "change", { label: "기업 연구직", raise: 200, effect: { stress: -2 } })], {}, { needsJob: true, minTenure: 18, branch: "choice", branchLabel: "박사 vs 취업", weight: 3 }),
  ];
}

function startupEvents(j: Job, ppl: NonNullable<Job["people"]>): EventCard[] {
  const tier: Tier[] = [{ id: "own", group: "own", label: "내 사업", salary: 2400, weight: 1 }];
  return [
    E("register", "사업자 등록을 했다", "neutral", "세무서에서 사업자 등록증을 받았다. 실감이 났다.", [C("첫 고객을 직접 찾아 나선다", "push", { effect: { skill: 3 } }), C("제품부터 완벽하게 다듬는다", "safe")], { stress: 8, satisfaction: 6 }, { chance: 1, maxMonth: 0 }),
    E("grant", "정부지원사업에 선정됐다", "good", "발표 자료를 몇 번이고 고친 보람이 있었다.", [C("지원금으로 사람을 뽑는다", "push", { effect: { stress: 4 } }), C("지원금은 아껴 쓴다", "safe")], { satisfaction: 14, money: 300 }, { chance: 0.15, factors: ["jobReady"], calendar: [5, 9], excludes: ["grant", "switched"], branch: "luck", branchLabel: "지원사업 선정", evidence: { label: "지원금 중 생활비로 쓸 수 있는 몫은 가정값", source: "가정" } }),
    E("first-sale", "월 매출이 생활비를 넘었다", "good", "처음으로 내 사업에서 번 돈으로 한 달을 살았다.", [C("번 돈을 다시 사업에 넣는다", "push", { effect: { skill: 3 } }), C("일단 생활 안정부터", "safe", { effect: { stress: -6 } })], { satisfaction: 20, stress: -10 }, { chance: 0.05, warmup: 6, factors: ["jobReady"], needsNoJob: true, excludes: ["switched"], hires: true, tiers: tier, repeatable: true, branch: "luck", branchLabel: "매출 자리 잡음", evidence: { label: "창업자 소득은 가정값(연 2,400만원 수준)", source: "가정" } }),
    E("cofounder", `${ppl.peer}와 크게 다퉜다`, "bad", "방향이 달랐다. 밤새 얘기했지만 결론이 안 났다.", [C("역할을 다시 나눈다", "push", { effect: { relation: 2 } }), C("한쪽이 물러난다", "safe", { effect: { relation: -6 } })], { stress: 13, satisfaction: -8, relation: -6 }, { excludes: ["switched"], weight: 1.2 }),
    E("pivot", "아무도 안 사는 것 같다", "bad", "몇 달째 고객 반응이 없다.", [C("방향을 바꿔 다시 해 본다", "change", { label: "피벗", effect: { stress: 4 } }), C("접고 취업한다", "change", { sets: "switched", label: "접고 취업", effect: { stress: -10 } }), C("조금만 더 버틴다", "safe", { label: "버팀" })], { stress: 12, satisfaction: -10 }, { needsNoJob: true, minMonth: 8, excludes: ["switched", "pivot"], branch: "choice", branchLabel: "접을지 고민", weight: 4 }),
    E("customer-love", `${ppl.other}가 다시 찾아왔다`, "good", "처음 샀던 고객이 지인을 데리고 왔다.", [C("후기를 부탁한다", "push", { effect: { skill: 2 } }), C("고맙다고만 한다", "safe")], { satisfaction: 12 }, { excludes: ["switched"], minMonth: 3, weight: 1.2 }),
  ];
}

function publicEvents(j: Job): EventCard[] {
  return [
    E("ncs-start", "NCS 필기 준비를 시작했다", "neutral", "공공기관 채용 일정표를 붙여 놓고 문제집을 샀다.", [C("직무 자격증도 같이 준비한다", "push", { effect: { skill: 4, stress: 4 } }), C("필기부터 하나씩 한다", "safe")], { skill: 3, stress: 5 }, { chance: 1, maxMonth: 0 }),
    E("ncs-grind", "문제집 한 권을 끝냈다", "neutral", "시간 재고 푸는 연습을 했다.", [C("약한 유형만 모아 다시 푼다", "push", { effect: { skill: 3 } }), C("다음 권으로 넘어간다", "safe")], { skill: 2 }, { repeatable: true, needsNoJob: true, excludes: ["switched"], weight: 3 }),
    E("pub-fail", "필기에서 떨어졌다", "bad", "공채 필기 결과가 나왔다. 합격선까지 몇 문제였다.", [C("다음 공채까지 모의고사를 매주 푼다", "push", { effect: { skill: 3 } }), C("민간 기업도 같이 지원한다", "change", { sets: "lowered", effect: { stress: -3 } })], { stress: 10, satisfaction: -8 }, { chance: 1, calendar: [5, 11], minMonth: 4, needsNoJob: true, afterGrad: true, excludes: ["switched"], repeatable: true }),
    E("got-public", `${j.short}로 최종 합격했다`, "good", "최종 합격. 근무지는 지방 혁신도시일 수도 있다고 했다.", [C("이사 준비를 바로 시작한다", "push"), C("가족과 먼저 상의한다", "safe", { effect: { relation: 3 } })], { satisfaction: 22, stress: -15 }, { chance: 0.12, warmup: 10, factors: ["jobReady"], calendar: [5, 11], minMonth: 4, needsNoJob: true, afterGrad: true, excludes: ["switched"], hires: true, repeatable: true, tiers: [{ id: "public", group: "public", label: "공공기관", salary: 4099, weight: 1 }], tags: ["지방근무"], branch: "luck", branchLabel: "공공기관 합격", evidence: { label: "공공기관 신입 평균 연봉 4,099만원", source: "인크루트(2026)", url: "https://www.wikitree.co.kr/articles/1115572" } }),
    E("got-private", "민간 기업에 먼저 합격했다", "good", "같이 지원한 회사에서 먼저 연락이 왔다.", [C("일단 들어가서 경력을 쌓는다", "push"), C("공공기관을 계속 노리며 다닌다", "safe")], { satisfaction: 12, stress: -10 }, { chance: 0.06, factors: ["jobReady", "region", "school"], requires: ["lowered"], needsNoJob: true, afterGrad: true, hires: true, repeatable: true, tiers: sizeTiers([0.12, 0.45, 0.33, 0.1]), branch: "luck", branchLabel: "민간 기업 합격", evidence: EV_WAGE }),
  ];
}

// ---------- 직업 한 줄 → 진로 세계 ----------

const PALETTE: [string, string][] = [
  ["#2F5BEA", "#FFFFFF"],
  ["#F26B1D", "#14171F"],
  ["#13A57B", "#14171F"],
  ["#7B4DDB", "#FFFFFF"],
  ["#D6336C", "#FFFFFF"],
  ["#0E8A96", "#FFFFFF"],
  ["#B7791F", "#14171F"],
  ["#4F6D7A", "#FFFFFF"],
  ["#15803D", "#FFFFFF"],
  ["#9333EA", "#FFFFFF"],
  ["#0369A1", "#FFFFFF"],
  ["#BE123C", "#FFFFFF"],
];

const BASE_VALUES: Record<Archetype, Partial<Record<ValueKey, number>>> = {
  open: { 안정: 0.55, 성장: 0.6, 돈: 0.55, 여유: 0.45, 인정: 0.5, 자율: 0.45, 기여: 0.4, 관계: 0.55 },
  public: { 안정: 0.85, 성장: 0.5, 돈: 0.6, 여유: 0.6, 인정: 0.45, 자율: 0.35, 기여: 0.7, 관계: 0.5 },
  exam: { 안정: 0.95, 성장: 0.35, 돈: 0.4, 여유: 0.55, 인정: 0.5, 자율: 0.25, 기여: 0.85, 관계: 0.6 },
  license: { 안정: 0.8, 성장: 0.55, 돈: 0.55, 여유: 0.3, 인정: 0.55, 자율: 0.3, 기여: 0.9, 관계: 0.6 },
  portfolio: { 안정: 0.25, 성장: 0.75, 돈: 0.4, 여유: 0.4, 인정: 0.75, 자율: 0.9, 기여: 0.4, 관계: 0.45 },
  trade: { 안정: 0.6, 성장: 0.6, 돈: 0.55, 여유: 0.4, 인정: 0.5, 자율: 0.6, 기여: 0.5, 관계: 0.5 },
  grad: { 안정: 0.35, 성장: 0.9, 돈: 0.25, 여유: 0.3, 인정: 0.7, 자율: 0.6, 기여: 0.6, 관계: 0.4 },
  startup: { 안정: 0.1, 성장: 0.9, 돈: 0.6, 여유: 0.2, 인정: 0.7, 자율: 1, 기여: 0.6, 관계: 0.5 },
};

const PREP_COST: Record<Archetype, number> = { open: 10, public: 15, exam: 20, license: 15, portfolio: 10, trade: 10, grad: 10, startup: 40 };

export function buildWorld(j: Job, index: number): WorldTemplate {
  const ppl = j.people ?? DEFAULT_PEOPLE[j.archetype];
  const tiers = j.tiers ?? sizeTiers([0.12, 0.45, 0.33, 0.1]);
  let events: EventCard[];
  switch (j.archetype) {
    case "exam":
      events = examEvents(j, ppl);
      break;
    case "license":
      events = [...licenseEvents(j, ppl), ...workLife(j, ppl).filter((e) => e.id !== "burnout" || true)];
      break;
    case "portfolio":
      events = [...jobHunt(j, {}, { hazard: j.hazard ?? 0.045, tiers: j.tiers ?? sizeTiers([0.05, 0.3, 0.45, 0.2], j.place ?? "회사") }), ...portfolioEvents(j), ...workLife(j, ppl)];
      break;
    case "trade":
      events = [...jobHunt(j, {}, { hazard: j.hazard ?? 0.11, tiers: j.tiers ?? sizeTiers([0.05, 0.3, 0.45, 0.2], j.place ?? "업체") }), ...tradeEvents(j), ...workLife(j, ppl)];
      break;
    case "public":
      events = [...publicEvents(j), ...workLife(j, ppl)];
      break;
    case "grad":
      events = [...gradEvents(j, ppl), ...workLife(j, ppl).filter((e) => ["daily", "mentor", "burnout"].includes(e.id))];
      break;
    case "startup":
      events = [...startupEvents(j, ppl), ...workLife(j, ppl).filter((e) => ["daily", "burnout"].includes(e.id))];
      break;
    default:
      events = [...jobHunt(j, {}, { hazard: j.hazard ?? 0.07, tiers }), ...workLife(j, ppl)];
  }
  if (j.archetype === "exam") events = [...events, ...workLife(j, ppl).filter((e) => ["first-mistake", "mentor", "raise"].includes(e.id))];

  const [color, onColor] = PALETTE[index % PALETTE.length];
  const facts: Fact[] = [...(j.facts ?? [])];
  if (["open", "portfolio", "trade", "license", "public"].includes(j.archetype)) facts.push(F_FIRSTJOB, F_WAGE);
  facts.push(F_TENURE, F_QUIT);
  return {
    id: j.id,
    name: j.name,
    short: j.short,
    subtitle: j.family,
    family: j.family,
    archetype: j.archetype,
    majors: j.majors,
    readiness: j.readiness,
    certs: j.certs ?? [],
    color,
    onColor,
    badge: j.short.slice(0, 1),
    fitValues: { ...BASE_VALUES[j.archetype], ...j.values },
    fitTraits: j.traits ?? {},
    fitInterests: j.interests ?? {},
    thirdPathReason: j.why ?? `${j.family} 쪽에서 내 가치관과 잘 맞는 길이에요.`,
    prepCost: PREP_COST[j.archetype],
    hoursPerWeek: j.hours ?? 44,
    startSkill: j.archetype === "exam" ? "examPower" : "jobReady",
    facts,
    npcs: [
      { name: ppl.boss, role: "윗사람", persona: "결과를 중시하지만 성실한 사람은 챙긴다." },
      { name: ppl.peer, role: "동료", persona: "같은 처지라 서로 의지하지만 비교도 된다." },
      { name: ppl.other, role: ppl.otherRole, persona: "먼저 이 길을 걸어 본 사람. 현실적인 조언을 한다." },
    ],
    events,
  };
}

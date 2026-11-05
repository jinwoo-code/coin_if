// 검사 깊이별 단계 목록(설계 근거: docs/검사-설계-근거.md '검사 깊이').
// 빠르게 = 동의 + 꼭 필요한 것만(화면 15개 이하), 상황 질문은 학습용 6 + 채점용 3.
// 표준 = 빠르게(Mini-IPIP 20) + 경험·제약 + IPIP 50의 나머지 30 + 흥미 24 + 상황 질문 나머지 9(채점용 3 포함, 18개 전부) + 진로 구성 인터뷰 5문항.
// 한 화면에 문항 여러 개를 묶어 화면 수를 줄인다. 이미 답한 단계는 빼서 깊이를 올려도 다시 묻지 않는다.
import { IPIP_REST_IDS, MINI_IDS } from "./mini-ipip";
import { pickHoldout, QUICK_HOLDOUT, RIASEC24, SJT } from "./tests";
import type { DepthMode, Profile } from "./types";

export type TextKey = "dilemma" | "experiences" | "constraints";

export type Step =
  | { kind: "consent" } // 검사 시작 전 동의(무엇을 받고 어디에 저장하는지)
  | { kind: "basic" }
  | { kind: "depth" }
  | { kind: "text"; key: TextKey; ask: string; placeholder: string; quick?: string[] }
  | { kind: "values" }
  | { kind: "spec" }
  | { kind: "life" }
  | { kind: "wants" }
  | { kind: "mini"; ids: string[]; first: boolean } // Mini-IPIP 묶음(10문항씩 2화면)
  | { kind: "sjt"; ids: string[] } // 상황 질문 묶음
  | { kind: "cci" } // 진로 구성 인터뷰 5문항(한 화면)
  | { kind: "story" } // 이야기에서 뽑은 값 확인("맞나요?")
  | { kind: "scale"; test: "ipip" | "riasec"; ids: string[]; part: number; parts: number }; // IPIP·흥미 묶음

export const DEPTHS: { mode: DepthMode; title: string; time: string; desc: string; ready: boolean }[] = [
  { mode: "quick", title: "빠르게", time: "약 11분", desc: "꼭 필요한 것만 물어요. 결과가 덜 정확할 수 있어요.", ready: true },
  { mode: "standard", title: "표준", time: "30~40분", desc: "성격 50문항(20문항은 앞에서 답함), 흥미 검사, 경험 이야기까지 해요.", ready: true },
  { mode: "deep", title: "정밀", time: "장마다 15~20분", desc: "표준 + 인생 이야기 6장. 멈췄다가 이어서 할 수 있어요.", ready: true },
  { mode: "ongoing", title: "계속 닮아 가기", time: "몇 주~몇 달", desc: "표준 + 시뮬레이션 속 선택 고치기와 한 달 체크인으로 맞춰 가요.", ready: true },
];

const DILEMMA: Step = {
  kind: "text",
  key: "dilemma",
  ask: "요즘 가장 고민되는 선택이 뭐예요?",
  placeholder: "예: 개발자로 취업할지 공무원 시험을 볼지…",
  quick: ["바로 취업할지 공무원을 준비할지", "전공을 살릴지 다른 길로 갈지", "취업할지 대학원에 갈지"],
};
const EXPERIENCES: Step = { kind: "text", key: "experiences", ask: "지금까지 해 본 것 중에 기억에 남는 경험이 있어요? 수업, 알바, 동아리 뭐든 좋아요.", placeholder: "예: 동아리에서 앱을 만들어 봤어요…" };
const CONSTRAINTS: Step = { kind: "text", key: "constraints", ask: "진로를 정할 때 신경 쓰이는 게 더 있어요? 가족, 건강, 하고 싶은 것 뭐든요.", placeholder: "예: 부모님이 안정적인 일을 원하셔서…" };

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const scalePages = (test: "ipip" | "riasec", ids: string[], size: number): Step[] => {
  const parts = chunk(ids, size);
  return parts.map((ids, i) => ({ kind: "scale", test, ids, part: i + 1, parts: parts.length }));
};

const sjtPages = (ids: string[]): Step[] => chunk(ids, 3).map((ids) => ({ kind: "sjt" as const, ids }));

// holdout: 이 사람의 채점용 문항(앞 3개는 빠르게에서, 나머지는 표준에서 묻는다). 화면에서는 다른 문항과 똑같이 보인다.
export function stepsFor(mode: DepthMode, holdout: string[]): Step[] {
  const train = SJT.filter((q) => q.role === "train").map((q) => q.id);
  const quickHoldout = holdout.slice(0, QUICK_HOLDOUT);
  const rest = SJT.filter((q) => q.role === "pool" && !quickHoldout.includes(q.id)).map((q) => q.id);
  const quick: Step[] = [
    { kind: "consent" },
    { kind: "basic" },
    { kind: "depth" },
    DILEMMA,
    { kind: "spec" },
    { kind: "values" },
    { kind: "mini", ids: MINI_IDS.slice(0, 10), first: true },
    { kind: "life" },
    { kind: "mini", ids: MINI_IDS.slice(10), first: false },
    ...sjtPages([...train, ...quickHoldout]),
    { kind: "wants" },
  ];
  if (mode === "quick") return quick;
  return [
    ...quick,
    EXPERIENCES,
    ...scalePages(
      "ipip",
      IPIP_REST_IDS, // Mini-IPIP 20문항은 앞에서 답했다. 나머지 30문항만.
      10,
    ),
    ...scalePages(
      "riasec",
      RIASEC24.map((i) => i.id),
      8,
    ),
    ...sjtPages(rest),
    { kind: "cci" },
    { kind: "story" },
    CONSTRAINTS,
  ];
}

export const depthOrder = (m: DepthMode) => DEPTHS.findIndex((d) => d.mode === m);

// 이미 답한 단계인지. 예전(v4) 프로필은 원답이 없어서 depth 개수로 본다.
export function isAnswered(step: Step, p: Profile): boolean {
  switch (step.kind) {
    case "consent":
      return true; // 프로필이 있으면 이미 동의하고 시작한 것
    case "basic":
      return !!p.name;
    case "depth":
      return false; // 깊이는 올릴 때마다 다시 고른다
    case "text":
      return p[step.key].trim().length > 0;
    case "values":
      return p.values.length >= 4;
    case "spec":
      return p.depth.spec || p.depth.resume;
    case "life":
      return p.depth.life;
    case "wants":
      return true; // 기본값이 있고, 프로필이 있으면 이미 지나온 단계
    case "cci":
      return p.storyRaw.cci !== undefined; // 다 건너뛰어도(빈 답) 지나온 단계
    case "story":
      return p.story !== null || (p.storyRaw.cci !== undefined && !Object.values(p.storyRaw.cci).some((a) => a.trim())); // 확인했거나, 이야기를 다 건너뛴 경우
    case "mini":
      return p.depth.bigFiveItems >= 20 || step.ids.every((id) => p.answers.ipip?.[id] !== undefined);
    case "sjt": {
      const old = p.depth.behaviorItems >= 6 && !p.answers.sjt; // v4: 원답 없이 s1~s6을 답한 프로필
      return step.ids.every((id) => p.answers.sjt?.[id] !== undefined || p.holdoutPicks[id] !== undefined || (old && SJT.find((q) => q.id === id)?.role === "train"));
    }
    case "scale": {
      const done = step.test === "ipip" ? p.depth.bigFiveItems >= 50 : p.depth.interestItems >= 24;
      const ans = step.test === "ipip" ? p.answers.ipip : p.answers.riasec;
      return done || step.ids.every((id) => ans?.[id] !== undefined);
    }
  }
}

// 깊이를 올릴 때: 깊이 고르기 + 아직 안 한 단계만
export function remainingSteps(mode: DepthMode, p: Profile, holdout: string[]): Step[] {
  return stepsFor(mode, holdout).filter((s) => s.kind === "depth" || !isAnswered(s, p));
}

// 단계 수·입력 수(보고·테스트용). 입력 = 사용자가 답하거나 고를 수 있는 칸 수.
export function countSteps(mode: DepthMode) {
  const steps = stepsFor(mode, pickHoldout("count"));
  const inputs: Record<Step["kind"], (s: Step) => number> = {
    consent: () => 1,
    basic: () => 2,
    depth: () => 1,
    text: () => 1,
    values: () => 4,
    spec: () => 10, // 학교·지금·졸업까지·학점·토익·자격증·프로젝트·수상·근로·인턴(기본값 있음)
    life: () => 8, // 모은 돈·집 지원·생활비·공부 시간·알바 시간·사는 곳·병역·입대 예정(기본값 있음)
    wants: () => 2,
    cci: () => 5,
    story: () => 1,
    mini: (s) => (s.kind === "mini" ? s.ids.length : 0),
    sjt: (s) => (s.kind === "sjt" ? s.ids.length : 0),
    scale: (s) => (s.kind === "scale" ? s.ids.length : 0),
  };
  return { screens: steps.length, inputs: steps.reduce((n, s) => n + inputs[s.kind](s), 0) };
}

// 더 할 수 있는 검사가 남았는지(결과·진로 고르기 화면의 "더 정확하게 하기" 버튼)
export function canDeepen(p: Profile): boolean {
  return remainingSteps("standard", p, p.holdout?.ids ?? pickHoldout("")).length > 1;
}

// 인생 이야기(진로 구성 인터뷰)에서 뽑는 값. 설계 근거: docs/검사-설계-근거.md '인생 이야기'.
// 원문(storyRaw)은 이 기기에만 저장하고 확률·선택 계산에는 쓰지 않는다. 엔진에 들어갈 수 있는 건 사용자가 확인한 값(story)뿐이다.
import type { ValueKey } from "./types";

// Savickas 진로 구성 인터뷰(Career Construction Interview)를 우리말로 옮긴 5문항. 모두 건너뛸 수 있다.
export const CCI: { id: string; ask: string; placeholder: string }[] = [
  { id: "c1", ask: "어릴 때 존경했던 사람은 누구이고, 어떤 점이 좋았나요?", placeholder: "예: 동네 정비소 아저씨요. 뭐든 고쳐서…" },
  { id: "c2", ask: "즐겨 보는 콘텐츠(유튜브, 웹툰, 잡지 등)는 뭔가요?", placeholder: "예: 요리 유튜브를 자주 봐요…" },
  { id: "c3", ask: "좋아하는 이야기(책, 영화, 드라마)는 뭔가요?", placeholder: "예: 슬램덩크요. 끝까지 포기 안 해서…" },
  { id: "c4", ask: "좌우명이나 자주 떠올리는 말이 있나요?", placeholder: "예: 일단 해 보자…" },
  { id: "c5", ask: "가장 오래된 기억은 뭔가요?", placeholder: "예: 할머니 댁 마당에서…" },
];

export interface StorySignals {
  decisionStyle: { value: "impulsive" | "deliberate" | "follow"; evidence: string; confidence: number } | null;
  persistence: { value: 1 | 2 | 3 | 4 | 5; evidence: string; confidence: number } | null;
  familyExpectation: { value: "none" | "stable" | "specific"; job?: string; strength: 1 | 2 | 3 | 4 | 5; evidence: string } | null;
  regretType: { value: "inaction" | "action" | "none"; evidence: string } | null;
  coreValues: { value: ValueKey; evidence: string }[]; // ValueKey는 기존 가치관 키만
  runwayMonths: { value: number; evidence: string } | null; // 집 지원 없이 버틸 수 있는 개월
}

export const EMPTY_SIGNALS: StorySignals = { decisionStyle: null, persistence: null, familyExpectation: null, regretType: null, coreValues: [], runwayMonths: null };

export const VALUE_KEYS: ValueKey[] = ["안정", "성장", "돈", "여유", "인정", "자율", "기여", "관계"];

export const LABEL = {
  decisionStyle: { impulsive: "일단 하고 보는 편", deliberate: "따져 보고 정하는 편", follow: "주변 의견을 따르는 편" },
  familyExpectation: { none: "특별한 기대는 없음", stable: "안정적인 일을 바람", specific: "바라는 직업이 있음" },
  regretType: { inaction: "안 해서 후회한 적이 많음", action: "해서 후회한 적이 많음", none: "후회가 별로 없음" },
} as const;

// 비교용: 공백·문장부호 차이는 무시한다
const norm = (s: string) => s.replace(/[\s"'“”‘’.,!?…~]/g, "");

// AI가 낸 값을 검사한다. 범위를 벗어나거나, 근거가 원문에 없는 값(지어낸 값)은 버린다.
export function sanitizeSignals(raw: unknown, source: string): StorySignals {
  const src = norm(source);
  const r = (raw ?? {}) as Record<string, unknown>;
  const quoted = (e: unknown) => typeof e === "string" && norm(e).length >= 2 && src.includes(norm(e));
  const conf = (c: unknown) => (typeof c === "number" && Number.isFinite(c) ? Math.min(1, Math.max(0, Math.round(c * 100) / 100)) : 0.5);
  const obj = (k: string) => (r[k] && typeof r[k] === "object" ? (r[k] as Record<string, unknown>) : null);
  const out: StorySignals = { ...EMPTY_SIGNALS, coreValues: [] };

  const d = obj("decisionStyle");
  if (d && ["impulsive", "deliberate", "follow"].includes(d.value as string) && quoted(d.evidence)) out.decisionStyle = { value: d.value as "impulsive", evidence: String(d.evidence), confidence: conf(d.confidence) };

  const p = obj("persistence");
  if (p && [1, 2, 3, 4, 5].includes(p.value as number) && quoted(p.evidence)) out.persistence = { value: p.value as 1, evidence: String(p.evidence), confidence: conf(p.confidence) };

  const f = obj("familyExpectation");
  if (f && ["none", "stable", "specific"].includes(f.value as string) && quoted(f.evidence)) {
    const strength = [1, 2, 3, 4, 5].includes(f.strength as number) ? (f.strength as 1) : 3;
    out.familyExpectation = { value: f.value as "none", strength, evidence: String(f.evidence), ...(f.value === "specific" && typeof f.job === "string" && f.job.trim() ? { job: f.job.trim().slice(0, 30) } : {}) };
  }

  const g = obj("regretType");
  if (g && ["inaction", "action", "none"].includes(g.value as string) && quoted(g.evidence)) out.regretType = { value: g.value as "none", evidence: String(g.evidence) };

  if (Array.isArray(r.coreValues)) {
    for (const v of r.coreValues as Record<string, unknown>[]) {
      if (v && VALUE_KEYS.includes(v.value as ValueKey) && quoted(v.evidence) && !out.coreValues.some((x) => x.value === v.value)) out.coreValues.push({ value: v.value as ValueKey, evidence: String(v.evidence) });
    }
    out.coreValues = out.coreValues.slice(0, 4);
  }

  const m = obj("runwayMonths");
  if (m && typeof m.value === "number" && m.value >= 0 && m.value <= 120 && quoted(m.evidence)) out.runwayMonths = { value: Math.round(m.value), evidence: String(m.evidence) };

  return out;
}

// 키가 없을 때의 목업: 낱말 규칙으로 찾고, 찾은 문장을 그대로 근거로 쓴다. 못 찾으면 null(지어내지 않는다).
export function mockSignals(source: string): StorySignals {
  const sentences = source
    .split(/(?<=[.!?。\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const find = (words: string[]) => sentences.find((s) => words.some((w) => s.includes(w)));
  const out: StorySignals = { ...EMPTY_SIGNALS, coreValues: [] };

  const imp = find(["일단 해", "일단 하", "바로 해", "부딪혀"]);
  const del = find(["꼼꼼", "따져", "계획", "신중"]);
  const fol = find(["부모님이 하라", "시키는 대로", "따라서"]);
  const ds = imp ? (["impulsive", imp] as const) : del ? (["deliberate", del] as const) : fol ? (["follow", fol] as const) : null;
  if (ds) out.decisionStyle = { value: ds[0], evidence: ds[1], confidence: 0.4 };

  const keep = find(["포기 안", "포기하지", "끝까지", "버텼"]);
  const quit = find(["그만뒀", "포기했", "금방 질"]);
  if (keep) out.persistence = { value: 4, evidence: keep, confidence: 0.4 };
  else if (quit) out.persistence = { value: 2, evidence: quit, confidence: 0.4 };

  const fam = find(["부모님", "엄마", "아빠", "가족"]);
  if (fam && /공무원|안정|대기업/.test(fam)) out.familyExpectation = { value: "stable", strength: 3, evidence: fam };

  const reg = find(["후회"]);
  if (reg) out.regretType = { value: /안 해|못 해|포기/.test(reg) ? "inaction" : "action", evidence: reg };

  const valueWords: [ValueKey, string[]][] = [
    ["성장", ["성장", "배우"]],
    ["돈", ["돈", "부자"]],
    ["안정", ["안정"]],
    ["자율", ["자유", "내 방식"]],
    ["기여", ["도움", "돕"]],
    ["관계", ["친구", "사람들"]],
  ];
  for (const [v, ws] of valueWords) {
    const s = find(ws);
    if (s && out.coreValues.length < 4) out.coreValues.push({ value: v, evidence: s });
  }
  return out;
}

export const hasAnySignal = (s: StorySignals) => Boolean(s.decisionStyle || s.persistence || s.familyExpectation || s.regretType || s.runwayMonths || s.coreValues.length);

// ---------- 엔진에서 쓰는 곳(docs/검사-설계-근거.md '이야기에서 뽑는 값과 엔진에서 쓰는 곳'). 무게는 전부 가정값 ----------
// 이야기가 없으면(null) 모두 원래 값을 그대로 돌려줘서, 이야기를 안 쓴 사람의 결과는 바뀌지 않는다.

// 끈기: 상황 질문 점수 2 : 이야기에서 확인한 끈기 1
export function blendPersistence(sjt: number, story: StorySignals | null) {
  return story?.persistence ? Math.round(((2 * sjt + story.persistence.value) / 3) * 10) / 10 : sjt;
}

// 가치관 부합도: 순위로 고른 가치관 0.8 + 이야기에서 확인한 핵심 가치의 평균 부합도 0.2
export function blendValueFit(base: number, fitValues: Partial<Record<ValueKey, number>>, story: StorySignals | null) {
  const cv = story?.coreValues ?? [];
  if (!cv.length) return base;
  return 0.8 * base + 0.2 * (cv.reduce((s, c) => s + (fitValues[c.value] ?? 0.5), 0) / cv.length);
}

// 선택 이유에 붙일 짧은 인용: "일단 해 보자"라고 해서
export function storyReason(evidence: string) {
  const e = evidence.trim().replace(/[.。!?]+$/, "");
  return `"${e.length > 24 ? `${e.slice(0, 23)}…` : e}"라고 해서`;
}

// 장마다 뽑은 값 합치기: 새로 확인한 값이 있으면 그걸로, 없으면 전 값 유지. 핵심 가치는 새 것 먼저 최대 4개.
export function mergeSignals(old: StorySignals | null, add: StorySignals): StorySignals {
  if (!old) return add;
  const cv = [...add.coreValues, ...old.coreValues].filter((c, i, xs) => xs.findIndex((x) => x.value === c.value) === i).slice(0, 4);
  return {
    decisionStyle: add.decisionStyle ?? old.decisionStyle,
    persistence: add.persistence ?? old.persistence,
    familyExpectation: add.familyExpectation ?? old.familyExpectation,
    regretType: add.regretType ?? old.regretType,
    coreValues: cv,
    runwayMonths: add.runwayMonths ?? old.runwayMonths,
  };
}

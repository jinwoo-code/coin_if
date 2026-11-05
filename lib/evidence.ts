// 포트폴리오(증거물): 필요한 것 목록의 능력단위로 '내가 이 일을 할 줄 안다는 증거물'을 정한다. 시험형은 모의고사 기록.
// 형태·분량은 data/evidence-forms.json(가정값), 완성 기준은 NCS 수행준거를 짧게 고친 것. 주제만 AI가 제안한다.
import forms from "@/data/evidence-forms.json";
import type { GapItem } from "./gap";
import type { Requirements, RequirementItem } from "./requirements";
import type { Archetype, WorldTemplate } from "./types";

export interface EvidenceCard {
  id: string; // 능력단위 id 또는 데이터의 형태 id
  unit: string | null; // 보여 주는 능력단위
  form: string;
  amount: string; // 가정값
  checks: string[];
  checksGrade: "ncs" | "assumed";
  checksTotal: number; // 수행준거 전체 개수
  evalConsider: string[];
  noTopic?: boolean; // 기록이라 주제를 고르지 않는다
}
export interface EvidencePlan {
  total: string;
  basis: string | null; // 능력단위를 어떻게 골랐는지
  cards: EvidenceCard[];
}
export interface ExamPlan {
  total: string;
  amount: string;
  subjects: { id: string; name: string }[];
}
export type Topic = { title: string; why: string };
export interface MockRecord {
  ym: string;
  scores: Record<string, number>;
}
export interface EvidenceSaved {
  suggestions?: Record<string, Topic[]>;
  suggestSource?: "ai" | "rule";
  topics?: Record<string, string>; // 고르거나 직접 쓴 주제
  checks?: Record<string, string[]>; // 완성한 기준
  mocks?: MockRecord[];
  weakPlans?: Record<string, string>;
}

type Form = { form: string; amount: string };
type Extra = Form & { id: string; checks: string[]; noTopic?: boolean };
const ARCH = forms as unknown as Record<string, { unit?: Form; total: string; extras?: Extra[]; amount?: string }>;
const UNIT_LIMIT = forms.unitLimit;
const MAX_CHECKS = forms.maxChecks;

export const isExamWorld = (w: Pick<WorldTemplate, "archetype">) => w.archetype === "exam";

// "…을 계획할 수 있다." → "…을 계획했다". 다른 동사(만들 수 있다 등)는 끝의 마침표만 뗀다.
const LEAD = /^.{4,}?(?:에 따라|을 바탕으로|를 바탕으로|을 고려하여|를 고려하여|을 활용하여|를 활용하여)\s+/;
export function shortCriterion(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (t.length > 45) t = t.replace(LEAD, "");
  if (/할 수 있다\.?$/.test(t)) return t.replace(/할 수 있다\.?$/, "했다");
  return t.replace(/\.$/, "");
}

// 공고 비율이 있으면 그 순서, 없으면 격차가 큰 쪽 → 직책 수준이 높은 쪽(신입 범위 안) → 파일 순서.
function pickUnits(req: Requirements, gaps: GapItem[]): { units: RequirementItem[]; byPosting: boolean } {
  const status = new Map(gaps.map((g) => [g.item.id, g.status]));
  const rank = { none: 0, partial: 1, have: 2 } as const;
  const pool = req.items.filter((i) => i.kind === "skill" && i.entry !== false);
  const withCriteria = pool.filter((i) => i.ncsCriteria?.length);
  const list = withCriteria.length ? withCriteria : pool;
  const byPosting = list.some((i) => i.postingShare !== undefined);
  const units = list
    .map((i, at) => ({ i, at }))
    .toSorted((a, b) =>
      byPosting
        ? (b.i.postingShare ?? 0) - (a.i.postingShare ?? 0) || a.at - b.at
        : rank[status.get(a.i.id) ?? "none"] - rank[status.get(b.i.id) ?? "none"] || (b.i.positionLevel ?? 0) - (a.i.positionLevel ?? 0) || a.at - b.at,
    )
    .slice(0, UNIT_LIMIT)
    .map((x) => x.i);
  return { units, byPosting };
}

export function buildEvidence(req: Requirements, world: Pick<WorldTemplate, "archetype">, gaps: GapItem[]): EvidencePlan {
  const a = ARCH[world.archetype as Archetype] ?? ARCH.open;
  const { units, byPosting } = pickUnits(req, gaps);
  const unitForm = a.unit ?? { form: "증거물", amount: "1개" };
  const cards: EvidenceCard[] = units.map((u) => ({
    id: u.id,
    unit: u.name,
    form: unitForm.form,
    amount: unitForm.amount,
    checks: (u.ncsCriteria ?? []).slice(0, MAX_CHECKS).map(shortCriterion),
    checksGrade: u.ncsCriteria?.length ? "ncs" : "assumed",
    checksTotal: u.ncsCriteria?.length ?? 0,
    evalConsider: u.evalConsider ?? [],
  }));
  // 능력단위가 있는 진로는 같은 이름의 증거물을 또 만들지 않는다.
  for (const e of a.extras ?? []) {
    if (units.length && e.form === unitForm.form) continue;
    cards.push({ id: e.id, unit: null, form: e.form, amount: e.amount, checks: e.checks, checksGrade: "assumed", checksTotal: e.checks.length, evalConsider: [], noTopic: e.noTopic });
  }
  const basis = !units.length ? null : byPosting ? "공고에 많이 나오는 능력단위 순으로 골랐어요." : "공고 집계가 없어서(기관 키 필요) 격차가 큰 신입 능력 순으로 골랐어요.";
  return { total: a.total, basis, cards };
}

export function buildExamPlan(req: Requirements): ExamPlan {
  const subjects = req.items.filter((i) => i.kind === "exam").map((i) => ({ id: i.id, name: i.name }));
  return { total: ARCH.exam.total, amount: ARCH.exam.amount ?? "", subjects };
}

// 과목별 평균이 낮은 순. 기록이 없는 과목은 판단하지 않는다. 가장 낮은 과목 말고는 전체 평균보다 낮을 때만 약점으로 본다.
export function weakSubjects(mocks: MockRecord[], subjects: { id: string; name: string }[], count = forms.exam.weakCount) {
  const scored = subjects
    .map((s) => {
      const xs = mocks.map((m) => m.scores[s.id]).filter((x): x is number => typeof x === "number");
      return { ...s, avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, n: xs.length };
    })
    .filter((s) => s.avg !== null)
    .toSorted((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
  const overall = scored.reduce((sum, s) => sum + (s.avg ?? 0), 0) / Math.max(1, scored.length);
  return scored.filter((s, i) => i === 0 || (s.avg ?? 0) < overall).slice(0, count);
}

// AI 없이 만든 예시. 키가 없거나 AI가 실패하면 쓴다.
export function ruleTopics(cards: { id: string; label: string }[], major: string): Record<string, Topic[]> {
  const m = major.trim();
  return Object.fromEntries(
    cards.map((c) => [
      c.id,
      [
        { title: `수업·알바·동아리에서 겪은 문제 하나로 만드는 ${c.label}`, why: "이미 겪은 일이라 내용을 바로 쓸 수 있어요" },
        ...(m ? [{ title: `${m}에서 다룬 자료로 만드는 ${c.label}`, why: "전공과 이어서 설명할 수 있어요" }] : []),
      ],
    ]),
  );
}

// AI 응답 검사: 후보 id만 남기고, 버린 횟수를 돌려준다.
export function cleanTopics(raw: unknown, validIds: string[]): { topics: Record<string, Topic[]>; dropped: number } {
  const topics: Record<string, Topic[]> = {};
  let dropped = 0;
  const list = (raw as { topics?: unknown } | null)?.topics;
  if (!Array.isArray(list)) return { topics, dropped };
  for (const x of list as { card?: unknown; title?: unknown; why?: unknown }[]) {
    const id = typeof x?.card === "string" ? x.card : "";
    const title = typeof x?.title === "string" ? x.title.trim() : "";
    const why = typeof x?.why === "string" ? x.why.trim() : "";
    if (!validIds.includes(id) || !title || title.length > 50 || why.length > 70) {
      dropped++;
      continue;
    }
    const cur = (topics[id] ??= []);
    if (cur.length < 3 && !cur.some((t) => t.title === title)) cur.push({ title, why });
  }
  return { topics, dropped };
}

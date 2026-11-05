// 브라우저에서 공유본 만들기: 지금 화면과 같은 계산(격차·일정·저장된 고른 주제·다시 살아 본 결과)에서 결과만 고른다.
import { monthLabel } from "./calendar";
import { buildEvidence, isExamWorld } from "./evidence";
import { gapItems, prioritize } from "./gap";
import { majorFamily } from "./job-codes";
import { computeGapDeltas } from "./levers-client";
import type { Requirements } from "./requirements";
import { buildPlan, overText, rangeLabel } from "./schedule";
import { rawSnippets, scrubShared, type SharedReport, type SharedWorld } from "./shared-report";
import { store } from "./store";
import type { Multiverse, Profile, Report, Selection } from "./types";
import { getWorld } from "./worlds";

const STATUS: Record<string, string> = { have: "있음", partial: "부분적", none: "없음" };

async function worldOf(p: Profile, s: Selection, r: Report["worlds"][number], mv: Multiverse): Promise<SharedWorld> {
  const w = getWorld(r.worldId);
  const family = majorFamily(p.major);
  const res = await fetch(`/api/requirements?world=${encodeURIComponent(w.id)}${family ? `&family=${encodeURIComponent(family)}` : ""}`);
  if (!res.ok) throw new Error(String(res.status));
  const req = (await res.json()) as Requirements;
  const answers = store.getGapAnswers()[w.id] ?? {};
  const gaps = gapItems(req, p, w, answers);
  const deltas = await computeGapDeltas(p, w.id, s.months, s.startYm, gaps);
  const rows = prioritize(gaps, w, p, deltas);
  const plan = buildPlan(rows, p, w, s.months, store.getPlanEdits()[w.id] ?? {});
  const saved = store.getEvidence()[w.id] ?? {};
  const cards = isExamWorld(w) ? [] : buildEvidence(req, w, gaps).cards;
  const rerun = store.getPlanReruns()[w.id]?.result ?? null;
  return {
    id: w.id,
    name: w.name,
    months: mv.months,
    runs: mv.stats.runs,
    fit: r.fit,
    gateLabel: mv.stats.gate?.label ?? "",
    gateShare: mv.stats.gate?.share ?? 0,
    satisfied: mv.stats.satisfiedShare,
    stressed: mv.stats.stressedShare,
    good: r.good,
    hard: r.hard,
    gap: {
      have: gaps.filter((g) => g.status === "have").length,
      partial: gaps.filter((g) => g.status === "partial").length,
      none: gaps.filter((g) => g.status === "none").length,
      top: rows.slice(0, 5).map((x) => ({ title: x.title, status: STATUS[x.status] ?? "", why: x.evidence })),
    },
    plan: {
      weekly: plan.weekly,
      months: plan.months,
      note: plan.over ? overText(plan) : "",
      rows: plan.rows.map((x) => ({ title: x.title, range: `${rangeLabel(s.startYm, x)}${x.examMonth !== null ? ` · 시험 대략 ${monthLabel(s.startYm, x.examMonth)}` : ""}` })),
    },
    evidence: cards.map((c) => ({ title: c.unit ? `${c.unit}: ${c.form}` : c.form, amount: c.amount, topic: saved.topics?.[c.id] ?? "" })),
    rerun: rerun ? { label: rerun.label, months: rerun.months, n: rerun.n, before: rerun.before, after: rerun.after } : null,
  };
}

export async function buildSharedReport(p: Profile, s: Selection, report: Report, mvs: Record<string, Multiverse>): Promise<SharedReport> {
  const worlds = await Promise.all(report.worlds.filter((r) => mvs[r.worldId]).map((r) => worldOf(p, s, r, mvs[r.worldId])));
  const out: SharedReport = {
    person: { name: p.name, major: p.major },
    createdAt: new Date().toISOString(),
    worlds,
    woop: report.woop,
    forks: (report.woopForks ?? []).map((f) => ({ worldName: f.worldName, label: f.label, share: f.share })),
    week: (store.getWeekPlan() ?? []).filter((t) => t.what.trim()).map((t) => ({ when: t.when, where: t.where, what: t.what })),
  };
  return scrubShared(out, rawSnippets(p as never));
}

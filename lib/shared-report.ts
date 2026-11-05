// 상담사 공유본. 결과와 계획만 고른다. 인생 이야기 원문·근거 인용·문항별 답·경험 글은 필드 자체가 없다.
export const SHARE_DAYS = 14;
export const AI_NOTICE = "AI로 만든 리포트입니다";

export interface SharedWorld {
  id: string;
  name: string;
  months: number;
  runs: number;
  fit: number;
  gateLabel: string;
  gateShare: number;
  satisfied: number;
  stressed: number;
  good: string;
  hard: string;
  gap: { have: number; partial: number; none: number; top: { title: string; status: string; why: string[] }[] };
  plan: { weekly: number; months: number; note: string; rows: { title: string; range: string }[] };
  evidence: { title: string; amount: string; topic: string }[];
  rerun: { label: string; months: number; n: number; before: number; after: number } | null;
}
export interface SharedReport {
  person: { name: string; major: string };
  createdAt: string;
  worlds: SharedWorld[];
  woop: { wish: string; outcome: string; obstacle: string; plan: string };
  forks: { worldName: string; label: string; share: number }[];
  week: { when: string; where: string; what: string }[];
}

const str = (x: unknown, n = 200) => (typeof x === "string" ? x.slice(0, n) : "");
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const arr = (x: unknown, n: number) => (Array.isArray(x) ? (x.slice(0, n) as Record<string, unknown>[]) : []);

// 서버는 브라우저가 보낸 값을 믿지 않는다. 아래 칸만 길이를 잘라 다시 만든다(모르는 칸은 버린다).
export function cleanShared(raw: unknown): SharedReport | null {
  const r = raw as Record<string, Record<string, unknown>> | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.worlds) || !r.worlds.length) return null;
  const woop = (r.woop ?? {}) as Record<string, unknown>;
  return {
    person: { name: str(r.person?.name, 40), major: str(r.person?.major, 60) },
    createdAt: str(r.createdAt, 30),
    worlds: arr(r.worlds, 3).map((w) => {
      const gap = (w.gap ?? {}) as Record<string, unknown>;
      const plan = (w.plan ?? {}) as Record<string, unknown>;
      const rr = w.rerun as Record<string, unknown> | null;
      return {
        id: str(w.id, 40),
        name: str(w.name, 60),
        months: num(w.months),
        runs: num(w.runs),
        fit: num(w.fit),
        gateLabel: str(w.gateLabel, 60),
        gateShare: num(w.gateShare),
        satisfied: num(w.satisfied),
        stressed: num(w.stressed),
        good: str(w.good),
        hard: str(w.hard),
        gap: {
          have: num(gap.have),
          partial: num(gap.partial),
          none: num(gap.none),
          top: arr(gap.top, 5).map((t) => ({ title: str(t.title, 80), status: str(t.status, 10), why: arr(t.why, 5).map((y) => str(y)) })),
        },
        plan: { weekly: num(plan.weekly), months: num(plan.months), note: str(plan.note), rows: arr(plan.rows, 30).map((x) => ({ title: str(x.title, 80), range: str(x.range, 60) })) },
        evidence: arr(w.evidence, 8).map((e) => ({ title: str(e.title, 80), amount: str(e.amount, 60), topic: str(e.topic, 80) })),
        rerun: rr ? { label: str(rr.label, 60), months: num(rr.months), n: num(rr.n), before: num(rr.before), after: num(rr.after) } : null,
      };
    }),
    woop: { wish: str(woop.wish), outcome: str(woop.outcome), obstacle: str(woop.obstacle), plan: str(woop.plan) },
    forks: arr(r.forks, 2).map((f) => ({ worldName: str(f.worldName, 30), label: str(f.label, 40), share: num(f.share) })),
    week: arr(r.week, 10).map((t) => ({ when: str(t.when, 30), where: str(t.where, 30), what: str(t.what, 60) })),
  };
}

// 이야기 원문·근거 인용이 AI 문장 등에 섞여 들어왔으면 그 칸을 지운다(같은 글자가 8자 이상 그대로 있을 때).
export function rawSnippets(p: { storyRaw?: Record<string, Record<string, string>>; story?: unknown; experiences?: string }): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "string") {
      for (const part of x.split(/[.!?\n]/)) if (part.trim().length >= 8) out.push(part.trim());
    } else if (x && typeof x === "object") Object.entries(x).forEach(([k, v]) => (k === "evidence" || typeof v === "object" ? walk(v) : undefined));
  };
  walk(p.story);
  Object.values(p.storyRaw ?? {}).forEach((ch) => Object.values(ch).forEach((v) => walk(v)));
  return out;
}

export function scrubShared(r: SharedReport, snippets: string[]): SharedReport {
  const walk = <T,>(x: T): T => {
    if (typeof x === "string") return (snippets.some((s) => x.includes(s)) ? "" : x) as T;
    if (Array.isArray(x)) return x.map(walk) as T;
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)])) as T;
    return x;
  };
  return walk(r);
}

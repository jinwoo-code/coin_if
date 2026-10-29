// 멀티버스: 같은 사람이 같은 진로를 100번 살아 보고, 갈림길마다 갈라진 세계선 나무를 만든다.
// AI가 먼저 가는 길(본선)은 갈림길마다 가장 많이 간 쪽을 따라간 세계선이다.
// 브라우저에서도 돌아간다(갈림길을 바꿔 보는 건 즉시 계산).
import { simulatePath, type Force } from "./engine";
import { factorNotes, hasCert } from "./factors";
import type { EventCard, FactorKey, Lever, LifeState, Line, LineNode, Multiverse, Path, Profile, WorldStats, WorldTemplate } from "./types";
import { durationLabel } from "./calendar";
import { euro, eulReul } from "./josa";
import { answerOf, READINESS } from "./readiness";

export const RUNS = 100;
const KEYS: (keyof LifeState)[] = ["skill", "stress", "satisfaction", "relation", "money"];
const MAX_DEPTH = 5;
const MAX_LINES = 7;

function pct(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}
function median(xs: number[]) {
  return pct(xs.toSorted((a, b) => a - b), 0.5);
}

export function seedFor(p: Profile, worldId: string, i: number) {
  return `${p.name}|${p.dilemma}|${worldId}|${i}`;
}

export function runAll(p: Profile, world: WorldTemplate, months: number, startYm: string, force?: Force, n = RUNS): Path[] {
  return Array.from({ length: n }, (_, i) => simulatePath(p, world, months, startYm, seedFor(p, world.id, i) + (force ? `|${force.eventId}` : ""), force));
}

// ---------- 갈림길 이름 ----------

function eventOf(world: WorldTemplate, id: string): EventCard | undefined {
  return world.events.find((e) => e.id === id) ?? COMMON.find((e) => e.id === id);
}
// 엔진 공통 사건 중 갈림길이 되는 것
const COMMON: EventCard[] = [{ id: "broke", title: "모아 둔 돈이 바닥났다", kind: "bad", weight: 0, branch: "choice", branchLabel: "생활비가 떨어짐", text: "", effect: {}, choices: [{ text: "알바를 늘림", tone: "push", label: "알바를 늘림" }, { text: "집에 도움 요청", tone: "safe", label: "집에 도움 요청" }] }];

export function keyLabel(world: WorldTemplate, key: string): { label: string; cause: "luck" | "choice" } {
  const [head, idx] = key.split(":");
  const [id, tier] = head.split("@");
  const e = eventOf(world, id);
  if (!e) return { label: id, cause: "luck" };
  if (idx !== undefined) {
    const c = e.choices[Number(idx)];
    return { label: c?.label ?? c?.text ?? e.title, cause: "choice" };
  }
  const base = e.branchLabel ?? e.title;
  // 규모 묶음 이름: 그 진로의 일터 이름(회사, 병원, 학원 ...)을 붙인다.
  const place = e.tiers?.find((t) => t.group === tier)?.label.replace(/^[\d~]+인\s*(이상|미만)?\s*/, "") || "회사";
  const GROUP: Record<string, string> = { big: `30인 이상 ${place}`, small: `30인 미만 ${place}` };
  return { label: tier && GROUP[tier] ? `${base}(${GROUP[tier]})` : base, cause: "luck" };
}

// ---------- 통계 ----------

function finalDist(paths: Path[]) {
  const out = {} as Line["final"];
  for (const k of KEYS) {
    const s = paths.map((p) => p.final[k]).toSorted((a, b) => a - b);
    out[k] = { p10: pct(s, 0.1), p50: pct(s, 0.5), p90: pct(s, 0.9) };
  }
  return out;
}

const share = (paths: Path[], f: (p: Path) => boolean) => (paths.length ? Math.round((paths.filter(f).length / paths.length) * 100) : 0);
const satisfied = (p: Path) => p.final.satisfaction >= 60;
const stressed = (p: Path) => p.final.stress >= 65;

function hireFactors(world: WorldTemplate): FactorKey[] {
  return Array.from(new Set(world.events.filter((e) => e.hires || (e.chance !== undefined && e.chance < 1)).flatMap((e) => e.factors ?? [])));
}

function factorKeys(p: Profile, world: WorldTemplate): FactorKey[] {
  const keys = hireFactors(world);
  return p.life.military === "미필" && p.life.enlistIn !== null ? [...keys, "military"] : keys;
}

export function gateLabel(world: WorldTemplate) {
  switch (world.archetype) {
    case "exam":
      return "합격해서 첫 근무까지";
    case "license":
      return "면허 따고 취업";
    case "grad":
      return "대학원 입학";
    case "startup":
      return "매출로 생활비 벌기";
    default:
      return "취업";
  }
}

export function statsOf(p: Profile, world: WorldTemplate, paths: Path[]): WorldStats {
  const firsts = new Map<string, number[]>();
  for (const path of paths) {
    const seen = new Set<string>();
    for (const m of path.months) {
      if (!m.event || seen.has(m.event.id)) continue;
      seen.add(m.event.id);
      const arr = firsts.get(m.event.id) ?? [];
      arr.push(m.month);
      firsts.set(m.event.id, arr);
    }
  }
  const events: WorldStats["events"] = {};
  firsts.forEach((ms, id) => (events[id] = { count: ms.length, typicalMonth: median(ms) }));
  const final = finalDist(paths);
  const medianState = Object.fromEntries(KEYS.map((k) => [k, final[k].p50])) as unknown as LifeState;
  const hired = paths.filter((x) => x.employedAt !== null);
  const sal = hired.map((x) => x.salary).toSorted((a, b) => a - b);
  return {
    runs: paths.length,
    events,
    final,
    medianState,
    satisfiedShare: share(paths, satisfied),
    stressedShare: share(paths, stressed),
    gate: { label: gateLabel(world), share: share(paths, (x) => x.employedAt !== null), typicalMonth: hired.length ? median(hired.map((x) => x.employedAt!)) : null },
    salary: { p10: pct(sal, 0.1), p50: pct(sal, 0.5), p90: pct(sal, 0.9) },
    factors: factorNotes(p, world, factorKeys(p, world)),
  };
}

// ---------- 세계선 나무 ----------

interface Raw {
  key: string;
  id: string;
  runs: number[]; // 이 마디를 지난 회차
  months: number[];
  kids: Map<string, Raw>;
}

function buildRaw(paths: Path[]): Raw {
  const root: Raw = { key: "start", id: "", runs: [], months: [], kids: new Map() };
  paths.forEach((path, i) => {
    root.runs.push(i);
    let node = root;
    path.signature.slice(0, MAX_DEPTH).forEach((key, d) => {
      let kid = node.kids.get(key);
      if (!kid) {
        kid = { key, id: node.id ? `${node.id}>${key}` : key, runs: [], months: [], kids: new Map() };
        node.kids.set(key, kid);
      }
      kid.runs.push(i);
      kid.months.push(path.sigMonths[d]);
      node = kid;
    });
  });
  return root;
}

// 드문 가지를 잘라 낸 나무와, 각 마디에서 '여기서 끝난' 회차
function prune(raw: Raw, min: number, world: WorldTemplate): { node: LineNode; ends: Map<string, number[]> } {
  const ends = new Map<string, number[]>();
  const walk = (r: Raw, cause: LineNode["cause"], label: string): LineNode => {
    const kept = [...r.kids.values()].filter((k) => k.runs.length >= min).toSorted((a, b) => b.runs.length - a.runs.length);
    const keptRuns = new Set(kept.flatMap((k) => k.runs));
    ends.set(r.id, r.runs.filter((i) => !keptRuns.has(i)));
    return {
      id: r.id,
      key: r.key,
      label,
      cause,
      count: r.runs.length,
      typicalMonth: r.months.length ? median(r.months) : 0,
      children: kept.map((k) => {
        const { label: l, cause: c } = keyLabel(world, k.key);
        return walk(k, c, l);
      }),
      other: [...r.kids.values()].filter((k) => k.runs.length < min).reduce((s, k) => s + k.runs.length, 0),
    };
  };
  return { node: walk(raw, "start", "출발"), ends };
}

function flatten(n: LineNode, trail: LineNode[] = []): { node: LineNode; trail: LineNode[] }[] {
  const here = [...trail, n];
  return [{ node: n, trail: here }, ...n.children.flatMap((c) => flatten(c, here))];
}

function lineTitle(world: WorldTemplate, trail: LineNode[], hasKids: boolean, rareMajority: boolean) {
  const steps = trail.filter((n) => n.cause !== "start");
  if (steps.length === 0) {
    if (rareMajority) return "여러 갈래로 드물게 갈라진 세계";
    const fail: Record<string, string> = { exam: "기간 안에 합격하지 못한 세계", license: "기간 안에 자리 잡지 못한 세계", grad: "기간 안에 입학하지 못한 세계", startup: "기간 안에 매출로 자리 잡지 못한 세계" };
    return fail[world.archetype] ?? `기간 안에 ${euro(world.short)} 일하지 못한 세계`;
  }
  const tail = steps.slice(-2).map((n) => n.label).join(" → ");
  if (rareMajority) return `${tail}, 그 뒤 여러 갈래`;
  return hasKids ? `${tail}, 그 뒤로는 큰 변화 없이` : tail;
}

export function buildMultiverse(p: Profile, world: WorldTemplate, months: number, startYm: string): { mv: Multiverse; paths: Path[] } {
  const paths = runAll(p, world, months, startYm);
  const raw = buildRaw(paths);
  // 세계선이 너무 많아지지 않을 때까지 '드물다'의 기준을 올린다(최소 5%).
  let min = Math.max(5, Math.round(paths.length * 0.05));
  let built = prune(raw, min, world);
  const countLines = (b: typeof built) => flatten(b.node).filter((x) => (b.ends.get(x.node.id)?.length ?? 0) >= min).length;
  while (countLines(built) > MAX_LINES && min < paths.length) {
    min += 2;
    built = prune(raw, min, world);
  }
  const { node: tree, ends } = built;

  const lines: Line[] = flatten(tree)
    .map(({ node, trail }) => ({ node, trail, runs: ends.get(node.id) ?? [] }))
    .filter((x) => x.runs.length >= min)
    .map(({ node, trail, runs }) => {
      const ps = runs.map((i) => paths[i]);
      const final = finalDist(ps);
      // 대표 회차: 만족도가 가운데에 가장 가까운 회차
      const target = final.satisfaction.p50;
      const rep = runs.reduce((best, i) => (Math.abs(paths[i].final.satisfaction - target) < Math.abs(paths[best].final.satisfaction - target) ? i : best), runs[0] ?? 0);
      const sal = ps.filter((x) => x.salary > 0).map((x) => x.salary);
      return {
        id: node.id,
        title: lineTitle(world, trail, node.children.length > 0, ps.filter((x) => x.signature.length > trail.length - 1).length > ps.length / 2),
        path: trail.map((n) => n.id),
        count: runs.length,
        isMain: false,
        repSeed: paths[rep]?.seed ?? "",
        satisfiedShare: share(ps, satisfied),
        stressedShare: share(ps, stressed),
        final,
        salary: sal.length > ps.length / 2 ? median(sal) : 0, // 절반 넘게 일하고 있을 때만 연봉을 보여 준다
      } satisfies Line;
    })
    .toSorted((a, b) => b.count - a.count);
  // 본선(AI가 먼저 가는 길): 가장 많이 간 세계선. '여러 갈래' 묶음은 본선이 될 수 없다.
  const main = lines.find((l) => !l.title.includes("여러 갈래")) ?? lines[0];
  if (main) main.isMain = true;
  lines.sort((a, b) => Number(b.isMain) - Number(a.isMain) || b.count - a.count);

  return { mv: { worldId: world.id, months, startYm, stats: statsOf(p, world, paths), tree, lines }, paths };
}

// 세계선 하나의 대표 회차를 다시 굴린다(같은 시드 → 같은 결과)
export function replayLine(p: Profile, world: WorldTemplate, months: number, startYm: string, line: Line, force?: Force): Path {
  return simulatePath(p, world, months, startYm, line.repSeed, force);
}

// ---------- 갈림길을 바꿔 보기 ----------

// 이 갈림길에서 반대로 간 100번(운은 반대 결과로, 선택은 다른 선택지로 강제)
export function explore(p: Profile, world: WorldTemplate, months: number, startYm: string, force: Force) {
  const paths = runAll(p, world, months, startYm, force);
  return { stats: statsOf(p, world, paths), paths };
}

// ---------- 바꿀 수 있는 것 Top 3 ----------

interface Tweak {
  title: string;
  apply: (p: Profile) => Profile | null; // 이미 해당하면 null
}

const withSpec = (p: Profile, s: Partial<Profile["spec"]>): Profile => ({ ...p, spec: { ...p.spec, ...s } });
const withLife = (p: Profile, l: Partial<Profile["life"]>): Profile => ({ ...p, life: { ...p.life, ...l } });

// 진로마다 '바꿔 볼 수 있는 조건'을 만든다: 준비도 질문 한 단계 올리기, 도움 되는 자격증 따기, 인턴, 공부 시간
function tweaksFor(world: WorldTemplate): Tweak[] {
  const out: Tweak[] = [];
  for (const id of world.readiness) {
    const q = READINESS[id];
    if (!q?.better) continue;
    out.push({ title: q.better, apply: (p) => (answerOf(p.readiness, id) >= q.options.length - 1 ? null : { ...p, readiness: { ...p.readiness, [id]: answerOf(p.readiness, id) + 1 } }) });
  }
  const cert = world.certs[0];
  if (cert) out.push({ title: `${eulReul(cert)} 따면`, apply: (p) => (hasCert(p, cert) ? null : withSpec(p, { certs: [...p.spec.certs, cert] })) });
  if (["open", "portfolio", "trade", "public"].includes(world.archetype)) out.push({ title: "3개월 인턴·현장실습을 하면", apply: (p) => (p.spec.internMonths > 0 ? null : withSpec(p, { internMonths: 3 })) });
  if (["open", "portfolio"].includes(world.archetype)) out.push({ title: "프로젝트·작품을 하나 더 끝내면", apply: (p) => withSpec(p, { projects: p.spec.projects + 1 }) });
  if (world.archetype === "exam" || world.archetype === "public") {
    out.push({ title: "하루 공부를 2시간 늘리면", apply: (p) => (p.life.studyHours >= 12 ? null : withLife(p, { studyHours: Math.min(12, p.life.studyHours + 2) })) });
    out.push({ title: "알바를 줄이면(주 10시간 이하)", apply: (p) => (p.life.partTimeHours <= 10 ? null : withLife(p, { partTimeHours: 10 })) });
  }
  return out;
}
const COMMON_TWEAKS: Tweak[] = [{ title: "생활비를 6개월치 더 모아 두면", apply: (p) => withLife(p, { savings: p.life.savings + p.life.livingCost * 6 }) }];

function monthsText(m: number | null) {
  return m === null ? "기간 안에 못 함" : `보통 ${durationLabel(m + 1)} 뒤`;
}

export function levers(p: Profile, world: WorldTemplate, months: number, startYm: string, base: Path[]): Lever[] {
  const baseStats = statsOf(p, world, base);
  const metric = `${durationLabel(months)} 안에 ${gateLabel(world)}`;
  const out: Lever[] = [];
  for (const t of [...tweaksFor(world), ...COMMON_TWEAKS]) {
    const q = t.apply(p);
    if (!q) continue;
    const s = statsOf(q, world, runAll(q, world, months, startYm));
    const dShare = (s.gate?.share ?? 0) - (baseStats.gate?.share ?? 0);
    const dSat = s.satisfiedShare - baseStats.satisfiedShare;
    const dTime = (baseStats.gate?.typicalMonth ?? months) - (s.gate?.typicalMonth ?? months);
    if (dShare < 0) continue; // 합격률이 떨어지는 변화는 '좋아지는 것'이 아니다
    out.push({
      kind: "input",
      title: t.title,
      metric,
      before: `${baseStats.gate?.share ?? 0}% · ${monthsText(baseStats.gate?.typicalMonth ?? null)}`,
      after: `${s.gate?.share ?? 0}% · ${monthsText(s.gate?.typicalMonth ?? null)}`,
      gain: dShare + dTime * 1.5 + dSat * 0.3,
    });
  }

  // 내 선택이 갈린 갈림길: 고른 쪽에 따라 끝이 어떻게 달랐는지
  const byEvent = new Map<string, Map<number, Path[]>>();
  for (const path of base)
    for (const key of path.choiceKeys) {
      const [id, idx] = key.split(":");
      if (idx === undefined) continue;
      const m = byEvent.get(id) ?? new Map<number, Path[]>();
      const arr = m.get(Number(idx)) ?? [];
      arr.push(path);
      m.set(Number(idx), arr);
      byEvent.set(id, m);
    }
  byEvent.forEach((groups, id) => {
    const e0 = eventOf(world, id);
    // 다른 진로로 갈아탄 경우는 이 진로 안에서 비교할 수 없어서 뺀다.
    const opts = [...groups.entries()].filter(([i, ps]) => ps.length >= 5 && e0?.choices[i]?.sets !== "switched");
    if (opts.length < 2) return;
    const scored = opts.map(([i, ps]) => ({ i, ps, sat: share(ps, satisfied) })).toSorted((a, b) => b.sat - a.sat);
    const best = scored[0];
    const worst = scored[scored.length - 1];
    const e = eventOf(world, id)!;
    const lab = (i: number) => e.choices[i]?.label ?? e.choices[i]?.text ?? "";
    out.push({
      kind: "choice",
      title: `'${e.branchLabel ?? e.title}' 갈림길에서 '${lab(best.i)}'${eulReul(lab(best.i)).slice(lab(best.i).length)} 고르면`,
      metric: "끝났을 때 만족하는 비율",
      before: `'${lab(worst.i)}' ${worst.sat}%`,
      after: `'${lab(best.i)}' ${best.sat}%`,
      gain: (best.sat - worst.sat) * 0.6,
    });
  });

  return out.filter((l) => l.gain > 0.5).toSorted((a, b) => b.gain - a.gain).slice(0, 3);
}

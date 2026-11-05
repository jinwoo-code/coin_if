// 필요한 것 목록과 내 프로필 비교(격차), 우선순위. 판정은 전부 코드 규칙이고 AI를 안 쓴다.
// 프로필에 능력단위별 답은 없어서 능력은 준비도 답으로 추정한다. 물어본 적 없는 것은 asked: false로 화면에 그대로 말한다.
import { hasCert } from "./factors";
import { answerOf, READINESS } from "./readiness";
import type { RequirementItem, Requirements } from "./requirements";
import type { Profile, WorldTemplate } from "./types";
import { W } from "./weights";

export type GapStatus = "have" | "partial" | "none";
export interface GapItem {
  item: RequirementItem;
  status: GapStatus;
  basis: string; // 왜 이렇게 봤는지
  asked: boolean; // 검사에서 실제로 물어본 근거인가
}
export interface Tweak {
  key: string; // 같은 key면 한 묶음(같은 조건을 바꾼다)
  label: string;
  apply: (p: Profile) => Profile | null; // 이미 해당하면 null
}
export interface PriorityRow extends GapItem {
  score: number;
  simDelta: number | null; // 그 조건을 바꿨을 때 목표 도달률 차이(%p). null = 엔진에 안 들어가는 항목
  simLabel: string | null;
  title: string;
  members: GapItem[]; // 묶음이면 2개 이상. 3단계 일정은 이것을 편다
  hoursLeft: number | null;
  months: number | null; // 지금 공부 시간으로 몇 개월
  evidence: string[];
}

// 능력을 재는 준비도 질문. 면허·체력·외국어 등은 능력단위 근거로 안 본다.
const SKILL_Q = ["coding", "dataTool", "sns", "office", "writing", "research", "idea", "service", "portfolio"];

const level = (p: Profile, id: string) => {
  const q = READINESS[id];
  // 답하지 않으면 엔진은 기본 보기를 쓰지만, 격차에서는 가졌다고 보지 않는다.
  if (p.readiness[id] === undefined) return { frac: 0, text: `${q.label}: 아직 답하지 않았어요`, answered: false };
  const i = answerOf(p.readiness, id);
  return { frac: i / (q.options.length - 1), text: `${q.label}: ${q.options[i].t}`, answered: true };
};
const byFrac = (f: number): GapStatus => (f >= 1 ? "have" : f > 0 ? "partial" : "none");
const qOf = (w: WorldTemplate, id: string) => w.readiness.includes(id);

const make = (item: RequirementItem, status: GapStatus, basis: string, asked = true): GapItem => ({ item, status, basis, asked });

function judgeCert(i: RequirementItem, p: Profile, w: WorldTemplate): GapItem {
  if (hasCert(p, i.name)) return make(i, "have", "입력한 자격증에 있어요");
  const text = `${i.name} ${i.detail ?? ""}`;
  const toeic = text.match(/토익\s*(\d+)/);
  if (toeic && p.spec.toeic) return make(i, p.spec.toeic >= Number(toeic[1]) ? "have" : "partial", `토익 ${p.spec.toeic}점, 기준 ${toeic[1]}점`);
  if (/한국사/.test(i.name) && p.spec.certs.some((c) => c.includes("한국사"))) return make(i, "partial", "한국사 자격이 있어요. 급수를 확인해 주세요");
  if (i.required && qOf(w, "license")) {
    const l = level(p, "license");
    return make(i, byFrac(l.frac), l.text, l.answered);
  }
  if (/교원|교사/.test(i.name) && qOf(w, "teaching")) {
    const l = level(p, "teaching");
    return make(i, byFrac(l.frac), l.text, l.answered);
  }
  if (/기능사|산업기사/.test(i.name) && qOf(w, "fieldCert") && level(p, "fieldCert").frac > 0) return make(i, "partial", `${level(p, "fieldCert").text}. 어떤 자격인지는 묻지 않았어요`);
  return make(i, "none", "입력한 자격증에 없어요");
}

function judgeExam(i: RequirementItem, p: Profile, w: WorldTemplate): GapItem {
  if (/체력/.test(i.name) && qOf(w, "fitness")) {
    const l = level(p, "fitness");
    return make(i, byFrac(l.frac), l.text, l.answered);
  }
  if (qOf(w, "license")) {
    const l = level(p, "license");
    return make(i, l.frac >= 1 ? "have" : l.frac > 0 ? "partial" : "none", l.text, l.answered);
  }
  if (/한국사/.test(i.name) && p.spec.certs.some((c) => c.includes("한국사"))) return make(i, "partial", "한국사 자격이 있어요");
  if (/영어/.test(i.name) && (p.spec.toeic ?? 0) >= 700) return make(i, "partial", `토익 ${p.spec.toeic}점`);
  return make(i, "none", "과목별 진도는 묻지 않았어요. 아직 안 한 것으로 봤어요", false);
}

function judgeSkill(i: RequirementItem, p: Profile, w: WorldTemplate): GapItem {
  const qs = w.readiness.filter((id) => SKILL_Q.includes(id));
  if (qs.length) {
    const best = qs.map((id) => level(p, id)).toSorted((a, b) => b.frac - a.frac)[0];
    return make(i, byFrac(best.frac), `능력별로 묻지 않아 준비도 답으로 추정했어요(${best.text})`, false);
  }
  if (p.spec.projects > 0) return make(i, "partial", `능력별로 묻지 않아 프로젝트·작품 ${p.spec.projects}개로 추정했어요`, false);
  return make(i, "none", "능력별로 묻지 않았어요. 아직 안 한 것으로 봤어요", false);
}

function judgeExperience(i: RequirementItem, p: Profile, w: WorldTemplate): GapItem {
  const s = p.spec;
  const n = i.name;
  const major = n.match(/(\S{2,})학과/);
  if (major) {
    if (!p.major.includes(major[1].slice(-2))) return make(i, "none", `전공(${p.major || "없음"})이 ${major[1]}학과가 아니에요`);
    return make(i, s.status === "졸업" ? "have" : "partial", `전공 ${p.major} · ${s.status}`);
  }
  if (/실습/.test(n) && qOf(w, "practice")) {
    const l = level(p, "practice");
    return make(i, byFrac(l.frac), l.text, l.answered);
  }
  if (/인턴|현장실습|실습|현장/.test(n)) return make(i, s.internMonths >= 3 ? "have" : s.internMonths > 0 ? "partial" : "none", s.internMonths ? `인턴·현장실습 ${s.internMonths}개월` : "인턴·현장실습 경험이 없다고 답했어요");
  if (/포트폴리오/.test(n) && qOf(w, "portfolio")) {
    const l = level(p, "portfolio");
    return make(i, byFrac(l.frac), l.text, l.answered);
  }
  if (/프로젝트|작품|포트폴리오/.test(n)) return make(i, s.projects >= 2 ? "have" : s.projects === 1 ? "partial" : "none", `프로젝트·작품 ${s.projects}개`);
  if (p.experiences.trim()) return make(i, "partial", "적어 준 경험에 일부 있을 수 있어요. 직접 확인해 주세요", false);
  return make(i, "none", "물어본 적 없는 항목이에요. 아직 안 한 것으로 봤어요", false);
}

export function judgeItem(i: RequirementItem, p: Profile, w: WorldTemplate): GapItem {
  if (i.kind === "cert") return judgeCert(i, p, w);
  if (i.kind === "exam") return judgeExam(i, p, w);
  if (i.kind === "skill") return judgeSkill(i, p, w);
  if (i.kind === "experience") return judgeExperience(i, p, w);
  return make(i, "none", "응시 전에 공고로 확인할 것", false);
}

// 시험형은 NCS 능력단위가 시험에 안 나와서 격차에 넣지 않는다.
export function gapItems(r: Requirements, p: Profile, w: WorldTemplate): GapItem[] {
  return r.items.filter((i) => !(w.archetype === "exam" && i.kind === "skill")).map((i) => judgeItem(i, p, w));
}

const up = (id: string, label: string): Tweak => ({
  key: `readiness:${id}`,
  label,
  apply: (p) => {
    const q = READINESS[id];
    const a = answerOf(p.readiness, id);
    return a >= q.options.length - 1 ? null : { ...p, readiness: { ...p.readiness, [id]: a + 1 } };
  },
});
const better = (id: string) => up(id, READINESS[id].better ?? `${READINESS[id].label}을 한 단계 올리면`);

// 그 항목을 갖췄다고 가정할 때 프로필에서 바뀌는 곳. 엔진이 안 보는 항목은 null(시뮬레이션 효과 없음으로 지어내지 않는다).
export function tweakOf(i: RequirementItem, w: WorldTemplate): Tweak | null {
  if (i.kind === "skill") {
    const id = w.readiness.find((x) => SKILL_Q.includes(x));
    return id ? better(id) : null;
  }
  if (i.kind === "exam") {
    if (/체력/.test(i.name)) return qOf(w, "fitness") ? better("fitness") : null;
    if (/면접|적성|실기/.test(i.name)) return null;
    if (qOf(w, "license")) return better("license");
    if (w.archetype === "exam") return { key: "study", label: "하루 공부를 2시간 늘리면", apply: (p) => (p.life.studyHours >= 12 ? null : { ...p, life: { ...p.life, studyHours: Math.min(12, p.life.studyHours + 2) } }) };
    return null;
  }
  if (i.kind === "cert") {
    if (i.required && qOf(w, "license")) return better("license");
    if (/교원|교사/.test(i.name) && qOf(w, "teaching")) return up("teaching", "교원 자격 준비를 한 단계 앞당기면");
    const cert = w.certs.find((c) => c.replace(/\s/g, "") === i.name.replace(/\s/g, ""));
    if (cert) return { key: `cert:${cert}`, label: `${cert} 취득`, apply: (p) => (hasCert(p, cert) ? null : { ...p, spec: { ...p.spec, certs: [...p.spec.certs, cert] } }) };
    if (/기능사|산업기사/.test(i.name) && qOf(w, "fieldCert")) return better("fieldCert");
    return null;
  }
  if (i.kind === "experience") {
    if (/실습/.test(i.name) && qOf(w, "practice")) return better("practice");
    if (/인턴|현장실습/.test(i.name)) return { key: "intern", label: "3개월 인턴·현장실습", apply: (p) => (p.spec.internMonths > 0 ? null : { ...p, spec: { ...p.spec, internMonths: 3 } }) };
    if (/포트폴리오/.test(i.name) && qOf(w, "portfolio")) return better("portfolio");
    if (/프로젝트|작품/.test(i.name)) return { key: "projects", label: "프로젝트·작품 하나 더", apply: (p) => ({ ...p, spec: { ...p.spec, projects: p.spec.projects + 1 } }) };
  }
  return null;
}

// 항목 종류와 흥미 유형의 짝(가정값). 검사를 안 했으면 성격으로.
function fitOf(i: RequirementItem, p: Profile): number {
  const project = /프로젝트|작품|포트폴리오/.test(i.name);
  const people = /인턴|실습|현장/.test(i.name);
  const riasec: (keyof NonNullable<Profile["interests"]>)[] = project ? ["A", "R"] : people ? ["S", "E"] : i.kind === "skill" ? ["I", "R"] : ["C"];
  const big = project || i.kind === "skill" ? p.bigFive.O : people ? p.bigFive.E : p.bigFive.C;
  const vals = [(big - 1) / 4];
  if (p.interests) vals.push((riasec.reduce((a, k) => a + p.interests![k], 0) / riasec.length - 1) / 4);
  return Math.max(0, Math.min(1, vals.reduce((a, b) => a + b, 0) / vals.length));
}

export function hoursLeftOf(g: GapItem): number | null {
  const h = g.item.hours?.value;
  if (!h) return null;
  return g.status === "partial" ? Math.round(h * W("report.partialHours")) : h;
}

// 지금 공부 시간으로 몇 개월. 알바 시간은 examPower와 같은 식으로 뺀다. 공부 시간이 0이면 null.
export function monthsOf(hours: number | null, p: Profile): number | null {
  if (!hours) return null;
  const perDay = Math.max(0, p.life.studyHours - (p.life.partTimeHours / 7) * 0.8);
  return perDay > 0 ? Math.max(1, Math.round(hours / (perDay * 30))) : null;
}

const SCORE_KEYS = ["posting", "sim", "time", "fit"] as const;
// 공고 집계가 없으면 그 칸을 빼고 남은 가중치로 다시 나눈다(키가 생기면 자동으로 들어간다). 시뮬레이션 효과·시간을 모르는 항목은 0점이다: 근거 없는 항목이 근거 있는 항목을 앞지르면 안 돼서.
export function scoreOf(parts: Partial<Record<(typeof SCORE_KEYS)[number], number | null>>): number {
  let sum = 0;
  let wsum = 0;
  for (const k of SCORE_KEYS) {
    const v = parts[k];
    if (v === null || v === undefined) continue;
    sum += W(`report.priority.${k}`) * v;
    wsum += W(`report.priority.${k}`);
  }
  return wsum ? sum / wsum : 0;
}

export function postingText(i: RequirementItem): string {
  return i.postingShare !== undefined && i.postingN ? `공고 ${i.postingN}개 중 ${Math.round(i.postingShare * i.postingN)}개가 요구` : "공고 집계 없음(기관 키 필요)";
}

// 없음·부분적만 줄 세운다. 절차(step)는 준비 시간이 아니라 뺀다. 없으면 응시·취득이 안 되는 것이 먼저, 선택(required: false, 가산·면허 뒤 과정)은 맨 뒤, 그 안에서 점수 순.
const tier = (i: RequirementItem) => (i.required === true ? 0 : i.required === false ? 2 : 1);
export function prioritize(gaps: GapItem[], w: WorldTemplate, p: Profile, deltas: Record<string, number>): PriorityRow[] {
  const todo = gaps.filter((g) => g.status !== "have" && g.item.kind !== "step");
  // 같은 조건을 바꾸는 능력·시험 과목은 한 묶음으로 센다. 프로필이 낱개를 구분하지 못해서 낱개로 줄 세우면 똑같은 근거가 반복된다.
  const groups = new Map<string, GapItem[]>();
  for (const g of todo) {
    const t = tweakOf(g.item, w);
    const key = t && (g.item.kind === "skill" || g.item.kind === "exam") && g.item.required === undefined ? `${g.item.kind}|${t.key}` : `one|${g.item.id}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const rows = [...groups.values()].map((members): PriorityRow => {
    const g = members[0];
    const t = tweakOf(g.item, w);
    const delta = t && deltas[t.key] !== undefined ? deltas[t.key] : null;
    const hours = members.map(hoursLeftOf).filter((h): h is number => h !== null);
    const hoursLeft = hours.length ? hours.reduce((a, b) => a + b, 0) : null;
    const months = monthsOf(hoursLeft, p);
    const score = scoreOf({
      posting: g.item.postingShare ?? null,
      sim: delta === null ? 0 : Math.max(0, Math.min(1, delta / W("report.priority.simFull"))),
      time: hoursLeft === null ? 0 : 1 / (1 + hoursLeft / W("report.priority.timeHalf")),
      fit: fitOf(g.item, p),
    });
    const evidence = [postingText(g.item)];
    if (delta !== null) evidence.push(`${delta > 0 ? `시뮬레이션에서 +${delta}%p` : "시뮬레이션에서 차이 없음"}${members.length > 1 ? `(${t!.label})` : ""}`);
    else evidence.push("시뮬레이션에 안 들어가는 항목");
    if (hoursLeft !== null) evidence.push(`${months ? `약 ${months}개월` : `약 ${hoursLeft}시간`}(가정값)`);
    const title = members.length > 1 ? `${g.item.kind === "skill" ? "직무 능력" : "시험 과목"} ${members.length}개` : g.item.name;
    const status: GapStatus = members.every((m) => m.status === "none") ? "none" : "partial";
    return { ...g, status, title, members, score, simDelta: delta, simLabel: t?.label ?? null, hoursLeft, months, evidence };
  });
  return rows.toSorted((a, b) => tier(a.item) - tier(b.item) || b.score - a.score || a.item.id.localeCompare(b.item.id));
}

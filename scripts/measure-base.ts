// 갈림길 기준 비율(가정값)을 잰다 → data/base-shares.json
// 비교 집단 평균 인물(data/norms.json)을 진로마다 10년 × 여러 번 살게 하고, 갈림길에 닿을 때마다
// 지금 엔진이 그 사람에게 주는 보기별 확률(normProbs)을 상황 칸(lib/base.ts bucketOf)별로 평균 낸다.
// 공개 통계·현직자 인터뷰 값(grade가 assumed가 아닌 보기)은 다시 재도 덮어쓰지 않는다.
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/measure-base.ts
import { readFileSync, writeFileSync } from "node:fs";
import norms from "../data/norms.json";
import { allBuckets, BASE, bucketOf, defaultStateKeys, groupOf, STRESS_MID, type ForkBase, type ForkCtx } from "../lib/base";
import { GLOBAL_EVENTS, normProbs, simulatePath } from "../lib/engine";
import { normalizeProfile } from "../lib/profile";
import { READINESS } from "../lib/readiness";
import type { BasePopulation, BaseShare, EventCard, LifeState, StateKey } from "../lib/types";
import { WORLDS } from "../lib/worlds";

const RUNS = 2000; // 묶음마다(유형 틀은 그 유형 진로들에 나눠서)
const MONTHS = 120;
const MIN_N = 200; // 상황 칸 표본이 이보다 적으면 그 칸의 스트레스 가운데 값으로 계산
const OUT = "data/base-shares.json";

// 공개 통계로 채운 보기(docs/선택-설계-근거.md '지금 쓸 수 있는 공개 통계 예'). 같은 갈림길의 나머지 보기는 가정값 비율로 나눈다.
const STAT: { group: string; fork: string; tone: string; share: number; ref: string; population: BasePopulation }[] = [
  {
    group: "developer",
    fork: "long-hunt",
    tone: "change",
    share: 0.323,
    ref: "한국고용정보원(2025.12), 청년 첫 일자리 및 일자리 미스매치 분석: 일 경험 없는 15~29세 남성 실업자 중 32.3%가 공무원 등 시험 준비(아시아경제 2025-12-13 보도, https://www.asiae.co.kr/en/article/2025121313120856567). 대상이 '1년 구직한 사람'과 꼭 같지는 않다.",
    population: { label: "일 경험 없는 15~29세 남성 실업자 기준", noWork: true, unchecked: ["성별", "나이"] },
  },
];

// 평균 인물: validate.ts의 평범한 지원자 조건 + 성향은 비교 집단 평균
const avgReadiness = Object.fromEntries(Object.entries(READINESS).map(([id, q]) => [id, q.options.reduce((best, o, i) => (Math.abs(o.mult - 1) < Math.abs(q.options[best].mult - 1) ? i : best), 0)]));
const person = normalizeProfile({
  name: "비교 집단 평균",
  dilemma: "기준 비율",
  values: ["안정", "돈", "성장", "여유"],
  readiness: avgReadiness,
  bigFive: norms.bigFive.mean,
  behavior: { ...norms.behavior.mean },
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: null, certs: [], toeic: null, projects: 1, workMonths: 0, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 60, livingCost: 90, military: "해당없음", enlistIn: null, region: "서울", studyHours: 8.7, partTimeHours: 0 },
});

interface Acc {
  tones: EventCard["choices"][number]["tone"][];
  keys: StateKey[];
  n: number;
  sum: number[];
  buckets: Record<string, { n: number; sum: number[] }>;
}
const acc: Record<string, Record<string, Acc>> = {};

const keysFor = (group: string, e: EventCard) => BASE[group]?.[e.id]?.stateKeys ?? e.stateKeys ?? defaultStateKeys(e);
function slot(group: string, e: EventCard): Acc {
  acc[group] ??= {};
  return (acc[group][e.id] ??= { tones: e.choices.map((c) => c.tone), keys: keysFor(group, e), n: 0, sum: e.choices.map(() => 0), buckets: {} });
}
function add(group: string, e: EventCard, c: ForkCtx) {
  if (e.choices.length < 2) return;
  const a = slot(group, e);
  const pr = normProbs(c.state, a.tones);
  const b = (a.buckets[bucketOf(a.keys, c)] ??= { n: 0, sum: a.tones.map(() => 0) });
  a.n++;
  b.n++;
  pr.forEach((x, i) => {
    a.sum[i] += x;
    b.sum[i] += x;
  });
}

// 진로 묶음마다 돌리기
const groups = new Map<string, typeof WORLDS>();
for (const w of WORLDS) groups.set(groupOf(w), [...(groups.get(groupOf(w)) ?? []), w]);
for (const [group, ws] of groups) {
  const per = Math.ceil(RUNS / ws.length);
  for (const w of ws) {
    for (const e of w.events) if (e.choices.length >= 2) slot(group, e); // 한 번도 안 나와도 자리는 만든다
    for (let i = 0; i < per; i++) simulatePath(person, w, MONTHS, "2026-11", `base:${w.id}:${i}`, undefined, (e, c) => add(GLOBAL_EVENTS.some((g) => g.id === e.id) ? "_global" : group, e, c));
  }
}
for (const e of GLOBAL_EVENTS) slot("_global", e);

// 표본이 적은 칸: 지금 엔진의 선택은 상태 중 스트레스만 보므로, 그 칸의 스트레스 가운데 값으로 계산한다.
const atStress = (stress: number, tones: Acc["tones"]) => normProbs({ skill: 50, stress, satisfaction: 50, relation: 50, money: 0 } as LifeState, tones);
// 소수 셋째 자리로 반올림하고 합이 정확히 1이 되게 마지막 보기를 맞춘다.
function round(xs: number[]) {
  const r = xs.map((x) => Math.round(x * 1000) / 1000);
  r[r.length - 1] = Math.round((1 - r.slice(0, -1).reduce((a, b) => a + b, 0)) * 1000) / 1000;
  return r;
}

const prev = JSON.parse(readFileSync(OUT, "utf8")) as Record<string, Record<string, ForkBase>>;
const out: Record<string, Record<string, ForkBase>> = {};
const rows: string[] = [];
for (const group of Object.keys(acc).toSorted()) {
  out[group] = {};
  for (const [fork, a] of Object.entries(acc[group])) {
    const old = prev[group]?.[fork];
    if (old && old.choices.some((c) => c.grade !== "assumed")) {
      out[group][fork] = old; // 통계·인터뷰 값은 그대로
      continue;
    }
    const share = a.n >= MIN_N ? round(a.sum.map((s) => s / a.n)) : round(atStress(50, a.tones));
    const byShare: Record<string, number[]> = {};
    for (const b of allBuckets(a.keys)) {
      const got = a.buckets[b];
      byShare[b] = got && got.n >= MIN_N ? round(got.sum.map((s) => s / got.n)) : round(atStress(STRESS_MID[b.split("|")[0].split(":")[1]], a.tones));
    }
    const note = a.n >= MIN_N ? `가정값: 비교 집단 평균 인물이 지금 엔진에서 고르는 비율(${a.n}번 측정)` : "가정값: 측정 표본 부족, 스트레스 50 기준 엔진 비율";
    const choices: BaseShare[] = a.tones.map((_, i) => ({ share: share[i], grade: "assumed", ref: note, byState: Object.fromEntries(Object.entries(byShare).map(([b, xs]) => [b, xs[i]])) }));
    // 공개 통계: 그 보기만 통계 값, 나머지는 가정값 비율로 나눈다. 통계는 상황을 가리지 않으므로 칸별 비율은 두지 않는다.
    const st = STAT.find((s) => s.group === group && s.fork === fork);
    if (st) {
      const k = a.tones.indexOf(st.tone as Acc["tones"][number]);
      const rest = share.reduce((s, x, i) => (i === k ? s : s + x), 0);
      const split = round(share.map((x, i) => (i === k ? st.share : (x / rest) * (1 - st.share))));
      // 통계 보기를 마지막으로 맞추지 않도록 다시 계산
      const fixed = split.map((x, i) => (i === k ? st.share : x));
      const others = fixed.filter((_, i) => i !== k);
      others[others.length - 1] = Math.round((1 - st.share - others.slice(0, -1).reduce((p, q) => p + q, 0)) * 1000) / 1000;
      let j = 0;
      choices.forEach((c, i) => {
        if (i === k) Object.assign(c, { share: st.share, grade: "stat", ref: st.ref, population: st.population, byState: undefined });
        else Object.assign(c, { share: others[j++], ref: "가정값: 통계로 정한 보기를 뺀 나머지를 엔진 비율대로 나눔", byState: undefined });
      });
    }
    out[group][fork] = { stateKeys: a.keys, choices };
    rows.push(`${group.padEnd(14)} ${fork.padEnd(18)} n=${String(a.n).padStart(6)} [${a.tones.join("/")}] ${choices.map((c) => c.share.toFixed(3)).join(" / ")}${st ? "  (통계)" : ""}`);
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(rows.join("\n"));
console.log(`\n${OUT}: 묶음 ${Object.keys(out).length}개, 갈림길 ${Object.values(out).reduce((s, g) => s + Object.keys(g).length, 0)}개`);

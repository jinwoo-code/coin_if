// 갈림길 기준 비율을 결과 통계(data/calibration-targets.json)에 맞춘다. 엔진은 안 바꾸고 data/base-shares.json의 비율만 바꾼다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-base.ts [--runs 300] [--part tenure|nurse|all] [--apply]
//   --apply가 없으면 찾은 값만 보여 준다. 있으면 base-shares.json에 grade "calibrated"로 쓴다.
// 보정하는 것(팀장 결정 2026-11-08):
//   ① common.firstJobTenure 18.4개월: 일반 직장 진로(유형 open·portfolio·trade·license, 상세판 개발자·마케터. 공공기관·데이터 분석가는 공채형이라 1~2단계처럼 참고)의
//      '번아웃'(그만둠 보기)과 '다른 회사 연락'(옮김 보기). 묶음마다 끝나는 보기의 오즈에 같은 배수 k를 곱한다(상황 칸 모양은 그대로).
//      묶음 목표는 그 묶음 진로들의 첫 직장 근속(그만둔 회차)을 모두 모은 평균. 간호사는 ③이 따로 있어 license 묶음 평균에서 뺀다.
//   ③ nurse.firstYearResign 52.8%·nurse.leaveField 12.1%: 간호사 '신규 1년 고민'(license/nurse-first-year) 세 보기.
// 보기 하나는 0.05~0.95 안. 시험형·공채형·대학원·창업은 안 건드린다.
import { readFileSync, writeFileSync } from "node:fs";
import targetsFile from "../data/calibration-targets.json";
import { BASE, groupOf, type ForkBase } from "../lib/base";
import type { BaseShare, WorldTemplate } from "../lib/types";
import { WORLDS } from "../lib/worlds";
import { AVG, measure } from "./calib-measure";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RUNS = Number(arg("--runs") ?? 300);
const MONTHS = 120;
const APPLY = process.argv.includes("--apply");
const PART = arg("--part") ?? "all";
const OUT = "data/base-shares.json";
const LO = 0.05;
const HI = 0.95;

type Target = { id: string; name: string; value: number; source: { org: string; year: number; url: string; via?: string } };
const TG = (id: string) => (targetsFile as { targets: Target[] }).targets.find((t) => t.id === id)!;
const tenureT = TG("common.firstJobTenure");
const resignT = TG("nurse.firstYearResign");
const leaveT = TG("nurse.leaveField");

// 근속 보정 묶음과 갈림길(끝나는 보기 번호)
const TENURE_GROUPS: Record<string, { fork: string; end: number[] }[]> = {
  open: [
    { fork: "burnout", end: [1] },
    { fork: "offer", end: [0] },
  ],
  portfolio: [
    { fork: "burnout", end: [1] },
    { fork: "offer", end: [0] },
  ],
  trade: [
    { fork: "burnout", end: [1] },
    { fork: "offer", end: [0] },
  ],
  license: [
    { fork: "burnout", end: [1] },
    { fork: "offer", end: [0] },
  ],
  developer: [
    { fork: "dev-burnout", end: [1] },
    { fork: "dev-offer", end: [0] },
  ],
  marketer: [
    { fork: "mkt-burnout", end: [1] },
    { fork: "mkt-offer", end: [0] },
  ],
};
const NURSE_FORK = "nurse-first-year";

const round3 = (x: number) => Math.round(x * 1000) / 1000;

// 보기 비율 xs에서 end 보기의 오즈에 k를 곱하고 0.05~0.95 안으로(합 1)
function scale(xs: number[], end: number[], k: number) {
  let p = xs.map((x, i) => (end.includes(i) ? x * k : x));
  for (let it = 0; it < 20; it++) {
    const s = p.reduce((a, b) => a + b, 0);
    p = p.map((x) => x / s);
    const clipped = p.map((x) => Math.min(HI, Math.max(LO, x)));
    if (clipped.every((x, i) => Math.abs(x - p[i]) < 1e-9)) break;
    p = clipped;
  }
  return p;
}
// 반올림 뒤 합이 정확히 1이 되게(가장 큰 보기에서 맞춤)
function tidy(p: number[]) {
  const r = p.map(round3);
  const big = r.indexOf(Math.max(...r));
  r[big] = round3(1 - r.reduce((a, b, i) => (i === big ? a : a + b), 0));
  return r;
}

// 원래 값(처음 읽은 base-shares.json)
const ORIG: Record<string, Record<string, ForkBase>> = JSON.parse(readFileSync(OUT, "utf8"));

// 메모리 안의 진로 데이터에 비율을 넣는다(파일은 --apply 때만)
function setFork(group: string, fork: string, shares: (orig: number[], bucket?: string) => number[]) {
  const fb = ORIG[group][fork];
  const share = shares(fb.choices.map((c) => c.share));
  const buckets = Object.keys(fb.choices[0].byState ?? {});
  const by = Object.fromEntries(buckets.map((b) => [b, shares(fb.choices.map((c) => c.byState?.[b] ?? c.share), b)]));
  for (const w of WORLDS.filter((x) => groupOf(x) === group)) {
    const e = w.events.find((x) => x.id === fork);
    if (!e) continue;
    e.choices.forEach((c, i) => {
      c.base = { ...(c.base as BaseShare), share: share[i], byState: buckets.length ? Object.fromEntries(buckets.map((b) => [b, by[b][i]])) : undefined };
    });
  }
  return { share, by };
}

const worldsOf = (group: string) => WORLDS.filter((w) => groupOf(w) === group && w.id !== "nurse");
function groupTenure(ws: WorldTemplate[]) {
  const all = ws.flatMap((w) => measure(AVG, w, RUNS, MONTHS).tenures);
  return all.reduce((a, b) => a + b, 0) / all.length;
}

// 결과 모음(--apply 때 파일로)
const result: Record<string, Record<string, { share: number[]; by: Record<string, number[]>; note: string }>> = {};
const lines: string[] = [];
const t0 = Date.now();

// ① 근속
for (const [group, forks] of Object.entries(PART === "nurse" ? {} : TENURE_GROUPS)) {
  const ws = worldsOf(group);
  const apply = (k: number) => forks.map((f) => ({ f, r: setFork(group, f.fork, (xs) => tidy(scale(xs, f.end, k))) }));
  apply(1);
  const before = groupTenure(ws);
  // 근속은 k가 커질수록 짧아진다. log k를 반으로 나눠 찾는다(-3 ~ 3).
  let lo = -3;
  let hi = 3;
  apply(Math.exp(hi));
  const atMax = groupTenure(ws);
  let k = Math.exp(hi);
  let got = atMax;
  if (atMax <= tenureT.value) {
    for (let it = 0; it < 9; it++) {
      const mid = (lo + hi) / 2;
      apply(Math.exp(mid));
      const t = groupTenure(ws);
      if (t > tenureT.value) lo = mid;
      else hi = mid;
    }
    k = Math.exp((lo + hi) / 2);
    apply(k);
    got = groupTenure(ws);
  }
  const done = apply(k);
  result[group] ??= {};
  for (const { f, r } of done) result[group][f.fork] = { ...r, note: `k=${k.toFixed(3)}` };
  lines.push(
    `| ${group} | ${ws.map((w) => w.short).join(", ")} | ${before.toFixed(1)} | ${got.toFixed(1)} | ${k.toFixed(2)}${atMax > tenureT.value ? " (상한: 끝나는 보기를 최대로 해도 목표보다 김)" : ""} | ${done.map(({ f, r }) => `${f.fork}: ${ORIG[group][f.fork].choices.map((c) => c.share.toFixed(3)).join("/")} → ${r.share.join("/")}`).join("<br>")} |`,
  );
  console.error(`${group} 끝 (${Math.round((Date.now() - t0) / 1000)}초)`);
}

// ③ 간호사 신규 1년: 그만두는 두 보기 합 q, 그중 간호를 떠나는 몫 f
const DO_NURSE = PART !== "tenure";
const nurse = WORLDS.find((w) => w.id === "nurse")!;
const NR = Math.max(RUNS, 1000);
const setNurse = (q: number, f: number) => setFork("license", NURSE_FORK, () => tidy([1 - q, q * (1 - f), q * f].map((x) => Math.min(HI, Math.max(LO, x)))));
let q = 0.57;
let f = 0.13;
let m = measure(AVG, nurse, NR, MONTHS);
for (let round = 0; round < (DO_NURSE ? 3 : 0); round++) {
  // q: 사직률
  let a = 0.1;
  let b = 0.9;
  for (let it = 0; it < 8; it++) {
    q = (a + b) / 2;
    setNurse(q, f);
    m = measure(AVG, nurse, NR, MONTHS);
    if (m.resign1y * 100 > resignT.value) b = q;
    else a = q;
  }
  q = (a + b) / 2;
  // f: 현장 이탈
  a = 0.02;
  b = 0.5;
  for (let it = 0; it < 8; it++) {
    f = (a + b) / 2;
    setNurse(q, f);
    m = measure(AVG, nurse, NR, MONTHS);
    if (m.leaveField * 100 > leaveT.value) b = f;
    else a = f;
  }
  f = (a + b) / 2;
}
const nr = setNurse(q, f);
if (DO_NURSE) {
  m = measure(AVG, nurse, NR, MONTHS);
  (result.license ??= {})[NURSE_FORK] = { ...nr, note: `그만둠 ${q.toFixed(3)}, 그중 떠남 ${f.toFixed(3)}` };
}
console.error(`간호사 끝 (${Math.round((Date.now() - t0) / 1000)}초)`);

console.log(`# 기준 비율 보정(평균 인물, 묶음마다 진로당 ${RUNS}번 · 간호사 ${NR}번, ${MONTHS}개월)\n`);
console.log(`## ① 첫 직장 근속(목표 ${tenureT.value}개월)\n`);
console.log("| 묶음 | 진로 | 근속 전 | 근속 후 | 끝나는 보기 오즈 배수 k | 바뀐 보기 비율(전 → 후, 전체 비율) |");
console.log("|---|---|---|---|---|---|");
for (const l of lines) console.log(l);
console.log(`\n## ③ 간호사 신규 1년(목표 사직 ${resignT.value}%, 그중 현장 이탈 ${leaveT.value}%)\n`);
console.log(`- 보기(버팀/다른 병원/간호를 떠남): ${nr.share.join(" / ")}`);
console.log(`- 결과: 1년 안 사직 ${(m.resign1y * 100).toFixed(1)}%, 그중 현장 이탈 ${(m.leaveField * 100).toFixed(1)}%, 근속 ${m.tenure.toFixed(1)}개월 (관찰 ${m.resign1yN}회차)`);

if (APPLY) {
  const out = JSON.parse(readFileSync(OUT, "utf8")) as Record<string, Record<string, ForkBase>>;
  const src = (t: Target) => `${t.source.org}(${t.source.year}) ${t.name} ${t.value}${t.id.startsWith("nurse") ? "%" : "개월"}, ${t.source.via ? `${t.source.via.split(".")[0]}, ` : ""}${t.source.url}`;
  for (const [group, forks] of Object.entries(result)) {
    for (const [fork, r] of Object.entries(forks)) {
      const isNurse = fork === NURSE_FORK;
      const ref = isNurse
        ? `${resignT.id}·${leaveT.id}: ${src(resignT)} / 사직자 중 현장 이탈 ${leaveT.value}%. 평균 인물이 이 비율로 고를 때 1년 안 사직·현장 이탈이 이 값이 되도록 맞춘 값(${r.note}).`
        : `${tenureT.id}: ${src(tenureT)}. 평균 인물의 첫 직장 근속이 이 값이 되도록 끝나는 보기 비율을 맞춘 값(${r.note}, 상황 칸 모양은 이전 가정값 그대로).`;
      const prev = out[group][fork] ?? { stateKeys: ["stress"], choices: [] };
      const buckets = Object.keys(r.by);
      out[group][fork] = {
        stateKeys: isNurse ? ["stress"] : prev.stateKeys,
        choices: r.share.map((s, i) => ({ share: s, grade: "calibrated", ref, ...(buckets.length ? { byState: Object.fromEntries(buckets.map((b) => [b, r.by[b][i]])) } : {}) })) as BaseShare[],
      };
    }
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${OUT}에 썼어요.`);
}
void BASE;

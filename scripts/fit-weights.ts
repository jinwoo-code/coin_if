// 가중치 보정: 파일럿 사용자의 채점용 상황 질문 답으로 '선택 규칙' 가중치를 추정한다.
//
// 실행
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-weights.ts <profiles.json>            # 추정만(파일 안 바꿈)
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-weights.ts <profiles.json> --apply    # 확인한 뒤 weights.json에 "fitted"로 반영
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-weights.ts --selftest 300             # 참값을 아는 가상 응답자로 되찾는지 확인
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/fit-weights.ts --selftest 30 --items 4 --reps 50   # 파일럿 규모로 50번 되풀이(얼마나 자주 잡아내나)
//   옵션: --prior 1(사전값 폭 배율, 작을수록 지금 값에 붙음), --min-n 30(반영에 필요한 최소 인원),
//         --items 6(가상 응답자 1인당 채점용 문항 수), --pilot(가상 응답자에게 파일럿 문항도 묻기)
//
// 입력: Supabase SQL Editor에서 아래 결과 칸을 복사해 data/pilot/ 아래 JSON 파일로 저장(.gitignore에 있음, 커밋 금지).
//   select json_agg(json_build_object('user_id', user_id, 'data', data)) from profiles where not demo;
//   배열의 각 원소는 { data: 프로필 } 또는 프로필 자체. demo: true면 건너뛴다.
//   **파일럿 동의(data.pilot.consentAt)가 있고 빠지지 않은(withdrawnAt 없음) 사람만 쓴다.** 앱 동의만 한 사람은 쓰지 않는다.
//
// 모델(lib/engine.ts decide와 같은 식): 보기 j를 고를 확률 ∝ exp(온도 × 그 보기 tone의 점수).
//   tone 점수 = Σ 가중치_k × 특징_k(사람, tone). 특징은 엔진을 그대로 써서 가중치 하나만 0으로 바꿨을 때 점수 차이로 뽑는다.
//   → 가중치에 대해 선형인 다항 로지스틱 회귀. 사전 분포 N(지금 값, (폭 × max(|지금 값|, 0.05))²)로 정규화(MAP), 엔진이 음수 무게를 버리므로 0 이상으로 제한.
//   95% 구간은 사후 분포의 정규 근사(라플라스, 0 아래는 자름).
//
// 쓰는 데이터와 안 쓰는 데이터
//   - 채점용 상황 질문 답(holdoutPicks: 검사의 채점용 + 파일럿 p1~p20)만 쓴다. 학습용 답은 성향 점수(behavior)를 만든 답이라 그걸로 다시 맞히면 순환이다.
//   - 검사 문항은 평소 상태(스트레스 50)로 본다. 파일럿 문항 중 '지친 상황'을 전제한 문항은 그 문항의 stress로 계산해서 상태 가중치(state.*)도 정할 수 있다
//     (stress 값 자체는 팀이 정한 가정값). 온도(decide.temperature)는 가중치 전체 크기와 구분이 안 돼서 고정한다.
//   - 엔진이 음수 무게를 버리므로 추정도 0 이상으로 제한한다. 0에 걸린 가중치는 제한 없이 추정한 값·구간도 같이 보여 준다(음수면 '방향 반대 가능').
//   - 고친 선택은 --corrections를 줄 때만 쓴다(고른 tone·그때 스트레스를 저장한 기록만). 기본으로 안 쓰는 까닭: 분신과 생각이 다를 때만 남는 기록이라, 넣으면 분신과 반대인 쪽으로 치우친다.
//     체크인 다시 답은 같은 문항 반복이라 안 쓴다.
import { readFileSync, writeFileSync } from "node:fs";
import { ruleProbs, seededRandom, toneScores } from "../lib/engine";
import { normalizeProfile } from "../lib/profile";
import { VALUE_KEYS, type StorySignals } from "../lib/story";
import { PILOT_SJT } from "../lib/pilot";
import { SJT, type Tone } from "../lib/tests";
import { CALM } from "../lib/twin";
import type { LifeState, Profile } from "../lib/types";
import { resetScales, setScale, W, WEIGHTS } from "../lib/weights";

const args = process.argv.slice(2);
const flag = (name: string, def: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const PRIOR = flag("--prior", 1);
const MIN_N = flag("--min-n", 30);
const APPLY = args.includes("--apply");
const SELFTEST = args.includes("--selftest") ? flag("--selftest", 300) : 0;
const ITEMS = flag("--items", 6);
const REPS = flag("--reps", 1);
const WITH_PILOT = args.includes("--pilot");
const WITH_CORRECTIONS = args.includes("--corrections");
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

const TONES: Tone[] = ["push", "change", "safe"];
// 상황 질문으로 정할 수 있는 가중치: 가치관이 미는 쪽, 성격·성향, 이야기 값, 상태(지친 상황을 전제한 파일럿 문항이 있을 때만 정보가 생김)
const FIT = Object.keys(WEIGHTS).filter((k) => /^(value\.[^.]+\.(push|change|safe)|trait\.|story\.(decisionStyle|familyStable|regret)|state\.)/.test(k));
const W0 = FIT.map((k) => WEIGHTS[k].value as number);
const SD = W0.map((w) => PRIOR * Math.max(Math.abs(w), 0.05));
const K = FIT.length;

interface Feat {
  x: number[][]; // [가중치][tone] 단위 특징
  off: number[]; // [tone] 보정 안 하는 가중치에서 오는 점수
}
interface Obs extends Feat {
  tones: Tone[];
  pick: number;
}
type Person = Obs[];

// 채점에 쓰는 문항: 검사의 상황 질문(평소 상태) + 파일럿 문항(문항마다 상태)
const ITEMS_ALL = [...SJT.map((q) => ({ id: q.id, tones: q.options.map((o) => o.tone), stress: 50 })), ...PILOT_SJT.map((q) => ({ id: q.id, tones: q.options.map((o) => o.tone), stress: q.stress ?? 50 }))];
const stateOf = (stress: number): LifeState => ({ ...CALM, stress });

// 특징: 지금 점수에서 가중치 k만 0으로 바꾼 점수를 빼고 지금 값으로 나눈다(점수가 가중치마다 따로 더해지는 꼴이라 정확하다)
function features(p: Profile, state: LifeState): Feat {
  resetScales();
  const base = toneScores(p, state, TONES);
  const x = FIT.map((k, i) => {
    setScale(k, 0);
    const s0 = toneScores(p, state, TONES);
    setScale(k, 1);
    return base.map((b, t) => (b - s0[t]) / W0[i]);
  });
  resetScales();
  const off = base.map((b, t) => b - x.reduce((s, xk, i) => s + W0[i] * xk[t], 0));
  return { x, off };
}

function toPerson(p: Profile): Person | null {
  const cache = new Map<number, Feat>();
  const featOf = (stress: number) => {
    if (!cache.has(stress)) cache.set(stress, features(p, stateOf(stress)));
    return cache.get(stress)!;
  };
  const obs: Obs[] = ITEMS_ALL.filter((q) => p.holdoutPicks[q.id] !== undefined && q.tones[p.holdoutPicks[q.id]] !== undefined).map((q) => ({ ...featOf(q.stress), tones: q.tones, pick: p.holdoutPicks[q.id] }));
  if (WITH_CORRECTIONS) {
    for (const c of p.corrections) {
      if (c.source !== "sim" || c.stress === undefined || !c.tones || !c.tones.includes(c.to)) continue;
      obs.push({ ...featOf(c.stress), tones: c.tones, pick: c.tones.indexOf(c.to) });
    }
  }
  return obs.length ? obs : null;
}

// ---------- 정규화 다항 로지스틱(MAP) ----------
const T = W("decide.temperature");

function evaluate(people: Person[], w: number[]) {
  let f = 0;
  const g = new Array(K).fill(0);
  const H = Array.from({ length: K }, () => new Array(K).fill(0)); // 음의 헤세 행렬(양의 정부호)
  for (const o of people.flat()) {
    {
      const s = TONES.map((_, t) => T * (o.off[t] + w.reduce((a, wk, k) => a + wk * o.x[k][t], 0)));
      const ti = o.tones.map((tn) => TONES.indexOf(tn));
      const u = ti.map((t) => s[t]);
      const m = Math.max(...u);
      const e = u.map((v) => Math.exp(v - m));
      const z = e.reduce((a, b) => a + b, 0);
      const pr = e.map((v) => v / z);
      f += u[o.pick] - m - Math.log(z);
      // 보기별 특징(온도 포함)
      const feat = ti.map((t) => FIT.map((_, k) => T * o.x[k][t]));
      const mean = FIT.map((_, k) => feat.reduce((a, fj, j) => a + pr[j] * fj[k], 0));
      for (let k = 0; k < K; k++) {
        g[k] += feat[o.pick][k] - mean[k];
        for (let l = 0; l < K; l++) H[k][l] += feat.reduce((a, fj, j) => a + pr[j] * (fj[k] - mean[k]) * (fj[l] - mean[l]), 0);
      }
    }
  }
  for (let k = 0; k < K; k++) {
    f -= (w[k] - W0[k]) ** 2 / (2 * SD[k] ** 2);
    g[k] -= (w[k] - W0[k]) / SD[k] ** 2;
    H[k][k] += 1 / SD[k] ** 2;
  }
  return { f, g, H };
}

function solve(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const q = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= q * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function fit(people: Person[], bounded = true) {
  let w = [...W0];
  let cur = evaluate(people, w);
  for (let it = 0; it < 100; it++) {
    const step = solve(cur.H, cur.g); // 뉴턴 방향
    let a = 1;
    let next = w;
    let ev = cur;
    for (; a > 1e-4; a /= 2) {
      next = w.map((wk, k) => (bounded ? Math.max(0, wk + a * step[k]) : wk + a * step[k])); // 엔진은 음수 무게를 버리므로 0 이상
      ev = evaluate(people, next);
      if (ev.f >= cur.f - 1e-12) break;
    }
    const moved = Math.max(...next.map((v, k) => Math.abs(v - w[k])));
    w = next;
    cur = ev;
    if (moved < 1e-7) break;
  }
  const se = FIT.map((_, k) =>
    Math.sqrt(
      solve(
        cur.H,
        FIT.map((__, j) => (j === k ? 1 : 0)),
      )[k],
    ),
  );
  return { w, se, logPost: cur.f };
}

// 사용 인원: 그 값이 실제로 점수에 들어간 사람. 특징이 0이 아닌 사람만 센다
// (이야기 값이 없거나 '후회 없음'처럼 해당 없는 사람, 성향이 기준(3) 이하라 엔진이 무게를 안 주는 사람, 평소 상태 문항만 답한 사람의 상태 가중치는 빠진다)
const usedBy = (people: Person[]) => FIT.map((_, k) => people.filter((ps) => ps.some((o) => o.x[k].some((v) => Math.abs(v) > 1e-12))).length);

function logLoss(people: Person[], w: number[]) {
  let s = 0;
  let n = 0;
  let hits = 0;
  for (const o of people.flat()) {
    const sc = TONES.map((_, t) => T * (o.off[t] + w.reduce((a, wk, k) => a + wk * o.x[k][t], 0)));
    {
      const u = o.tones.map((tn) => sc[TONES.indexOf(tn)]);
      const m = Math.max(...u);
      const z = u.reduce((a, v) => a + Math.exp(v - m), 0);
      s -= u[o.pick] - m - Math.log(z);
      if (u[o.pick] >= m - 1e-9) hits++;
      n++;
    }
  }
  return { loss: s / n, hit: hits / n, n };
}

// ---------- 입력 ----------
function load(path: string): Profile[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const rows = (Array.isArray(raw) ? raw : ((raw as { profiles?: unknown[] }).profiles ?? [])) as Record<string, unknown>[];
  return rows
    .filter((r) => r && !r.demo && !(r.data as Record<string, unknown> | undefined)?.demo)
    .map((r) => (r.data ?? r) as Partial<Profile>)
    .filter((d) => d && typeof d === "object" && d.holdoutPicks && d.pilot?.consentAt && !d.pilot.withdrawnAt) // 파일럿 동의자만
    .map((d, i) => normalizeProfile({ ...d, name: d.name ?? `사용자${i}` } as Partial<Profile> & Pick<Profile, "name">));
}

// 참값을 아는 가상 응답자: 일부 가중치를 일부러 바꾼 '진짜 규칙'으로 채점용 문항에 답하게 한다
const TRUE_SCALE: Record<string, number> = { "value.안정.safe": 2, "trait.risk.change": 0, "story.decisionStyle": 2, "trait.N.safe": 1.5 };
function synthetic(n: number, seed = 0): Profile[] {
  const rnd = seededRandom(`fit-weights selftest ${seed}`);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const lik = () => 1 + Math.round(rnd() * 8) / 2;
  const ev = "가상 응답자";
  const out: Profile[] = [];
  for (let i = 0; i < n; i++) {
    const values = [...VALUE_KEYS].sort(() => rnd() - 0.5).slice(0, 4);
    const story: StorySignals | null =
      rnd() < 0.6
        ? {
            decisionStyle: rnd() < 0.7 ? { value: pick(["impulsive", "deliberate", "follow"] as const), evidence: ev, confidence: 0.8 } : null,
            persistence: null,
            familyExpectation: rnd() < 0.5 ? { value: "stable", strength: pick([1, 2, 3, 4, 5] as const), evidence: ev } : null,
            regretType: rnd() < 0.6 ? { value: pick(["inaction", "action", "none"] as const), evidence: ev } : null,
            coreValues: [],
            runwayMonths: null,
          }
        : null;
    const p = normalizeProfile({ name: `가상${seed}-${i}`, values, bigFive: { O: lik(), C: lik(), E: lik(), A: lik(), N: lik() }, behavior: { persistence: lik(), risk: lik(), coping: lik(), social: lik() }, story });
    // 채점용 ITEMS개(s7~s18 중) + (--pilot이면) 파일럿 문항 전부, 진짜 규칙으로 고른다
    for (const [k, v] of Object.entries(TRUE_SCALE)) setScale(k, v);
    const pool = ITEMS_ALL.filter((q) => SJT.find((x) => x.id === q.id)?.role === "pool")
      .toSorted(() => rnd() - 0.5)
      .slice(0, ITEMS);
    const items = [...pool, ...(WITH_PILOT ? ITEMS_ALL.filter((q) => PILOT_SJT.some((x) => x.id === q.id)) : [])];
    for (const q of items) {
      const pr = ruleProbs(p, stateOf(q.stress), q.tones); // 보정 모델과 같은 규칙 확률(기준선을 섞기 전)
      let r = rnd();
      let j = 0;
      while (j < pr.length - 1 && (r -= pr[j]) > 0) j++;
      p.holdoutPicks[q.id] = j;
    }
    resetScales();
    out.push(p);
  }
  return out;
}

// 이야기 가중치의 사용 인원을 프로필에서 직접 센 수(자체 확인용)
const DIRECT: Record<string, (p: Profile) => boolean> = {
  "story.decisionStyle": (p) => !!p.story?.decisionStyle,
  "story.familyStable": (p) => p.story?.familyExpectation?.value === "stable",
  "story.regretInaction.push": (p) => p.story?.regretType?.value === "inaction",
  "story.regretInaction.change": (p) => p.story?.regretType?.value === "inaction",
  "story.regretAction.safe": (p) => p.story?.regretType?.value === "action",
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const truth = (k: string, i: number) => W0[i] * (TRUE_SCALE[k] ?? 1);

function analyse(profiles: Profile[]) {
  const people = profiles.map(toPerson).filter((x): x is Person => x !== null);
  const kept = profiles.filter((p) => toPerson(p) !== null);
  const b = fit(people);
  const u = fit(people, false); // 0 제한 없이
  const used = usedBy(people);
  const ci = (f: { w: number[]; se: number[] }, k: number, bounded: boolean): [number, number] => [r3(bounded ? Math.max(0, f.w[k] - 1.96 * f.se[k]) : f.w[k] - 1.96 * f.se[k]), r3(f.w[k] + 1.96 * f.se[k])];
  const rows = FIT.map((k, i) => {
    const [lo, hi] = ci(b, i, true);
    const atZero = b.w[i] < 1e-6;
    const [ulo, uhi] = ci(u, i, false);
    const verdict = used[i] === 0 ? "정보 없음" : W0[i] < lo || W0[i] > hi ? "구간 밖" : "구분 안 됨";
    return { k, i, w: b.w[i], lo, hi, atZero, uw: u.w[i], ulo, uhi, used: used[i], verdict, reversed: atZero && u.w[i] < 0 };
  });
  return { people, kept, rows, before: logLoss(people, W0), after: logLoss(people, b.w) };
}

// ---------- 실행 ----------
if (WITH_CORRECTIONS) console.log("고친 선택을 넣었어요. 분신과 다를 때만 남는 기록이라 결과가 분신 반대쪽으로 치우쳐요. 비교용으로만 보세요(--apply 하지 마세요).");
const label = SELFTEST ? `가상 응답자 ${SELFTEST}명, 1인당 채점용 ${ITEMS}문항${WITH_PILOT ? ` + 파일럿 ${PILOT_SJT.length}문항` : ""}(참값을 아는 자체 확인)` : `입력 ${file}`;

if (SELFTEST && REPS > 1) {
  // 같은 규모로 여러 번: 가중치마다 '구간 밖'으로 잡아낸 비율, 참값이 95% 구간에 든 비율
  const stat = FIT.map(() => ({ out: 0, cover: 0, zero: 0, used: 0 }));
  for (let r = 0; r < REPS; r++) {
    const { rows } = analyse(synthetic(SELFTEST, r));
    rows.forEach((x) => {
      const st = stat[x.i];
      if (x.verdict === "구간 밖") st.out++;
      if (truth(x.k, x.i) >= x.lo - 1e-9 && truth(x.k, x.i) <= x.hi + 1e-9) st.cover++;
      if (x.atZero) st.zero++;
      st.used += x.used / REPS;
    });
  }
  console.log(`${label}, ${REPS}번 되풀이\n`);
  console.log("| 가중치 | 지금 값 | 참값 | 평균 사용 인원 | 지금 값이 구간 밖(잡아냄) | 참값이 구간 안 | 0에 걸림 |");
  console.log("|---|---|---|---|---|---|---|");
  FIT.forEach((k, i) => {
    const st = stat[i];
    const pct = (x: number) => `${Math.round((x / REPS) * 100)}%`;
    console.log(`| \`${k}\` | ${r3(W0[i])} | ${r3(truth(k, i))}${TRUE_SCALE[k] !== undefined ? " (바꿈)" : ""} | ${st.used.toFixed(1)} | ${pct(st.out)} | ${pct(st.cover)} | ${pct(st.zero)} |`);
  });
  process.exit(0);
}

const profiles = SELFTEST ? synthetic(SELFTEST) : file ? load(file) : [];
if (!profiles.length) {
  console.error(file ? "파일럿 동의가 있고 채점용 상황 질문 답(holdoutPicks)이 있는 사람이 없어요." : "입력 파일을 주세요. 예: scripts/fit-weights.ts data/pilot/profiles.json (자세한 건 파일 맨 위 주석)");
  process.exit(1);
}
const { people, kept, rows, before, after } = analyse(profiles);

console.log(`${label}: 채점용 답이 있는 사람 ${people.length}명, 답 ${before.n}개`);
console.log(`사전값 폭 ×${PRIOR}, 온도 ${T} 고정. 반영 조건: 사용 인원 ${MIN_N}명 이상\n`);
console.log("| 가중치 | 지금 값 | 추정값(0 이상) | 95% 구간 | 제한 없이 추정 | 사용 인원 |" + (SELFTEST ? " 참값 |" : "") + " 판단 | 반영 |");
console.log("|---|---|---|---|---|---|" + (SELFTEST ? "---|" : "") + "---|---|");
for (const x of rows) {
  const free = x.atZero ? `${r3(x.uw)} (${x.ulo} ~ ${x.uhi})${x.reversed ? (x.uhi < 0 ? " **방향 반대로 보임**" : " 방향 반대 가능") : ""}` : "-";
  const t = SELFTEST ? ` ${r3(truth(x.k, x.i))} |` : "";
  const apply = x.used >= MIN_N ? "가능" : "인원 부족";
  console.log(`| \`${x.k}\` | ${r3(W0[x.i])} | ${r3(x.w)} | ${x.lo} ~ ${x.hi} | ${free} | ${x.used} |${t} ${x.verdict} | ${apply} |`);
}
const count = (v: string) => rows.filter((x) => x.verdict === v).length;
console.log(
  `\n요약: 구간 밖 ${count("구간 밖")}개, 구분 안 됨 ${count("구분 안 됨")}개, 정보 없음 ${count("정보 없음")}개, 0에 걸림 ${rows.filter((x) => x.atZero).length}개(그중 방향 반대 가능 ${rows.filter((x) => x.reversed).length}개), 반영 가능 ${rows.filter((x) => x.used >= MIN_N).length}개`,
);
console.log(`채점용 답 맞히기(같은 데이터 안에서): 로그 손실 ${before.loss.toFixed(3)} → ${after.loss.toFixed(3)}, 가장 높은 확률 보기 = 내 답 ${(before.hit * 100).toFixed(1)}% → ${(after.hit * 100).toFixed(1)}%`);
console.log("주의: 같은 데이터로 추정하고 잰 값이라 실제보다 좋아 보인다. 새 사용자로 다시 재야 한다.");
if (SELFTEST) {
  const bad = Object.entries(DIRECT).filter(([k, f]) => rows.find((x) => x.k === k)!.used !== kept.filter(f).length);
  console.log(`사용 인원 확인(이야기 값이 실제로 있는 사람을 프로필에서 직접 센 수와 비교): ${bad.length ? `다름 ${bad.map(([k]) => k).join(", ")}` : "모두 같음"}`);
}

if (APPLY) {
  if (SELFTEST) {
    console.error("\n가상 응답자 결과는 반영하지 않아요.");
    process.exit(1);
  }
  const path = "data/weights.json";
  const json = JSON.parse(readFileSync(path, "utf8")) as Record<string, Record<string, unknown>>;
  const today = new Date().toISOString().slice(0, 10);
  const applied: string[] = [];
  for (const x of rows) {
    if (x.used < MIN_N) continue;
    json[x.k] = { ...json[x.k], value: r3(x.w), magnitude: "fitted", n: x.used, ci: [x.lo, x.hi], prior: W0[x.i], fittedAt: today };
    applied.push(x.k);
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  console.log(`\n${path}에 ${applied.length}개를 "fitted"로 반영했어요: ${applied.join(", ") || "없음"}`);
  console.log("반영 뒤에는 check-all·validate·sensitivity를 다시 돌려 결과를 확인하세요.");
}

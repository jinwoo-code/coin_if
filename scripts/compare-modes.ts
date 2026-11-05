// 모드 비교(docs/선택-설계-근거.md '검증'): 같은 사람의 채점용 상황 질문을 무엇이 더 잘 맞히나. 정답률과 브라이어 점수.
//   기준선만 / 규칙(상한 전) / 규칙(엔진 그대로) / AI 상황 칸(기본 모드처럼 스트레스 칸만) / AI 전체 상황(실시간 판단처럼 앞선 상황까지)
//   두 AI의 차이는 '상황을 얼마나 자세히 주느냐'뿐이다. 앞선 상황이 들어간 파일럿 문항 11개에서만 다르게 묻고, 나머지 문항은 같은 답을 쓴다.
//
// 실행
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/compare-modes.ts --selftest 60            # 가짜 AI로 계산이 맞는지 확인(호출 없음, 틀리면 실패)
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/compare-modes.ts --selftest 2 --real      # 가상 응답자 + 실제 AI로 흐름 확인(결과에 뜻 없음)
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/compare-modes.ts data/pilot/profiles.json --no-ai   # 규칙까지만(호출 없음)
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/compare-modes.ts data/pilot/profiles.json --cache data/pilot/compare-cache.json
//   옵션: --max-calls 300(넘으면 멈춤, 캐시가 있으면 다시 돌려 이어서), --boot 2000(부트스트랩 횟수)
//
// 입력은 fit-weights.ts와 같은 내보낸 파일(파일럿 동의자만, data/pilot/, 커밋 금지).
// 실제 사람 데이터를 무료 등급 키로 보내지 않는다(GEMINI_TIER=free면 거부). 무료 등급은 입력이 서비스 개선에 쓰일 수 있어서다.
// 한계: 보기 문장에도 상황이 조금 묻어나서 '상황 칸' AI가 전혀 모르는 건 아니다. 기준 비율은 평균 인물로 잰 가정값이다. 짧은 문장(SHORT)과 스트레스 숫자는 팀이 정했다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { bucketLabel, bucketOf } from "../lib/base";
import { choiceProbs, normProbs, ruleProbs, seededRandom, type Judge } from "../lib/engine";
import { askJudge } from "../lib/judge-ask";
import { personText } from "../lib/judge-person";
import { PILOT_SJT } from "../lib/pilot";
import { normalizeProfile } from "../lib/profile";
import { VALUE_KEYS } from "../lib/story";
import { SJT, type Tone } from "../lib/tests";
import { CALM } from "../lib/twin";
import type { LifeState, Profile } from "../lib/types";

const PROMPT_VERSION = "compare1";
const args = process.argv.slice(2);
const flag = (name: string, def: number) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : def);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const SELFTEST = flag("--selftest", 0);
const REAL = args.includes("--real");
const NO_AI = args.includes("--no-ai");
const MAX_CALLS = flag("--max-calls", 300);
const BOOT = flag("--boot", 2000);
const CACHE = opt("--cache");
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

// 앞선 상황을 뺀 문장. 기본 모드의 갈림길처럼 '무엇을 정하는지'만 말한다.
const SHORT: Record<string, string> = {
  p1: "지금 자리를 계속할지, 다른 곳으로 옮길지 정해야 한다.",
  p3: "취업 준비를 어떻게 이어 갈지 정해야 한다.",
  p5: "다니던 과정을 계속할지 정해야 한다.",
  p7: "하던 공모전을 어떻게 할지 정해야 한다.",
  p9: "회사에서 일을 더 맡을지 정해야 한다.",
  p11: "시험 준비와 일을 어떻게 나눌지 정해야 한다.",
  p13: "이 일을 어떻게 이어 갈지 정해야 한다.",
  p15: "시험 준비를 어떻게 할지 정해야 한다.",
  p17: "다음에 무엇을 할지 정해야 한다.",
  p19: "준비하던 방향을 어떻게 할지 정해야 한다.",
  p20: "계약을 어떻게 할지 정해야 한다.",
};

interface Item {
  id: string;
  text: string;
  options: string[];
  tones: Tone[];
  stress: number;
  prior: boolean; // 앞선 상황이 들어간 문항
}
const ITEMS: Item[] = [
  ...SJT.filter((q) => q.role !== "train").map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => o.text), tones: q.options.map((o) => o.tone), stress: 50, prior: false })),
  ...PILOT_SJT.map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => o.text), tones: q.options.map((o) => o.tone), stress: q.stress ?? 50, prior: q.id in SHORT })),
];
const stateOf = (stress: number): LifeState => ({ ...CALM, stress });
const stressBucket = (stress: number) => bucketOf(["stress"], { state: stateOf(stress) } as never);

type AiMode = "bucket" | "full";
const MODES = ["기준선만", "규칙(상한 전)", "규칙(엔진)", "AI 상황 칸(원래 확률)", "AI 상황 칸(엔진)", "AI 전체 상황(원래 확률)", "AI 전체 상황(엔진)"] as const;
type Mode = (typeof MODES)[number];

interface Row {
  person: number;
  prior: boolean;
  pick: number;
  size: number;
  probs: Partial<Record<Mode, number[]>>;
}

// ---------- AI ----------
const hashOf = (p: Profile) => createHash("sha256").update(personText(p)).digest("hex").slice(0, 16);
const cache: Record<string, number[]> = CACHE && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
let calls = 0;
let stopped = false;

function promptOf(p: Profile, q: Item, mode: AiMode) {
  const ids = q.options.map((_, i) => `c${i}`);
  const base = normProbs(stateOf(q.stress), q.tones);
  const situation = mode === "full" || !q.prior ? q.text : `${SHORT[q.id]}\n지금 스트레스: ${bucketLabel(stressBucket(q.stress))}`;
  return {
    ids,
    system: "너는 한 사람의 '분신'이다. 어떤 상황에서 이 사람이 각 보기를 몇 % 고를지 솔직히 말한다. 입력에 있는 사실만 근거로 쓴다.",
    prompt: [
      `[이 사람]\n${personText(p)}`,
      `[상황] ${situation}`,
      `[보기]\n${q.options.map((o, i) => `${ids[i]}: ${o}`).join("\n")}`,
      `[평균적인 사람의 비율(가정값)] ${ids.map((id, i) => `${id} ${Math.round(base[i] * 100)}%`).join(", ")}`,
      `이 사람이라면 각 보기를 몇 % 고를까? 하나만 고르지 말고 모든 보기에 확률을 줘라(합 1). JSON으로만 답해라: {"probs": {"now": {${ids.map((id) => `"${id}": 확률`).join(", ")}}}}`,
    ].join("\n\n"),
  };
}

type Asker = (p: Profile, q: Item, mode: AiMode) => Promise<number[] | null>;

async function realAsker(): Promise<Asker> {
  process.loadEnvFile(".env.local");
  const { generateJSON, hasLLM } = await import("../lib/llm");
  if (!hasLLM()) throw new Error("GEMINI_API_KEY가 없어요. --no-ai로 규칙까지만 돌릴 수 있어요.");
  return async (p, q, mode) => {
    // 앞선 상황이 없는 문항은 두 모드가 같은 프롬프트라 한 번만 묻는다
    const key = `${PROMPT_VERSION}|${hashOf(p)}|${q.id}|${q.prior ? mode : "same"}`;
    if (cache[key]) return cache[key];
    if (calls >= MAX_CALLS) {
      stopped = true;
      return null;
    }
    const { ids, system, prompt } = promptOf(p, q, mode);
    const got = await askJudge(() => generateJSON<unknown>({ tag: "compare", model: "fast", system, prompt, fallback: () => null }), ids, ["now"]);
    calls += got.calls;
    const probs = got.probs.now;
    if (!probs) return null;
    cache[key] = probs;
    if (CACHE) writeFileSync(CACHE, JSON.stringify(cache));
    return probs;
  };
}

// ---------- 자체 확인: 앞선 상황이 답을 움직이는 가상 세계. 전체 상황 AI는 진짜 확률을, 상황 칸 AI는 앞선 상황의 효과를 모른 채 말한다 ----------
const shiftOf = (q: Item) => {
  const rnd = seededRandom(`shift ${q.id}`);
  return q.tones.map(() => (q.prior ? Math.exp((rnd() - 0.5) * 3) : 1));
};
function truthProbs(p: Profile, q: Item, withHistory: boolean) {
  const w = ruleProbs(p, stateOf(q.stress), q.tones).map((x, i) => x * (withHistory ? shiftOf(q)[i] : 1));
  const t = w.reduce((a, c) => a + c, 0);
  return w.map((x) => x / t);
}
function synthetic(n: number): Profile[] {
  const rnd = seededRandom("compare selftest");
  const lik = () => 1 + Math.round(rnd() * 8) / 2;
  return Array.from({ length: n }, (_, i) => {
    const values = [...VALUE_KEYS].sort(() => rnd() - 0.5).slice(0, 4);
    const p = normalizeProfile({ name: `가상${i}`, values, depthMode: "standard", bigFive: { O: lik(), C: lik(), E: lik(), A: lik(), N: lik() }, behavior: { persistence: lik(), risk: lik(), coping: lik(), social: lik() } } as never);
    for (const q of ITEMS) {
      const pr = truthProbs(p, q, true);
      let r = rnd();
      let j = 0;
      while (j < pr.length - 1 && (r -= pr[j]) > 0) j++;
      p.holdoutPicks[q.id] = j;
    }
    return p;
  });
}
const fakeAsker: Asker = async (p, q, mode) => truthProbs(p, q, mode === "full");

// ---------- 입력 ----------
function load(path: string): Profile[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const rows = (Array.isArray(raw) ? raw : ((raw as { profiles?: unknown[] }).profiles ?? [])) as Record<string, unknown>[];
  return rows
    .filter((r) => r && !r.demo && !(r.data as Record<string, unknown> | undefined)?.demo)
    .map((r) => (r.data ?? r) as Partial<Profile>)
    .filter((d) => d && typeof d === "object" && d.holdoutPicks && d.pilot?.consentAt && !d.pilot.withdrawnAt) // 파일럿 동의자만
    .map((d, i) => normalizeProfile({ ...d, storyRaw: {}, name: `사용자${i}` } as Partial<Profile> & Pick<Profile, "name">));
}

// ---------- 지표(lib/twin.ts와 같은 뜻: 내 답이 최고 확률과 같으면 맞힘) ----------
const brierOf = (ps: number[], pick: number) => ps.reduce((s, q, i) => s + (q - (i === pick ? 1 : 0)) ** 2, 0);
const hitOf = (ps: number[], pick: number) => (ps[pick] >= Math.max(...ps) - 1e-9 ? 1 : 0);
const mean = (xs: number[]) => xs.reduce((a, c) => a + c, 0) / (xs.length || 1);

function score(rows: Row[], mode: Mode) {
  const use = rows.filter((r) => r.probs[mode]);
  return { n: use.length, hit: mean(use.map((r) => hitOf(r.probs[mode]!, r.pick))), brier: mean(use.map((r) => brierOf(r.probs[mode]!, r.pick))) };
}

// 사람 단위로 다시 뽑아 브라이어 차이(a − b)의 95% 구간을 낸다. 한 사람의 답끼리는 독립이 아니어서다. 음수면 a가 더 잘 맞힘.
function pairedDiff(rows: Row[], a: Mode, b: Mode) {
  const use = rows.filter((r) => r.probs[a] && r.probs[b]);
  const byPerson = new Map<number, number[]>();
  for (const r of use) byPerson.set(r.person, [...(byPerson.get(r.person) ?? []), brierOf(r.probs[a]!, r.pick) - brierOf(r.probs[b]!, r.pick)]);
  const groups = [...byPerson.values()];
  if (!groups.length) return null;
  const rnd = seededRandom(`boot ${a} ${b}`);
  const stats: number[] = [];
  for (let k = 0; k < BOOT; k++) {
    const pool: number[] = [];
    for (let i = 0; i < groups.length; i++) pool.push(...groups[Math.floor(rnd() * groups.length)]);
    stats.push(mean(pool));
  }
  stats.sort((x, y) => x - y);
  return { d: mean(groups.flat()), lo: stats[Math.floor(BOOT * 0.025)], hi: stats[Math.floor(BOOT * 0.975)], people: groups.length, n: use.length };
}

const f3 = (x: number) => x.toFixed(3);
const pc = (x: number) => `${Math.round(x * 100)}%`;
function table(title: string, rows: Row[]) {
  if (!rows.length) return console.log(`\n[${title}] 답이 없어요.`);
  const chanceHit = mean(rows.map((r) => 1 / r.size));
  const chanceBrier = mean(rows.map((r) => 1 - 1 / r.size));
  console.log(`\n[${title}] 답 ${rows.length}개, 찍기 정답률 ${pc(chanceHit)}·브라이어 ${f3(chanceBrier)}`);
  console.log("모드 | 답 수 | 정답률 | 브라이어(낮을수록 좋음)");
  for (const m of MODES) {
    const s = score(rows, m);
    if (s.n) console.log(`${m} | ${s.n} | ${pc(s.hit)} | ${f3(s.brier)}`);
  }
  for (const [a, b] of [
    ["규칙(엔진)", "기준선만"],
    ["AI 상황 칸(엔진)", "규칙(엔진)"],
    ["AI 전체 상황(엔진)", "AI 상황 칸(엔진)"],
  ] as [Mode, Mode][]) {
    const d = pairedDiff(rows, a, b);
    if (!d) continue;
    const verdict = d.hi < 0 ? `${a}이 더 잘 맞힘` : d.lo > 0 ? `${b}이 더 잘 맞힘` : "구분 안 됨";
    console.log(`${a} − ${b}: 브라이어 차이 ${f3(d.d)} (95% ${f3(d.lo)}~${f3(d.hi)}, ${d.people}명 ${d.n}답) → ${verdict}`);
  }
}

// ---------- 실행 ----------
async function main() {
  const selftest = SELFTEST > 0;
  if (!selftest && !file) throw new Error("입력 파일이나 --selftest N이 필요해요.");
  const people = selftest ? synthetic(SELFTEST) : load(file!);
  if (!people.length) throw new Error("파일럿 동의자가 없어요.");
  let asker: Asker | null = null;
  if (selftest && !REAL) asker = fakeAsker;
  else if (!NO_AI) {
    if (!selftest && process.env.GEMINI_TIER !== "paid" && readEnvTier() === "free") throw new Error("실제 사람 데이터는 무료 등급 키로 보내지 않아요. 유료 키로 바꾸거나 --no-ai로 돌리세요.");
    asker = await realAsker();
    const planned = people.reduce((s, p) => s + ITEMS.reduce((t, q) => t + (p.holdoutPicks[q.id] === undefined || !q.options[p.holdoutPicks[q.id]] ? 0 : q.prior ? 2 : 1), 0), 0);
    console.log(`AI 호출 최대 ${planned}번(재요청 빼고, 캐시에 있으면 안 부름). 이번 실행 상한 ${MAX_CALLS}번.`);
  }

  const rows: Row[] = [];
  let failed = 0;
  for (const [person, p] of people.entries()) {
    for (const q of ITEMS) {
      const pick = p.holdoutPicks[q.id];
      if (pick === undefined || !q.options[pick]) continue;
      const state = stateOf(q.stress);
      const row: Row = { person, prior: q.prior, pick, size: q.options.length, probs: { 기준선만: normProbs(state, q.tones), "규칙(상한 전)": ruleProbs(p, state, q.tones), "규칙(엔진)": choiceProbs(p, state, q.tones) } };
      if (asker) {
        const bucket = await asker(p, q, "bucket");
        const full = q.prior ? await asker(p, q, "full") : bucket;
        const engine = (probs: number[]) => choiceProbs(p, state, q.tones, undefined, { probs } as Judge);
        // 둘 다 있어야 넣는다(같은 답끼리 비교)
        if (bucket && full) {
          row.probs["AI 상황 칸(원래 확률)"] = bucket;
          row.probs["AI 상황 칸(엔진)"] = engine(bucket);
          row.probs["AI 전체 상황(원래 확률)"] = full;
          row.probs["AI 전체 상황(엔진)"] = engine(full);
        } else failed++;
      }
      rows.push(row);
    }
  }

  console.log(selftest ? `\n가상 응답자 ${people.length}명${REAL ? " + 실제 AI(흐름 확인용, 결과에 뜻 없음)" : " + 가짜 AI(계산 확인용, 실제 성능 아님)"}` : `\n파일럿 동의자 ${people.length}명`);
  if (asker) console.log(`AI 호출 ${calls}번, 답을 못 받은 문항 ${failed}개${stopped ? " (상한에 걸려 멈춤, --cache로 이어서)" : ""}`);
  table(
    "앞선 상황 문항",
    rows.filter((r) => r.prior),
  );
  table(
    "평소 문항",
    rows.filter((r) => !r.prior),
  );
  table("전체", rows);
  if (!selftest && people.length < 30) console.log(`\n${people.length}명이라 구간이 넓어요. 모드를 고르는 근거로 쓰기 어려워요.`);

  if (selftest && !REAL) {
    const prior = rows.filter((r) => r.prior);
    const calm = rows.filter((r) => !r.prior);
    const d = pairedDiff(prior, "AI 전체 상황(원래 확률)", "AI 상황 칸(원래 확률)")!;
    const same = pairedDiff(calm, "AI 전체 상황(엔진)", "AI 상황 칸(엔진)")!;
    const checks: [string, boolean][] = [
      ["앞선 상황 문항에서 전체 상황이 상황 칸보다 잘 맞힘", d.hi < 0],
      ["평소 문항에서 두 AI 차이 0", Math.abs(same.d) < 1e-12],
      ["진짜 확률이 기준선보다 잘 맞힘", score(rows, "AI 전체 상황(원래 확률)").brier < score(rows, "기준선만").brier],
    ];
    for (const [t, ok] of checks) console.log(`${ok ? "통과" : "실패"}: ${t}`);
    if (checks.some(([, ok]) => !ok)) process.exit(1);
  }
}

function readEnvTier() {
  try {
    return /^GEMINI_TIER=(\w+)/m.exec(readFileSync(".env.local", "utf8"))?.[1];
  } catch {
    return undefined;
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});

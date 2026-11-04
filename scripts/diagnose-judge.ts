// 진단: 대표 인물 5명 × 큰 갈림길 8곳에서 AI 원래 확률(r·상한 적용 전), 최종 확률(빠르게·정밀), 규칙 기울기 결과를 나란히 → docs/선택-AI-규칙-진단.md
// 개발 서버의 /api/judge를 부른다(호출 40번). 먼저 npm run dev.
// 무료 키처럼 분당 한도가 있으면 DIAG_PACE_MS=6000으로 천천히, DIAG_CACHE=파일로 받은 답을 모아 이어서 돌린다.
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/diagnose-judge.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { allBuckets, baseShare, stressOf } from "../lib/base";
import { choiceProbs, normProbs, REFLECT, ruleProbs, TILT_MAX, TILT_MIN } from "../lib/engine";
import { JUDGE_PROMPT_VERSION, judgeForks, type JudgeEntry } from "../lib/judge";
import { scrubStory } from "../lib/story";
import type { LifeState, Profile } from "../lib/types";
import { W } from "../lib/weights";
import { getWorld } from "../lib/worlds";
import { PERSONAS } from "./personas";

const URL = process.env.BASE_URL ?? "http://localhost:3000";
const DEPTHS = ["quick", "deep"] as const;
const worlds = ["developer", "civil-servant"].map(getWorld);
const forks = worlds.flatMap((w) => judgeForks(w).map((fork) => ({ w, fork })));

// 상황 칸은 '보통 스트레스'의 첫 칸으로 고정한다(AI는 칸끼리 거의 같은 확률을 준다).
const bucketOf = (keys: string[]) => allBuckets(keys as never).find((b) => b.includes("stress:mid"))!;

const pct = (x: number) => Math.round(x * 100);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0);
const f1 = (x: number) => x.toFixed(1);

interface Row {
  person: string;
  fork: string;
  choice: string;
  base: number;
  raw: number | null;
  ai: Record<string, number>;
  rule: Record<string, number>;
  capped: boolean;
  ruleCapped: boolean;
}

const CACHE = process.env.DIAG_CACHE;
const PACE = Number(process.env.DIAG_PACE_MS ?? 0);
const cache: Record<string, { entries: Record<string, JudgeEntry>; src: string }> = CACHE && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

async function ask(p: Profile, worldId: string, forkId: string) {
  const key = `${JUDGE_PROMPT_VERSION}|${p.name}|${worldId}|${forkId}`;
  if (cache[key]) return cache[key];
  if (PACE) await new Promise((ok) => setTimeout(ok, PACE));
  const r = await fetch(`${URL}/api/judge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: scrubStory({ ...p, storyRaw: {}, judges: {} }), worldId, forkId }) });
  if (!r.ok) return null;
  const body = (await r.json()) as { entries: Record<string, JudgeEntry>; src: string };
  if (CACHE && body.src === "ai") {
    cache[key] = body;
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  return body;
}

async function main() {
  const jobs = PERSONAS.flatMap((x) => forks.map((f) => ({ x, ...f })));
  const out: Row[] = [];
  const shifts: string[] = [];
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const { x, w, fork } = jobs[next++];
      const res = await ask(x.p, w.id, fork.id);
      const b = bucketOf(fork.stateKeys ?? ["stress"]);
      const entry = res?.src === "ai" && res.entries[b]?.src === "ai" ? res.entries[b] : null;
      if (!entry) failed++;
      const state: LifeState = { skill: 50, stress: stressOf(b), satisfaction: 50, relation: 50, money: 0 };
      const tones = fork.choices.map((c) => c.tone);
      const base = fork.choices.map((c) => baseShare(c.base, b) ?? 1 / fork.choices.length);
      const at = (d: (typeof DEPTHS)[number], judge: JudgeEntry | null) => choiceProbs({ ...x.p, depthMode: d }, state, tones, base, judge);
      const ai = Object.fromEntries(DEPTHS.map((d) => [d, entry ? at(d, entry) : null]));
      const rule = Object.fromEntries(DEPTHS.map((d) => [d, at(d, null)]));
      const rp = ruleProbs(x.p, state, tones);
      const np = normProbs(state, tones);
      fork.choices.forEach((c, i) => {
        const ruleTilt = W("rule.scale") * Math.log(rp[i] / np[i]);
        const tilt = entry ? Math.log(entry.probs[i] / base[i]) : 0;
        out.push({
          person: x.id,
          fork: fork.id,
          choice: c.text,
          base: base[i],
          raw: entry ? entry.probs[i] : null,
          ai: Object.fromEntries(DEPTHS.map((d) => [d, ai[d] ? ai[d]![i] : NaN])),
          rule: Object.fromEntries(DEPTHS.map((d) => [d, rule[d][i]])),
          capped: Boolean(entry) && (tilt >= TILT_MAX || tilt <= TILT_MIN),
          ruleCapped: ruleTilt >= TILT_MAX || ruleTilt <= TILT_MIN,
        });
      });
      if (entry?.shift) shifts.push(`- ${x.id} / ${fork.id}: ${entry.shift}`);
    }
  }
  await Promise.all(Array.from({ length: PACE ? 1 : 8 }, worker));
  const order = new Map(PERSONAS.map((x, i) => [x.id, i]));
  out.sort((a, b) => order.get(a.person)! - order.get(b.person)! || a.fork.localeCompare(b.fork));

  const ok = out.filter((r) => r.raw !== null);
  const move = (rows: Row[], f: (r: Row) => number) => mean(rows.map((r) => Math.abs(f(r) - r.base) * 100));
  const summary = (rows: Row[]) =>
    `${f1(move(rows, (r) => r.raw!))} | ${f1(move(rows, (r) => r.ai.quick))} | ${f1(move(rows, (r) => r.ai.deep))} | ${f1(move(rows, (r) => r.rule.quick))} | ${f1(move(rows, (r) => r.rule.deep))} | ${Math.round(mean(rows.map((r) => (r.capped ? 100 : 0))))}% | ${Math.round(mean(rows.map((r) => (r.ruleCapped ? 100 : 0))))}%`;
  const head = "AI 원래 | AI 최종 빠르게 | AI 최종 정밀 | 규칙 빠르게 | 규칙 정밀 | AI가 상한에 걸린 비율 | 규칙이 상한에 걸린 비율";
  const groups = (key: (r: Row) => string) => [...new Set(ok.map(key))].map((k) => `| ${k} | ${summary(ok.filter((r) => key(r) === k))} |`);
  const off = (x: number, base: number) => x - base;
  const both = ok.filter((r) => Math.abs(off(r.raw!, r.base)) > 0.02 && Math.abs(off(r.rule.deep, r.base)) > 0.02);
  const same = (r: Row) => Math.sign(off(r.raw!, r.base)) === Math.sign(off(r.rule.deep, r.base));
  const agree = Math.round((both.filter(same).length / both.length) * 100);
  const md = [
    `# AI와 규칙의 움직임 비교`,
    ``,
    `\`scripts/diagnose-judge.ts\`로 만든 표예요. 프롬프트 버전 ${JUDGE_PROMPT_VERSION}, 인물은 민감도 분석의 대표 5명, 갈림길은 개발자·공무원의 큰 갈림길 ${forks.length}곳, 상황은 '보통 스트레스' 칸 하나. AI를 인물·갈림길마다 한 번씩만 불렀어요(같은 호출을 되풀이하면 달라질 수 있어요). 실패 ${failed}곳.`,
    ``,
    `r: 빠르게 ${REFLECT.quick}, 정밀 ${REFLECT.deep}. 상한: 오즈 0.67~1.5배.`,
    ``,
    `## 기준 비율에서 평균 몇 %p 움직였나`,
    ``,
    `| 묶음 | ${head} |`,
    `|---|---|---|---|---|---|---|---|`,
    `| 전체 | ${summary(ok)} |`,
    ...groups((r) => r.person),
    ...groups((r) => r.fork),
    ``,
    `## AI와 규칙의 방향`,
    ``,
    `기준 비율에서 2%p 넘게 움직인 보기 중, AI 원래 값과 규칙(정밀) 값이 같은 쪽인 비율: ${agree}% (${both.length}개 중 ${both.filter(same).length}개). 나머지는 정반대로 움직였어요.`,
    ``,
    `## 전체 표(%)`,
    ``,
    `| 인물 | 갈림길 | 보기 | 기준 | AI 원래 | AI 빠르게 | AI 정밀 | 규칙 빠르게 | 규칙 정밀 |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...out.map(
      (r) =>
        `| ${r.person} | ${r.fork} | ${r.choice} | ${pct(r.base)} | ${r.raw === null ? "실패" : `${pct(r.raw)}${r.capped ? "*" : ""}`} | ${r.raw === null ? "" : pct(r.ai.quick)} | ${r.raw === null ? "" : pct(r.ai.deep)} | ${pct(r.rule.quick)} | ${pct(r.rule.deep)} |`,
    ),
    ``,
    `\\* 상한에 걸림`,
    ``,
    `## AI가 쓴 shift`,
    ``,
    ...shifts.toSorted(),
    ``,
  ].join("\n");
  writeFileSync("docs/선택-AI-규칙-진단.md", md);
  console.log(md.split("## 전체 표")[0]);
}
main();

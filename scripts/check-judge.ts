// AI 분신 판단 단위 테스트: 가짜 응답으로 재요청 경로, 부정 표현 필터, 실패 표시, 화면 문구를 확인한다(AI를 안 부름).
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-judge.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { choiceProbs, ruleProbs, simulatePath, withFamilyPull } from "../lib/engine";
import { bigFiveDiff, checkinMailRef, withNewBigFive } from "../lib/ongoing";
import { CALM } from "../lib/twin";
import { askJudge, NEGATIVE } from "../lib/judge-ask";
import { failedEntries, judgeFailed, judgeFor, judgeForks, missingJudges, withJudges } from "../lib/judge";
import { DEMO_PROFILE } from "../lib/demo";
import { LIVE_RUNS, liveEntryKey, liveForkCount, liveLife, liveMultiverse, LivePause, liveRefundTokens, liveRunKey, liveSummary, type LiveEntries } from "../lib/live";
import { seedFor } from "../lib/multiverse";
import { callWithKeys, makeKeyPool, makeQueue, retryDelayMs, withRetry429 } from "../lib/llm-pace";
import { choiceLine } from "../lib/scenes";
import type { ChoiceOdds } from "../lib/types";
import { getWorld } from "../lib/worlds";

const ids = ["c0", "c1"];
const buckets = ["stress:low", "stress:mid"];
const probs = { "stress:low": { c0: 0.6, c1: 0.4 }, "stress:mid": { c0: 30, c1: 70 } };
const fake = (...answers: unknown[]) => {
  let calls = 0;
  return { ask: async () => answers[Math.min(calls++, answers.length - 1)], count: () => calls };
};

test("깨끗한 응답은 한 번만 묻고 칸마다 합 1로 맞춘다", async () => {
  const f = fake({ probs, reasons: { c0: "모은 돈이 적어서", c1: "성장을 중요하게 여겨서" }, shift: "안정 쪽으로 기운다" });
  const r = await askJudge(f.ask, ids, buckets);
  assert.equal(f.count(), 1);
  assert.deepEqual(r.probs["stress:mid"], [0.3, 0.7]);
  assert.deepEqual(r.reasons, ["모은 돈이 적어서", "성장을 중요하게 여겨서"]);
  assert.equal(r.shift, "안정 쪽으로 기운다");
});

test("부정 표현이 있으면 한 번 다시 묻고 새 이유를 쓴다", async () => {
  const f = fake({ probs, reasons: { c0: "모은 돈이 적어서", c1: "퇴사는 망설여져서" }, shift: "" }, { probs, reasons: { c0: "돈이 급해서", c1: "지쳐서 쉬고 싶어서" }, shift: "쉬는 쪽" });
  const r = await askJudge(f.ask, ids, buckets);
  assert.equal(f.count(), 2);
  assert.deepEqual(r.reasons, ["돈이 급해서", "지쳐서 쉬고 싶어서"]);
  assert.equal(r.shift, "쉬는 쪽");
});

test("두 번째에도 부정 표현이면 세 번 묻지 않고 그 이유만 비운다", async () => {
  const f = fake({ probs, reasons: { c0: "모은 돈이 적어서", c1: "도전하지 않으려고" } }, { probs, reasons: { c0: "안 할 이유가 없어서", c1: "일단 안 할래서" } });
  const r = await askJudge(f.ask, ids, buckets);
  assert.equal(f.count(), 2);
  assert.deepEqual(r.reasons, ["모은 돈이 적어서", ""]); // c0은 첫 응답의 깨끗한 이유가 남는다
});

test("확률 형식이 틀리면 다시 묻고, 길이만 틀린 이유는 다시 묻지 않는다", async () => {
  const f = fake({ probs: { "stress:low": { c0: "x", c1: 1 } }, reasons: {} }, { probs, reasons: { c0: "가".repeat(51), c1: "괜찮아서" } });
  const r = await askJudge(f.ask, ids, buckets);
  assert.equal(f.count(), 2);
  assert.ok(r.probs["stress:low"]);
  assert.deepEqual(r.reasons, ["", "괜찮아서"]);
  const g = fake({ probs, reasons: { c0: "가".repeat(51), c1: "괜찮아서" } });
  await askJudge(g.ask, ids, buckets);
  assert.equal(g.count(), 1);
});

test("모든 모델이 실패하면(null) 한 번으로 끝나고 확률이 비어 있다", async () => {
  const f = fake(null);
  const r = await askJudge(f.ask, ids, buckets);
  assert.equal(f.count(), 1);
  assert.deepEqual(r.probs, {});
});

test("필터는 망설·하지 않·안 할만 걸고 싫은 통과시킨다", () => {
  for (const t of ["퇴사는 망설여져서", "도전하지 않으려고", "지금은 안 할 것 같아서"]) assert.ok(NEGATIVE.test(t), t);
  for (const t of ["야근이 싫어서", "모은 돈이 적어서", "안정이 중요해서"]) assert.ok(!NEGATIVE.test(t), t);
});

test("실패 표시: 규칙으로 처리되고, 다음에 다시 묻고, 장면에 aiFailed가 남는다", () => {
  const w = getWorld("developer");
  const fork = judgeForks(w)[0];
  const p = withJudges(DEMO_PROFILE, w.id, fork.id, failedEntries(fork));
  const bucket = Object.keys(failedEntries(fork))[0];
  assert.equal(judgeFor(p, w.id, fork, bucket), null);
  assert.equal(judgeFailed(p, w.id, fork, bucket), true);
  assert.ok(missingJudges(p, [w]).some((x) => x.fork.id === fork.id));
  // 실패 표시가 있어도 없을 때와 같은 인생(규칙 기울기)
  const a = simulatePath(p, w, 120, "2026-11", "x:1");
  const b = simulatePath(DEMO_PROFILE, w, 120, "2026-11", "x:1");
  assert.deepEqual(a.signature, b.signature);
  // 그 갈림길을 만난 달에는 aiFailed가 남는다
  let hit = false;
  for (let i = 0; i < 300 && !hit; i++) hit = simulatePath(p, w, 120, "2026-11", `x:${i}`).months.some((m) => m.event?.id === fork.id && m.pick?.aiFailed);
  assert.ok(hit);
  // 작은 갈림길·판단 안 받은 곳은 실패가 아니다
  const small = w.events.find((e) => e.branch !== "choice" && e.choices.length >= 2)!;
  assert.equal(judgeFailed(p, w.id, small, bucket), false);
  assert.equal(judgeFailed(DEMO_PROFILE, w.id, fork, bucket), false);
});

const odds = (base: number, mine: number, extra: Partial<ChoiceOdds> = {}): ChoiceOdds => ({ base, mine, grade: "assumed", byAi: false, ...extra });
test("화면 문구: 숫자 차이로 정하고, AI 이유는 항상 붙인다", () => {
  assert.equal(choiceLine({ reason: "돈이 급해서", odds: odds(40, 44) }), "돈이 급해서 보통보다 이쪽을 더 골라요");
  assert.equal(choiceLine({ reason: "", odds: odds(40, 44) }), "보통보다 이쪽을 더 골라요");
  assert.equal(choiceLine({ reason: "돈이 급해서", odds: odds(40, 43) }), "보통 사람과 비슷하게 골랐어요");
  assert.equal(choiceLine({ reason: "돈이 급해서", odds: odds(40, 43, { byAi: true }) }), "보통 사람과 비슷하게 골랐어요 · 돈이 급해서");
  assert.equal(choiceLine({ reason: "돈이 급해서", odds: odds(40, 36, { situation: "지쳐서" }) }), "보통보다 덜 고르는 편이지만, 이번 삶에선 이쪽으로 갔어요. 지쳐서요");
  assert.equal(choiceLine({ reason: "돈이 급해서", odds: odds(40, 36, { byAi: true, situation: "지쳐서" }) }), "보통보다 덜 고르는 편이지만, 이번 삶에선 이쪽으로 갔어요 · 돈이 급해서");
});

const err429 = (detail: string) => new Error(`{"error":{"code":429,"message":"${detail}"}}`);
const recorder = () => {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
};
test("무료 키: 재시도 시간을 응답에서 읽는다", () => {
  assert.equal(retryDelayMs(err429("Please retry in 12.5s.")), 12500);
  assert.equal(retryDelayMs(err429("Please retry in 1m2s.")), 62000);
  assert.equal(retryDelayMs(new Error('{"code":429,"retryDelay":"7s"}')), 7000);
  assert.equal(retryDelayMs(err429("no time")), 60000);
});
test("무료 키: 429면 그 시간만큼 기다려 최대 3번 다시 시도한다", async () => {
  const r = recorder();
  let calls = 0;
  const ok = await withRetry429(async () => (++calls < 3 ? Promise.reject(err429("retry in 10s")) : "답"), undefined, r.sleep);
  assert.equal(ok, "답");
  assert.equal(calls, 3);
  assert.deepEqual(r.waits, [10000, 10000]);
  const r2 = recorder();
  let calls2 = 0;
  await assert.rejects(withRetry429(async () => (calls2++, Promise.reject(err429("retry in 1s"))), undefined, r2.sleep));
  assert.equal(calls2, 4); // 첫 호출 + 3번
  assert.deepEqual(r2.waits, [4500, 4500, 4500]); // 간격보다 짧게는 안 기다린다
});
test("무료 키: 하루 한도와 다른 오류는 기다리지 않는다", async () => {
  const r = recorder();
  let calls = 0;
  await assert.rejects(withRetry429(async () => (calls++, Promise.reject(err429("GenerateRequestsPerDayPerProjectPerModel-FreeTier retry in 30s"))), undefined, r.sleep));
  await assert.rejects(withRetry429(async () => (calls++, Promise.reject(new Error('{"code":500}'))), undefined, r.sleep));
  assert.equal(calls, 2);
  assert.deepEqual(r.waits, []);
});
test("무료 키: 대기열은 하나씩, 호출 사이 4.5초, 실패해도 다음이 돈다", async () => {
  const r = recorder();
  const q = makeQueue(4500, r.sleep);
  let running = 0;
  let most = 0;
  const job = (fail: boolean) => async () => {
    most = Math.max(most, ++running);
    await new Promise((res) => setTimeout(res, 5));
    running--;
    if (fail) throw new Error("실패");
    return "끝";
  };
  const out = await Promise.allSettled([q(job(false)), q(job(true)), q(job(false))]);
  assert.deepEqual(
    out.map((x) => x.status),
    ["fulfilled", "rejected", "fulfilled"],
  );
  assert.equal(most, 1);
  assert.deepEqual(r.waits, [4500, 4500]);
});

const DAILY = "GenerateRequestsPerDayPerProjectPerModel-FreeTier retry in 30s";
test("키 전환: 하루 한도면 기다리지 않고 다음 키로, 다음 호출도 그 키부터", async () => {
  const r = recorder();
  const pool = makeKeyPool(3);
  const used: number[] = [];
  const out = await callWithKeys(pool, "m", async (k) => (used.push(k), k === 0 ? Promise.reject(err429(DAILY)) : `키${k}`), undefined, r.sleep);
  assert.equal(out, "키1");
  assert.deepEqual(used, [0, 1]);
  assert.deepEqual(r.waits, []);
  assert.equal(pool.active(), 1);
  assert.equal(pool.resting(0, "m"), true);
  assert.equal(pool.resting(1, "m"), false);
  used.length = 0;
  await callWithKeys(pool, "m", async (k) => (used.push(k), "답"), undefined, r.sleep);
  assert.deepEqual(used, [1]);
});
test("키 전환: 분당 한도는 먼저 기다리고, 3번 다 안 되면 다음 키로", async () => {
  const r = recorder();
  const pool = makeKeyPool(2);
  const used: number[] = [];
  const out = await callWithKeys(pool, "m", async (k) => (used.push(k), k === 0 ? Promise.reject(err429("retry in 10s")) : "답"), undefined, r.sleep);
  assert.equal(out, "답");
  assert.deepEqual(used, [0, 0, 0, 0, 1]);
  assert.deepEqual(r.waits, [10000, 10000, 10000]);
});
test("키 전환: 다른 오류는 키를 안 바꾸고, 모든 키가 한도면 실패한다", async () => {
  const r = recorder();
  const pool = makeKeyPool(2);
  const used: number[] = [];
  await assert.rejects(callWithKeys(pool, "m", async (k) => (used.push(k), Promise.reject(new Error('{"code":500}'))), undefined, r.sleep));
  assert.deepEqual(used, [0]);
  used.length = 0;
  await assert.rejects(callWithKeys(pool, "m", async (k) => (used.push(k), Promise.reject(err429(DAILY))), undefined, r.sleep));
  assert.deepEqual(used, [0, 1]);
  used.length = 0;
  await assert.rejects(callWithKeys(pool, "m", async (k) => (used.push(k), "답"), undefined, r.sleep));
  assert.deepEqual(used, []); // 둘 다 쉬는 중
});
test("키 전환: 쉬는 시간이 지나면 다시 쓴다", () => {
  let t = 0;
  const pool = makeKeyPool(1, () => t);
  pool.rest(0, "m", 1000);
  assert.equal(pool.resting(0, "m"), true);
  t = 1001;
  assert.equal(pool.resting(0, "m"), false);
});

// 실시간 판단 모드: 가짜 AI로 한 삶을 끝까지 산다
function liveToEnd(run: number, entries: LiveEntries, answer: (e: LivePause) => number[]) {
  const w = getWorld("developer");
  let asks = 0;
  for (;;) {
    try {
      return { path: liveLife(DEMO_PROFILE, w, 36, "2026-12", run, entries), asks };
    } catch (e) {
      if (!(e instanceof LivePause)) throw e;
      asks++;
      assert.ok(asks < 50, "끝나지 않아요");
      entries[liveEntryKey(w.id, run, e.ctx.month, e.event.id)] = { probs: answer(e), reasons: e.event.choices.map(() => "모은 돈이 적어서"), src: "ai" };
    }
  }
}
const even = (e: LivePause) => e.event.choices.map(() => 1 / e.event.choices.length);
test("실시간: 삶마다 큰 갈림길에서 멈추고, 그때 상황을 넘긴다", () => {
  let seen = 0;
  for (let r = 0; r < LIVE_RUNS; r++)
    liveToEnd(r, {}, (e) => {
      seen++;
      assert.equal(e.event.branch, "choice");
      assert.ok(e.ctx.bucket.length > 0);
      assert.ok(e.ctx.state.stress >= 0);
      assert.ok(e.ctx.recent.length <= 5);
      return even(e);
    });
  assert.ok(seen >= LIVE_RUNS / 2, `판단 ${seen}번`);
});
test("실시간: 저장한 판단이면 묻지 않고 같은 인생, 판단이 다르면 고를 확률이 달라진다", () => {
  const entries: LiveEntries = {};
  const lives = Array.from({ length: LIVE_RUNS }, (_, r) => liveToEnd(r, entries, even).path);
  const w = getWorld("developer");
  lives.forEach((path, r) => assert.deepEqual(liveLife(DEMO_PROFILE, w, 36, "2026-12", r, entries).signature, path.signature));
  const picks = lives.flatMap((x) => x.months).filter((m) => m.pick?.byAi);
  assert.ok(picks.length > 0);
  for (const m of picks) {
    const odds = m.pick!.mine / (1 - m.pick!.mine) / (m.pick!.base / (1 - m.pick!.base));
    assert.ok(odds < 1.5 + 0.3 && odds > 1 / 1.5 - 0.3, `상한 밖: ${odds}`); // 엔진 상한(r 곱한 뒤 소프트맥스) 안
  }
  assert.ok(picks.every((m) => m.reason === "모은 돈이 적어서"));
  // 보기 하나로 몰아 줘도 상한 때문에 기준에서 크게 못 벗어난다
  const skew: LiveEntries = {};
  const one = liveToEnd(0, skew, (e) => e.event.choices.map((_, i) => (i === 0 ? 0.97 : 0.03 / (e.event.choices.length - 1)))).path;
  for (const m of one.months.filter((x) => x.pick?.byAi && x.choiceIndex === 0)) assert.ok(m.pick!.mine < m.pick!.base * 1.6 + 0.05);
});
test("실시간: 규칙으로 끝내면 멈추지 않고 실패 표시, 같은 시드라 판단 없을 때 앞부분은 같다", () => {
  const w = getWorld("developer");
  const path = liveLife(DEMO_PROFILE, w, 36, "2026-12", 3, {}, true);
  const bare = simulatePath(DEMO_PROFILE, w, 36, "2026-12", seedFor(DEMO_PROFILE, w.id, 3));
  assert.deepEqual(path.signature, bare.signature); // 규칙 기울기면 기본 모드의 같은 회차와 같은 인생
  assert.ok(path.months.filter((m) => m.event?.branch === "choice" && m.pick).every((m) => !m.pick!.byAi));
  assert.ok(path.months.some((m) => m.pick?.aiFailed) || path.months.every((m) => m.event?.branch !== "choice"));
});
test("실시간: 요약은 횟수로, 입력이 바뀌면 실행 이름이 바뀐다", () => {
  const entries: LiveEntries = {};
  const lives = Array.from({ length: 10 }, (_, r) => ({ run: r, path: liveToEnd(r, entries, even).path }));
  const s = liveSummary(DEMO_PROFILE, getWorld("developer"), lives);
  assert.equal(s.n, 10);
  assert.equal(
    s.groups.reduce((a, g) => a + g.runs.length, 0),
    10,
  );
  assert.ok(s.ai > 0);
  assert.equal(s.rule, 0);
  const k = liveRunKey(DEMO_PROFILE, ["developer"], 36, "2026-12");
  assert.equal(k, liveRunKey(DEMO_PROFILE, ["developer"], 36, "2026-12"));
  assert.notEqual(k, liveRunKey(DEMO_PROFILE, ["developer"], 60, "2026-12"));
  assert.match(k, /^[a-z0-9]{1,16}$/);
});
test("실시간: 돌려줄 토큰은 AI가 판단 못 한 몫(내림)", () => {
  assert.equal(liveRefundTokens(4, 0, 100), 4);
  assert.equal(liveRefundTokens(4, 30, 100), 2);
  assert.equal(liveRefundTokens(4, 76, 100), 0);
  assert.equal(liveRefundTokens(4, 200, 100), 0);
  assert.equal(liveRefundTokens(0, 0, 100), 0);
  assert.equal(liveRefundTokens(4, 0, 0), 0);
  assert.ok(liveForkCount(DEMO_PROFILE, getWorld("developer"), 36, "2026-12") > 0);
});
test("실시간: 세계선으로 이을 때 장면은 그 삶 그대로", () => {
  const lives = Array.from({ length: LIVE_RUNS }, (_, r) => ({ run: r, path: liveToEnd(r, {}, even).path }));
  const { mv, scenes } = liveMultiverse(DEMO_PROFILE, getWorld("developer"), 36, "2026-12", lives);
  assert.equal(mv.live, true);
  assert.equal(mv.stats.runs, LIVE_RUNS);
  assert.ok(mv.lines.length > 0);
  for (const l of mv.lines) assert.ok(scenes[l.id]?.length, l.title);
});
test("가족이 바라는 직업: 이 진로면 더 해 봄, 다른 진로면 바꿈, 값이 없으면 같은 객체", () => {
  const f = { value: "specific" as const, job: "개발자", strength: 5 as const, evidence: "아버지가 개발자 하래요" };
  const p = { ...DEMO_PROFILE, story: { decisionStyle: null, persistence: null, familyExpectation: f, regretType: null, coreValues: [], runwayMonths: null } };
  const tones = ["push", "change", "safe"] as const;
  const dev = getWorld("developer");
  const other = getWorld("marketer");
  const plain = ruleProbs(p, CALM, [...tones]);
  const match = ruleProbs(withFamilyPull(p, dev), CALM, [...tones]);
  const away = ruleProbs(withFamilyPull(p, other), CALM, [...tones]);
  assert.ok(match[0] > plain[0]);
  assert.ok(away[1] > plain[1]);
  assert.equal(withFamilyPull(DEMO_PROFILE, dev), DEMO_PROFILE);
  assert.ok(choiceProbs(withFamilyPull(p, dev), CALM, [...tones]).every((x) => x > 0));
});
test("체크인 성격: 10문항끼리 비교하고, 누를 때만 차이를 더한다", () => {
  const old = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3 };
  const p = { ...DEMO_PROFILE, bigFive: { O: 4, C: 2, E: 3, A: 3, N: 5 }, answers: { ...DEMO_PROFILE.answers, bfi10: old } };
  const next = { ...old, 8: 5, 3: 1, 9: 5, 4: 1 }; // 성실성 +2, 신경성 +2
  const diff = bigFiveDiff(p, next);
  assert.equal(diff.find((d) => d.key === "C")!.after, 5);
  assert.equal(diff.find((d) => d.key === "C")!.before, 3);
  const q = withNewBigFive(p, next);
  assert.equal(q.bigFive.C, 4); // 2 + 2
  assert.equal(q.bigFive.N, 5); // 5 + 2, 위로 막힘
  assert.equal(q.bigFive.O, 4);
  assert.deepEqual(q.answers.bfi10, next);
});
test("체크인 메일: 켠 사람만, 때가 됐을 때, 차례마다 이름이 달라진다", () => {
  const now = Date.parse("2026-11-04T00:00:00Z");
  const since = "2026-09-01T00:00:00.000Z";
  const base = { ...DEMO_PROFILE, since, checkins: [] };
  assert.equal(checkinMailRef(base, now), null); // 안 켬
  assert.equal(checkinMailRef({ ...base, checkinMail: true }, now), "checkin:2026-09-01");
  assert.equal(checkinMailRef({ ...base, checkinMail: true, since: "2026-10-30T00:00:00.000Z" }, now), null); // 아직 때가 아님
  const after = { ...base, checkinMail: true, checkins: [{ at: "2026-10-01T00:00:00.000Z", picks: {}, real: "none" as const, demo: false }] };
  assert.equal(checkinMailRef(after, now), "checkin:2026-10-01");
});

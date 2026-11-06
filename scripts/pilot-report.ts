// 파일럿 사용 전·후 설문 집계(보기만, 파일 안 씀). 자유 답이 나오니 출력을 커밋하거나 그대로 공유하지 말 것.
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/pilot-report.ts data/pilot/profiles.json [--no-free]
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/pilot-report.ts --selftest
// 입력은 fit-weights.ts와 같다: { data: 프로필 } 또는 프로필의 배열. demo는 건너뛰고, 동의하고 안 빠진 사람만 센다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCareers, summarizeSurvey, withdrawPilot, type SurveySummary } from "../lib/pilot";
import type { PilotSurvey, Profile } from "../lib/types";

const args = process.argv.slice(2);
const f1 = (x: number) => x.toFixed(2);

function print(s: SurveySummary, free: boolean) {
  console.log(`동의하고 안 빠진 사람 ${s.consented}명 · 전후 비교 ${s.paired}명 · 사전만 답함 ${s.preOnly}명 · 쓴 뒤 사전 답함(제외) ${s.usedBefore}명\n`);
  if (!s.paired) {
    console.log("전후를 다 답한 사람이 없어요. 결과 없음.");
  } else {
    const c = s.confidence!;
    const k = s.careers!;
    const a = s.action!;
    console.log("| 항목 | 전 | 후 | 변화 |\n|---|---|---|---|");
    console.log(`| 확신도(1~5) 평균 | ${f1(c.pre)} | ${f1(c.post)} | ${c.diff >= 0 ? "+" : ""}${f1(c.diff)} (95% 구간 ${f1(c.lo)}~${f1(c.hi)}), 오름 ${c.up} · 같음 ${c.same} · 내림 ${c.down} |`);
    console.log(`| 고려 중인 진로 수 평균 | ${f1(k.pre)} | ${f1(k.post)} | 목록이 바뀐 사람 ${k.changed}명 |`);
    console.log(`| 이번 주 할 일 있음 | ${a.pre}명 | ${a.post}명 | 없음→있음 ${a.gained}명 · 있음→없음 ${a.lost}명 |`);
    console.log("\n한계: 비교 집단이 없는 자기 보고 전후 비교이고 참여자는 자원자예요. 앱 때문에 바뀌었다고 말할 수 없고, 확신이 오른 것이 좋은 결정이었다는 뜻도 아니에요.");
    if (s.paired < 30) console.log(`표본 ${s.paired}명이라 구간이 넓어요. 효과가 있다/없다고 말하기엔 부족해요.`);
  }
  if (free) {
    console.log(`\n판단이 바뀌었나요? (자유 답 ${s.changed.length}개, 글자 순)`);
    s.changed.forEach((x) => console.log(`- ${x}`));
  }
}

function load(path: string) {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const rows = (Array.isArray(raw) ? raw : ((raw as { profiles?: unknown[] }).profiles ?? [])) as Record<string, unknown>[];
  return rows
    .filter((r) => r && !r.demo && !(r.data as Record<string, unknown> | undefined)?.demo)
    .map((r) => (r.data ?? r) as unknown as Profile);
}

function selftest() {
  const ans = (confidence: number, careers: string[], hasAction: boolean, usedBefore?: boolean) => ({ confidence, careers, hasAction, at: "2026-11-06", usedBefore });
  const who = (survey: PilotSurvey, withdrawnAt: string | null = null) => ({ pilot: { version: "t", consentAt: "2026-11-06", withdrawnAt, survey } });
  const s = summarizeSurvey([
    who({ pre: ans(2, ["개발자", "공무원"], false), post: ans(4, ["개발자"], true), changed: "공무원을 뺐어요" }),
    who({ pre: ans(3, ["간호사"], true), post: ans(3, [" 간호사 "].map((x) => x.trim()), true) }),
    who({ pre: ans(4, ["마케터"], true), post: ans(3, ["마케터"], false) }),
    who({ pre: ans(1, [], false) }), // 사전만
    who({ pre: ans(1, [], false, true), post: ans(5, [], true) }), // 쓴 뒤 사전 답함: 비교에서 뺌
    who({ pre: ans(1, [], false), post: ans(5, [], true), changed: "빠진 사람 답" }, "2026-11-07"), // 빠짐
    { pilot: null },
  ]);
  assert.equal(s.consented, 5);
  assert.equal(s.paired, 3);
  assert.equal(s.preOnly, 1);
  assert.equal(s.usedBefore, 1);
  assert.ok(Math.abs(s.confidence!.diff - 1 / 3) < 1e-9);
  assert.deepEqual([s.confidence!.up, s.confidence!.same, s.confidence!.down], [1, 1, 1]);
  assert.equal(s.careers!.changed, 1);
  assert.deepEqual([s.action!.pre, s.action!.post, s.action!.gained, s.action!.lost], [2, 2, 1, 1]);
  assert.deepEqual(s.changed, ["공무원을 뺐어요"]);
  assert.equal(summarizeSurvey([]).confidence, null);
  assert.deepEqual(parseCareers("개발자, 개 발 자·공무원\n\n"), ["개발자", "공무원"]);
  const out = withdrawPilot({ holdoutPicks: { p1: 1, s7: 2 }, pilot: { version: "t", consentAt: "x", withdrawnAt: null, survey: { changed: "지워져야 함" } } } as unknown as Profile);
  assert.equal(out.pilot?.survey, undefined);
  assert.deepEqual(out.holdoutPicks, { s7: 2 });
  console.log("자체 확인 통과\n");
  print(s, true);
}

if (args.includes("--selftest")) selftest();
else {
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) throw new Error("파일을 주세요: scripts/pilot-report.ts data/pilot/profiles.json");
  print(summarizeSurvey(load(path)), !args.includes("--no-free"));
}

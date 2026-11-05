// 증거물 단위 테스트. 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-evidence.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_PROFILE } from "@/lib/demo";
import { buildEvidence, buildExamPlan, cleanTopics, ruleTopics, pickCriteria, weakSubjects } from "@/lib/evidence";
import { gapItems } from "@/lib/gap";
import { ALL_WORLD_IDS } from "@/lib/job-codes";
import type { Requirements } from "@/lib/requirements";
import { getWorld } from "@/lib/worlds";

const load = (id: string) => (JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as { default: Requirements }).default;
let n = 0;
const t = (name: string, f: () => void) => {
  f();
  n++;
  console.log("통과:", name);
};

t("완성 기준은 원문 그대로, 요소마다 하나", () => {
  const out = pickCriteria([
    { criteria: ["환경을 계획할 수 있다.", "결과 보고서를 작성할 수 있다."] },
    { criteria: ["도구를 설치할 수 있다.", "설정을 할 수 있다."] },
    { criteria: [] },
  ]);
  assert.deepEqual(out, ["결과 보고서를 작성할 수 있다.", "도구를 설치할 수 있다."]);
});
t("개발자: 능력단위 3개 + 기술서, 기준은 NCS", () => {
  const w = getWorld("developer");
  const r = load("developer");
  const p = buildEvidence(r, w, gapItems(r, DEMO_PROFILE, w));
  assert.equal(p.cards.filter((c) => c.unit).length, 3);
  assert.ok(p.cards.every((c) => c.unit === null || c.checksGrade === "ncs"));
  const unit = r.items.find((i) => i.id === p.cards[0].id)!;
  assert.equal(p.cards[0].checks.length, unit.ncsElements!.filter((e) => e.criteria.length).length);
  assert.ok(p.cards[0].checks.every((c) => /수 있다\.?$/.test(c) && unit.ncsCriteria!.includes(c)));
  assert.ok(p.cards.some((c) => c.id === "career-note"));
  assert.match(p.basis ?? "", /공고 집계가 없어서/);
});
t("공고 비율이 있으면 그 순서", () => {
  const w = getWorld("developer");
  const r = load("developer");
  const skills = r.items.filter((i) => i.kind === "skill" && i.entry !== false);
  const last = skills.at(-1)!;
  const req = { ...r, items: r.items.map((i) => (i.id === last.id ? { ...i, postingShare: 0.9, postingN: 100 } : i)) };
  const p = buildEvidence(req, w, gapItems(req, DEMO_PROFILE, w));
  assert.equal(p.cards[0].id, last.id);
  assert.match(p.basis ?? "", /공고에 많이/);
});
t("간호사: NCS가 없으면 가정값 기준으로 사례 보고서·평가 기록", () => {
  const w = getWorld("nurse");
  const r = load("nurse");
  const p = buildEvidence(r, w, gapItems(r, DEMO_PROFILE, w));
  assert.ok(p.cards.some((c) => c.form === "실습 사례 보고서" && c.checksGrade === "assumed"));
  assert.ok(p.cards.some((c) => c.form === "실습 평가 기록"));
  assert.equal(p.basis, null);
  const rec = p.cards.find((c) => c.form === "실습 평가 기록")!;
  assert.equal(rec.noTopic, true);
  assert.equal(rec.checksGrade, "curated");
  assert.equal(rec.checks.length, 20);
  assert.ok(rec.checksRef?.url && rec.checksRef.notice.includes("kabone"));
  assert.equal(p.cards.find((c) => c.form === "실습 사례 보고서")?.checksGrade, "assumed");
});
t("시험형: 과목으로 모의고사 계획, 약점은 평균이 낮은 순", () => {
  const e = buildExamPlan(load("civil-servant"));
  assert.deepEqual(e.subjects.map((s) => s.name), ["국어", "영어", "한국사", "행정법총론", "행정학개론"]);
  const [kor, eng, his] = e.subjects;
  const w = weakSubjects([{ ym: "2027-01", scores: { [kor.id]: 80, [eng.id]: 40 } }, { ym: "2027-02", scores: { [kor.id]: 60, [eng.id]: 60, [his.id]: 40 } }], e.subjects);
  assert.deepEqual(w.map((x) => x.name), ["한국사", "영어"]);
  assert.equal(w[1].avg, 50);
  // 평균보다 높은 과목은 약점으로 안 친다
  assert.deepEqual(weakSubjects([{ ym: "", scores: { [kor.id]: 85, [eng.id]: 40 } }], e.subjects).map((x) => x.name), ["영어"]);
});
t("AI 응답: 후보에 없는 id·형식 틀린 값은 버리고 센다", () => {
  const { topics, dropped } = cleanTopics({ topics: [{ card: "a", title: "좋은 주제", why: "이유" }, { card: "x", title: "없는 후보", why: "" }, { card: "a", title: "", why: "" }, { card: "a", title: "가".repeat(60), why: "" }] }, ["a"]);
  assert.deepEqual(topics, { a: [{ title: "좋은 주제", why: "이유" }] });
  assert.equal(dropped, 3);
  assert.deepEqual(cleanTopics(null, ["a"]), { topics: {}, dropped: 0 });
});
t("규칙 예시: 전공이 없어도 만든다", () => {
  assert.equal(ruleTopics([{ id: "a", label: "프로젝트" }], "")["a"].length, 1);
  assert.equal(ruleTopics([{ id: "a", label: "프로젝트" }], "경영학과")["a"].length, 2);
});
t("53개 진로 모두 증거물이 나온다", () => {
  assert.equal(ALL_WORLD_IDS.length, 53);
  for (const id of ALL_WORLD_IDS) {
    const w = getWorld(id);
    const r = load(id);
    if (w.archetype === "exam") {
      assert.ok(buildExamPlan(r).subjects.length >= 1 , `${id} 시험 과목 없음`);
      continue;
    }
    const p = buildEvidence(r, w, gapItems(r, DEMO_PROFILE, w));
    assert.ok(p.cards.length >= 1, `${id} 증거물 없음`);
    assert.ok(p.cards.every((c) => c.checks.length >= 1 && c.checks.every((x) => x.length > 0)), `${id} 빈 기준`);
  }
});
console.log(`${n}개 통과`);

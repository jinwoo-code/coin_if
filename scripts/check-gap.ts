// 격차 판정·우선순위 단위 테스트(AI·네트워크 없음).
import assert from "node:assert/strict";
import { DEMO_PROFILE } from "@/lib/demo";
import { gapItems, judgeItem, monthsOf, postingText, prioritize, scoreOf, tweakOf } from "@/lib/gap";
import type { RequirementItem, Requirements } from "@/lib/requirements";
import type { Profile } from "@/lib/types";
import { W } from "@/lib/weights";
import { getWorld } from "@/lib/worlds";

const item = (x: Partial<RequirementItem>): RequirementItem => ({ id: x.name ?? "a", kind: "cert", name: "a", grade: "official", source: "work24-job", ...x });
const prof = (spec: Partial<Profile["spec"]> = {}, rest: Partial<Profile> = {}): Profile => ({ ...DEMO_PROFILE, ...rest, spec: { ...DEMO_PROFILE.spec, certs: [], internMonths: 0, projects: 0, toeic: null, ...spec } });
const dev = getWorld("developer");
const nurse = getWorld("nurse");
const cs = getWorld("civil-servant");
let n = 0;
const t = (name: string, f: () => void) => {
  f();
  n++;
  console.log("통과", name);
};

t("자격증: 있음/없음/토익 기준", () => {
  assert.equal(judgeItem(item({ name: "정보처리기사" }), prof({ certs: ["정보처리기사"] }), dev).status, "have");
  assert.equal(judgeItem(item({ name: "정보처리기사" }), prof(), dev).status, "none");
  const e = item({ name: "영어능력검정", detail: "토익 550" });
  assert.equal(judgeItem(e, prof({ toeic: 600 }), dev).status, "have");
  assert.equal(judgeItem(e, prof({ toeic: 500 }), dev).status, "partial");
});
t("면허: 준비도 답으로", () => {
  const l = item({ name: "간호사 면허", required: true });
  assert.equal(judgeItem(l, prof({}, { readiness: { license: 3 } }), nurse).status, "have");
  assert.equal(judgeItem(l, prof({}, { readiness: { license: 1 } }), nurse).status, "partial");
  assert.equal(judgeItem(l, prof({}, { readiness: { license: 0 } }), nurse).status, "none");
});
t("준비도를 답하지 않으면 가졌다고 안 본다", () => {
  const g = judgeItem(item({ name: "간호사 면허", required: true }), prof({}, { readiness: {} }), nurse);
  assert.equal(g.status, "none");
  assert.equal(g.asked, false);
});
t("경험: 인턴·프로젝트·학과", () => {
  const i = item({ kind: "experience", name: "인턴·현장실습" });
  assert.equal(judgeItem(i, prof({ internMonths: 3 }), dev).status, "have");
  assert.equal(judgeItem(i, prof({ internMonths: 1 }), dev).status, "partial");
  assert.equal(judgeItem(i, prof(), dev).status, "none");
  const m = item({ kind: "experience", name: "인증받은 간호학과 졸업" });
  assert.equal(judgeItem(m, prof({}, { major: "경영학" }), nurse).status, "none");
  assert.equal(judgeItem(m, prof({ status: "재학" }, { major: "간호학" }), nurse).status, "partial");
  assert.equal(judgeItem(m, prof({ status: "졸업" }, { major: "간호학" }), nurse).status, "have");
});
t("능력은 물어본 적 없음으로 표시한다", () => {
  const g = judgeItem(item({ kind: "skill", name: "화면구현" }), prof({}, { readiness: { coding: 0 } }), dev);
  assert.equal(g.status, "none");
  assert.equal(g.asked, false);
  assert.ok(g.basis.includes("추정"));
});
t("시험형은 NCS 능력을 격차에 안 넣는다", () => {
  const r = { items: [item({ kind: "skill", name: "문서 작성" }), item({ kind: "exam", name: "국어" })] } as Requirements;
  assert.deepEqual(
    gapItems(r, prof(), cs).map((g) => g.item.name),
    ["국어"],
  );
});
t("점수: 공고가 없으면 그 칸을 빼고 다시 나눈다", () => {
  const without = scoreOf({ sim: 1, time: 1, fit: 1 });
  assert.ok(Math.abs(without - 1) < 1e-9);
  const withZero = scoreOf({ posting: 0, sim: 1, time: 1, fit: 1 });
  assert.ok(Math.abs(withZero - (1 - W("report.priority.posting"))) < 1e-9);
  assert.equal(postingText(item({})), "공고 집계 없음(기관 키 필요)");
  assert.equal(postingText(item({ postingShare: 0.35, postingN: 40 })), "공고 40개 중 14개가 요구");
});
t("우선순위: 있음·절차는 빠지고 필수가 먼저, 같은 조건의 능력은 한 묶음", () => {
  const p = prof({}, { readiness: { coding: 1 } });
  const items = [
    item({ kind: "skill", name: "화면구현", hours: { value: 40, grade: "assumed" } }),
    item({ kind: "skill", name: "서버구현", hours: { value: 40, grade: "assumed" } }),
    item({ kind: "experience", name: "인턴", hours: { value: 320, grade: "assumed" } }),
    item({ name: "정보처리기사", required: true }),
    item({ kind: "step", name: "면접" }),
  ];
  const rows = prioritize(
    items.map((i) => judgeItem(i, p, dev)),
    dev,
    p,
    { "readiness:coding": 8, intern: 8 },
  );
  assert.equal(rows[0].item.name, "정보처리기사");
  assert.equal(
    rows.some((r) => r.item.kind === "step"),
    false,
  );
  const bundle = rows.find((r) => r.members.length === 2)!;
  assert.equal(bundle.title, "직무 능력 2개");
  assert.equal(bundle.hoursLeft, 40); // 부분적이라 40×2×0.5
  assert.ok(bundle.score > rows.find((r) => r.item.name === "인턴")!.score);
  assert.ok(bundle.evidence.join().includes("+8%p"));
});
t("체력시험은 공부 시간으로 안 친다", () => {
  const police = getWorld("police");
  assert.notEqual(tweakOf(item({ kind: "exam", name: "순환식 체력검사" }), police)?.key, "study");
  assert.equal(tweakOf(item({ kind: "exam", name: "헌법" }), police)?.key, "study");
});
t("엔진에 안 들어가는 항목은 효과를 지어내지 않는다", () => {
  const a = item({ name: "리눅스마스터" });
  assert.equal(tweakOf(a, dev), null);
  const rows = prioritize([judgeItem(a, prof(), dev)], dev, prof(), {});
  assert.equal(rows[0].simDelta, null);
  assert.ok(rows[0].evidence.includes("시뮬레이션에 안 들어가는 항목"));
});
t("근거 없는 항목과 선택 항목은 뒤로", () => {
  const p = prof({}, { readiness: { coding: 1 } });
  const items = [
    item({ name: "리눅스마스터", hours: { value: 40, grade: "assumed" } }),
    item({ kind: "skill", name: "화면구현", hours: { value: 40, grade: "assumed" } }),
    item({ name: "가산", required: false, hours: { value: 1, grade: "assumed" } }),
  ];
  const rows = prioritize(
    items.map((i) => judgeItem(i, p, dev)),
    dev,
    p,
    { "readiness:coding": 8 },
  );
  assert.deepEqual(
    rows.map((r) => r.item.name),
    ["화면구현", "리눅스마스터", "가산"],
  );
});
t("개월: 알바 시간을 빼고, 공부 시간이 0이면 없음", () => {
  assert.equal(monthsOf(120, prof({}, { life: { ...DEMO_PROFILE.life, studyHours: 2, partTimeHours: 0 } })), 2);
  assert.equal(monthsOf(120, prof({}, { life: { ...DEMO_PROFILE.life, studyHours: 0, partTimeHours: 0 } })), null);
});
console.log(`${n}개 통과`);

// 격차 판정·우선순위 단위 테스트(AI·네트워크 없음).
import assert from "node:assert/strict";
import { certClass, eligibilityOf, gradeOf, isNotCert, isVendorCert } from "@/lib/cert-eligibility";
import { DEMO_PROFILE } from "@/lib/demo";
import { gapDeltas } from "@/lib/gap-sim";
import { gapItems, higherCert, judgeItem, laterCerts, laterSkills, monthsOf, postingText, prioritize, REQUIRED_TEXT, scoreOf, tweakOf } from "@/lib/gap";
import { retrainMonths } from "@/lib/retrain";
import { buildPlan, itemsToCut, overText, weeklyOf } from "@/lib/schedule";
import { simulatePath } from "@/lib/engine";
import { applyCertAlternatives, applySkillGroups, chunkSkills } from "@/lib/requirements";
import type { RequirementItem, Requirements, RequirementsFile } from "@/lib/requirements";
import { readFileSync } from "node:fs";
import certExclude from "@/data/cert-exclude.json";
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
t("윗 등급 자격이 있으면 아랫 등급은 있음", () => {
  const p = prof({ certs: ["정보처리산업기사", "한국사능력검정시험 1급"] });
  assert.equal(judgeItem(item({ name: "정보처리기능사" }), p, dev).status, "have");
  assert.equal(judgeItem(item({ name: "정보처리기사" }), p, dev).status, "none");
  assert.equal(judgeItem(item({ name: "전자계산기기능사" }), p, dev).status, "none");
  assert.equal(higherCert(p, "한국사능력검정 3급 이상"), "한국사능력검정시험 1급");
  assert.equal(higherCert(prof({ certs: ["한국사 4급"] }), "한국사능력검정 3급 이상"), null);
});
t("필수는 효과 %p 대신 필수 문구", () => {
  const p = prof({}, { readiness: {} });
  const l = item({ name: "간호사 면허", required: true });
  const rows = prioritize([judgeItem(l, p, nurse)], nurse, p, { "readiness:license": 9 });
  assert.equal(rows[0].simDelta, null);
  assert.deepEqual(rows[0].evidence, [REQUIRED_TEXT]);
});
t("공부 시간 효과는 무엇을 바꿨는지 붙인다", () => {
  const e = item({ kind: "exam", name: "국어", hours: { value: 100, grade: "assumed" } });
  const rows = prioritize([judgeItem(e, prof(), cs)], cs, prof(), { study: 17 });
  assert.ok(rows[0].evidence.join().includes("+17%p(하루 공부를 2시간 늘렸을 때)"));
});
t("능력 묶음 답이 추정보다 먼저", () => {
  const r = { items: [item({ id: "a", kind: "skill", name: "화면구현" }), item({ id: "b", kind: "skill", name: "서버구현" })], skillGroups: [{ id: "g1", name: "화면", itemIds: ["a"] }] } as Requirements;
  const g = gapItems(r, prof({}, { readiness: { coding: 0 } }), dev, { g1: 2 });
  assert.equal(g[0].status, "have");
  assert.equal(g[0].asked, true);
  assert.equal(g[1].status, "none"); // 안 답한 묶음은 추정
});
t("능력 묶기: 없는 id는 버리고 빠진 것은 넣고, 쓸모없으면 AI 없이", () => {
  const s = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `s${i}`, name: `능력${i}` }));
  const a = applySkillGroups(s, {
    groups: [
      { name: "가", ids: ["s1", "s2", "없음"] },
      { name: "나", ids: ["s3", "s1"] },
    ],
  });
  assert.equal(a.invented, 1);
  assert.equal(a.ai, true);
  assert.deepEqual(a.groups.flatMap((g) => g.itemIds).sort(), ["s1", "s2", "s3", "s4", "s5", "s6"]);
  const b = applySkillGroups(s, null);
  assert.equal(b.ai, false);
  assert.ok(b.groups.length <= 4);
  assert.equal(chunkSkills(s.slice(0, 3)).length, 3);
});
t("전공이 다르면 학과 다니기: 그 기간에 합격·취업 없음", () => {
  const p = prof({ gradIn: 0, status: "졸업" }, { major: "경영학", readiness: {} });
  assert.equal(retrainMonths(p, nurse), 30);
  assert.equal(retrainMonths({ ...p, major: "간호학과" }, nurse), 0);
  assert.equal(retrainMonths({ ...p, major: "" }, nurse), 0);
  assert.equal(retrainMonths({ ...p, readiness: { license: 1 } }, nurse), 0);
  assert.equal(retrainMonths(p, dev), 0);
  for (const seed of [1, 2, 3, 4, 5]) {
    const path = simulatePath(p, nurse, 60, "2026-11", String(seed));
    assert.equal(path.months[0].event?.id, "retrain-start");
    assert.equal(path.months[0].status, "학과 다시 다니는 중");
    assert.equal(path.months[30].event?.id, "retrain-end");
    assert.ok(path.employedAt === null || path.employedAt > 30);
  }
  assert.equal(tweakOf(item({ name: "간호사 면허", required: true }), nurse)!.apply(p), null);
});
t("일정: 우선순위대로, 여유 20%, 시간 초과를 알린다", () => {
  const p = prof({}, { life: { ...DEMO_PROFILE.life, studyHours: 2, partTimeHours: 0 }, readiness: { coding: 0 } });
  const items = [
    item({ id: "s1", kind: "skill", name: "화면구현", hours: { value: 40, grade: "assumed" } }),
    item({ id: "c1", name: "정보처리기사", hours: { value: 300, grade: "assumed" } }),
    item({ id: "e1", kind: "experience", name: "프로젝트", hours: { value: 100, grade: "assumed" } }),
  ];
  const rows = prioritize(
    items.map((i) => judgeItem(i, p, dev)),
    dev,
    p,
    {},
  );
  assert.equal(weeklyOf(p), 14);
  const plan = buildPlan(rows, p, dev, 36);
  assert.ok(Math.abs(plan.capacityPerMonth - 14 * 4.345 * 0.8) < 0.01);
  assert.equal(plan.over, false);
  assert.equal(plan.rows.find((r) => r.id === "c1")!.examMonth, plan.rows.find((r) => r.id === "c1")!.end);
  assert.ok(plan.rows.find((r) => r.id === "e1")!.lane === "practice" && plan.rows.find((r) => r.id === "e1")!.start === 0);
  const tight = buildPlan(rows, p, dev, 36, { months: 3, weekly: 5 });
  assert.equal(tight.over, true);
  assert.match(overText(tight), /주 \d+시간이 필요한데 지금은 5시간이에요/);
  assert.ok(tight.rows.some((r) => r.overflow));
  const cut = itemsToCut(rows, p, dev, 3, 40);
  assert.ok(cut.length >= 0);
  assert.equal(buildPlan(rows, p, dev, 3, { months: 3, weekly: 40, removed: cut }).over, false);
  const edited = buildPlan(rows, p, dev, 36, { examMonth: { c1: 0 } });
  assert.equal(edited.rows.find((r) => r.id === "c1")!.examTooEarly, true);
});
t("일정: 학과가 필요한 진로는 학과가 맨 앞, 공부 시간 0도 멈추지 않는다", () => {
  const p = prof({ gradIn: 0 }, { major: "경영학", readiness: {}, life: { ...DEMO_PROFILE.life, studyHours: 0, partTimeHours: 0 } });
  const items = [
    item({ id: "m", kind: "experience", name: "인증받은 간호학과 졸업", required: true }),
    item({ id: "x", kind: "exam", name: "기본간호학", hours: { value: 80, grade: "assumed" } }),
    item({ id: "l", name: "간호사 면허", required: true }),
  ];
  const rows = prioritize(
    items.map((i) => judgeItem(i, p, nurse)),
    nurse,
    p,
    {},
  );
  const plan = buildPlan(rows, p, nurse, 36);
  assert.equal(plan.rows[0].id, "school");
  assert.equal(plan.schoolMonths, 30);
  assert.ok(plan.milestones.some((m) => m.item.id === "l"));
  assert.equal(plan.over, true);
  assert.equal(plan.neededMonths, null);
  const study = { ...p, life: { ...p.life, studyHours: 4 } };
  const after = buildPlan(rows, study, nurse, 36);
  assert.equal(after.rows.find((r) => r.id === "x")!.start, 30);
  const short = buildPlan(rows, study, nurse, 24);
  assert.equal(short.over, true);
  assert.match(overText(short), /학과 과정만 30개월/);
});
t("응시자격: 시행령 별표 4의2 기준", () => {
  const cs = (school: Profile["spec"]["school"], major: string) => prof({ school }, { major });
  assert.equal(gradeOf("소방설비기사 (전기·기계분야)"), "기사");
  assert.equal(gradeOf("리눅스마스터"), null);
  assert.equal(eligibilityOf("정보처리기능사", cs("고졸", ""), dev).status, "open");
  assert.equal(eligibilityOf("컴퓨터시스템응용기술사", cs("4년제", "컴퓨터공학"), dev).status, "blocked");
  assert.equal(eligibilityOf("조리기능장", cs("4년제", "조리"), dev).status, "blocked");
  assert.equal(eligibilityOf("정보처리기사", cs("4년제", "컴퓨터공학"), dev).status, "ok");
  assert.equal(eligibilityOf("정보처리기사", cs("전문대", "컴퓨터공학"), dev).status, "blocked");
  assert.equal(eligibilityOf("정보처리기사", prof({ school: "4년제" }, { major: "경영학과" }), dev).status, "check");
  assert.equal(eligibilityOf("정보처리기사", cs("4년제", ""), dev).status, "check");
  assert.equal(eligibilityOf("정보처리산업기사", cs("전문대", "컴퓨터공학"), dev).status, "ok");
  assert.equal(eligibilityOf("정보처리산업기사", cs("고졸", "컴퓨터공학"), dev).status, "blocked");
  assert.equal(eligibilityOf("사회조사분석사 1급", cs("4년제", ""), dev).status, "blocked");
});
t("자격 종류: 국가기술·NCS 관련이 먼저, 업체 자격이 맨 뒤, 자격이 아닌 값은 뺀다", () => {
  assert.ok(certClass("정보처리기사", true) < certClass("정보처리기능사") && certClass("정보처리기능사") < certClass("ADsP", true) && certClass("ADsP", true) < certClass("리눅스마스터") && certClass("리눅스마스터") < certClass("MCSE"));
  for (const v of ["MCSE", "SCJP", "OCP", "오라클 자격인증제도", "마이크로소프트 인증 전문가 자격증(MCP)"]) assert.ok(isVendorCert(v), v);
  assert.ok(!isVendorCert("정보처리기사"));
  for (const v of ["해당없음", "없음", "해당사항 없음", "출판기획기사(가칭) 신설", "과정평가자격(일반)", "헤어디자인_L2", "기계시스템설계L6"]) assert.ok(isNotCert(v), v);
  assert.ok(!isNotCert("정보처리기사"));
});
t("일정: 선택 자격은 상위 3개만, 나머지는 나중에, 올리면 들어간다", () => {
  const p = prof({ school: "4년제" }, { major: "컴퓨터공학" });
  const names = ["정보처리기사", "정보처리산업기사", "정보처리기능사", "리눅스마스터", "MCSE", "SCJP"];
  const req: Requirements = { worldId: "developer", certPolicy: "ai-filter", items: names.map((name) => item({ id: name, name, hours: { value: 100, grade: "assumed" } })), prep: [], majors: [], baseDate: "", stale: false };
  const rows = prioritize(gapItems(req, p, dev), dev, p, {});
  // 4년제면 기능사가 맨 뒤, 그 앞이 업체 자격
  assert.equal(rows.at(-1)!.item.name, "정보처리기능사");
  assert.deepEqual(rows.slice(-3, -1).map((r) => r.item.name).sort(), ["MCSE", "SCJP"]);
  assert.equal(rows[0].item.kind, "cert");
  const plan = buildPlan(rows, p, dev, 36, { weekly: 20 });
  assert.equal(plan.rows.length, 3);
  assert.equal(plan.later.length, 3);
  assert.ok(plan.later.some((r) => r.item.name === "MCSE"));
  const up = buildPlan(rows, p, dev, 36, { weekly: 20, added: ["MCSE"] });
  assert.equal(up.rows.length, 4);
  assert.equal(up.later.length, 2);
});
t("격차: 기술사는 신입 목록에서 빠지고 따로 보인다, 이미 가졌으면 있음", () => {
  const req: Requirements = { worldId: "developer", certPolicy: "ai-filter", items: [item({ id: "a", name: "컴퓨터시스템응용기술사" })], prep: [], majors: [], baseDate: "", stale: false };
  assert.equal(gapItems(req, prof(), dev).length, 0);
  assert.equal(laterCerts(req, prof(), dev).length, 1);
  assert.equal(gapItems(req, prof({ certs: ["컴퓨터시스템응용기술사"] }), dev)[0].status, "have");
  assert.equal(laterCerts(req, prof({ certs: ["컴퓨터시스템응용기술사"] }), dev).length, 0);
});
t("전문가급: 경력 없으면 신입 목록에서 빠지고, 공식 안내의 다른 길이 있으면 응시 가능", () => {
  const blocked = (name: string, spec = {}) => eligibilityOf(name, prof(spec), dev).status === "blocked";
  for (const n of ["데이터아키텍처전문가", "데이터아키텍처 전문가(DAP)", "정보기술프로젝트관리전문가", "소프트웨어 보안약점 진단원", "데이터 분석 전문가(ADP)", "데이터분석전문가"]) assert.ok(blocked(n), n);
  assert.ok(!blocked("데이터아키텍처전문가", { certs: ["SQL 개발자(SQLD)"] }));
  assert.ok(!blocked("데이터 분석 전문가(ADP)", { certs: ["ADsP"] }));
  assert.ok(blocked("SQL 전문가(SQLP)", { school: "전문대" }));
  assert.ok(!blocked("SQL 전문가(SQLP)", { school: "4년제" }));
  for (const n of ["데이터아키텍처 준전문가(DAsP)", "SQL 개발자(SQLD)", "데이터 분석 준전문가(ADsP)", "정보기술프로젝트관리사"]) assert.equal(eligibilityOf(n, prof(), dev).status, "open", n);
});
t("준전문가 후보: 전문가급이 있으면 출처와 함께 넣고 이미 있으면 안 겹친다", () => {
  const base: Requirements = { worldId: "x", certPolicy: "ai-filter", items: [item({ id: "a", name: "데이터아키텍처전문가" }), item({ id: "b", name: "SQL 개발자(SQLD)" })], prep: [], majors: [], baseDate: "", stale: false };
  const names = applyCertAlternatives(base).items.map((i) => i.name);
  assert.deepEqual(names, ["데이터아키텍처전문가", "SQL 개발자(SQLD)", "데이터아키텍처 준전문가(DAsP)"]);
  const added = applyCertAlternatives(base).items[2];
  assert.equal(added.grade, "curated");
  assert.ok(added.officialUrl?.includes("dataq.or.kr") && added.ref);
  assert.equal(applyCertAlternatives({ ...base, items: [item({ id: "c", name: "정보처리기사" })] }).items.length, 1);
});
t("신입 개발자 저장 목록: 전문가급은 빠지고 기사가 먼저, 전자계산기조직응용기사는 뒤로", () => {
  const f = JSON.parse(readFileSync("data/requirements/developer.json", "utf8")) as RequirementsFile;
  const p = prof({ school: "4년제" }, { major: "컴퓨터공학과" });
  const gaps = gapItems(f.default, p, dev);
  const rows = prioritize(gaps, dev, p, gapDeltas(p, dev, 36, "2026-12", gaps)).filter((r) => r.item.kind === "cert").map((r) => r.item.name);
  assert.deepEqual(rows.slice(0, 2), ["정보처리기사", "정보보안기사"]);
  assert.ok(rows.indexOf("SQL 개발자(SQLD)") < rows.indexOf("정보처리산업기사")); // 같은 이름 기사를 볼 수 있으면 산업기사는 뒤로
  assert.ok(rows.includes("전자계산기조직응용기사"));
  for (const n of ["SQL 개발자(SQLD)", "데이터아키텍처 준전문가(DAsP)", "리눅스마스터"]) assert.ok(rows.indexOf(n) < rows.indexOf("전자계산기조직응용기사"), n);
  for (const n of ["데이터아키텍처전문가", "정보기술프로젝트관리전문가", "소프트웨어 보안약점 진단원"]) assert.ok(!rows.includes(n), n);
  assert.ok(rows.indexOf("정보처리기능사") > rows.indexOf("전자계산기조직응용기사"));
});
t("전공이 달라도 정보처리기사는 막지 않고 확인을 부탁한다(2차 자료)", () => {
  assert.equal(eligibilityOf("정보처리기사", prof({ school: "4년제" }, { major: "경영학과" }), dev).status, "check");
  assert.equal(eligibilityOf("정보처리기사", prof({ school: "전문대" }, { major: "경영학과" }), dev).status, "blocked");
  assert.equal(eligibilityOf("정보보안기사", prof({ school: "4년제" }, { major: "경영학과" }), dev).status, "blocked");
});
t("신입 뒤에 익힐 능력은 격차에서 빠진다", () => {
  const req: Requirements = { worldId: "developer", certPolicy: "ai-filter", items: [item({ id: "s1", kind: "skill", name: "화면 구현", entry: true, positionLevel: 3 }), item({ id: "s2", kind: "skill", name: "요구사항 확인", entry: false, positionLevel: 7 })], prep: [], majors: [], baseDate: "", stale: false };
  assert.deepEqual(gapItems(req, prof(), dev).map((g) => g.item.id), ["s1"]);
  assert.deepEqual(laterSkills(req, dev).map((i) => i.id), ["s2"]);
});
t("대졸(예정)이면 응시할 수 있는 윗 등급이 있을 때 기능사는 맨 뒤, 고졸이거나 윗 등급이 없으면 그대로", () => {
  const list = (...names: string[]): Requirements => ({ worldId: "developer", certPolicy: "official", notes: [], items: names.map((name) => item({ id: name, name, kind: "cert" })) }) as unknown as Requirements;
  const order = (r: Requirements, p: Profile) => prioritize(gapItems(r, p, dev), dev, p, {}).filter((x) => x.item.kind === "cert").map((x) => x.item.name);
  const r = list("컴퓨터그래픽스운용기능사", "OCP", "정보보안산업기사");
  const college = { ...prof(), major: "컴퓨터공학", spec: { ...prof().spec, school: "전문대" as const, certs: [] } };
  assert.equal(order(r, college).at(-1), "컴퓨터그래픽스운용기능사");
  assert.equal(order(r, college)[0], "정보보안산업기사");
  // 고졸은 산업기사가 막혀 있고, 기능사가 업체 자격보다 앞이다
  assert.equal(order(r, { ...college, spec: { ...college.spec, school: "고졸" } })[0], "컴퓨터그래픽스운용기능사");
  // 윗 등급이 없는 진로(기능사가 입구)는 업체 자격보다 뒤로 안 민다
  assert.equal(order(list("컴퓨터그래픽스운용기능사", "OCP"), college)[0], "컴퓨터그래픽스운용기능사");
});
t("저장된 목록: 팀이 뺀 자격은 없고 걸러진 기록에 남는다, 개발자 상위 5개에 기능사 없음", () => {
  for (const [id, names] of Object.entries(certExclude)) {
    if (id.startsWith("_")) continue;
    const f = JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as RequirementsFile;
    for (const name of Object.keys(names)) {
      assert.ok(!f.default.items.some((i) => i.kind === "cert" && i.name === name), `${id}에 ${name}이 남음`);
      assert.ok(f.default.filter?.dropped.some((d) => d.name === name && d.why.startsWith("팀 검토")), `${id} 기록에 ${name} 없음`);
    }
  }
  const f = JSON.parse(readFileSync("data/requirements/developer.json", "utf8")) as RequirementsFile;
  const top = prioritize(gapItems(f.default, DEMO_PROFILE, dev), dev, DEMO_PROFILE, {}).slice(0, 5).map((x) => x.title);
  assert.ok(!top.some((x) => x.endsWith("기능사")), top.join(", "));
});
console.log(`${n}개 통과`);

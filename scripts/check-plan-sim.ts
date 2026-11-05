// 계획 넣고 다시 살아 보기 단위 테스트 + 시연 인물 표(AI·네트워크 없음).
import assert from "node:assert/strict";
import { DEMO_PROFILE } from "@/lib/demo";
import { simulatePath } from "@/lib/engine";
import { gapItems, prioritize, type PriorityRow } from "@/lib/gap";
import { gapDeltas } from "@/lib/gap-sim";
import { runAll, seedFor } from "@/lib/multiverse";
import { planHorizon, planInput, planRerun, planStages } from "@/lib/plan-sim";
import { readFileSync } from "node:fs";
import { majorFamily } from "@/lib/job-codes";
import type { RequirementsFile } from "@/lib/requirements";
import { buildPlan } from "@/lib/schedule";
import type { Profile } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const START = "2027-03";
const dev = getWorld("developer");
const cs = getWorld("civil-servant");
let n = 0;
const t = (name: string, f: () => void) => {
  f();
  n++;
  console.log("통과", name);
};
const withCert = (p: Profile, c: string): Profile => ({ ...p, spec: { ...p.spec, certs: [...p.spec.certs, c] } });
const hireRate = (months: number, month: number) => {
  const stages = [{ month, profile: withCert(DEMO_PROFILE, dev.certs[0]) }];
  return runAll(DEMO_PROFILE, dev, months, START, undefined, 1000, stages).filter((x) => x.employedAt !== null).length;
};

t("단계가 없으면 예전 경로와 같다", () => {
  const s = seedFor(DEMO_PROFILE, dev.id, 7);
  const a = simulatePath(DEMO_PROFILE, dev, 36, START, s);
  assert.deepEqual(simulatePath(DEMO_PROFILE, dev, 36, START, s, undefined, undefined, undefined, []), a);
  assert.deepEqual(simulatePath(DEMO_PROFILE, dev, 36, START, s, undefined, undefined, undefined, [{ month: 0, profile: DEMO_PROFILE }]), a);
});
t("같은 시드: 조건이 바뀌기 전에 끝난 일은 그대로다", () => {
  const before = runAll(DEMO_PROFILE, dev, 36, START, undefined, 300);
  const after = runAll(DEMO_PROFILE, dev, 36, START, undefined, 300, [{ month: 12, profile: withCert(DEMO_PROFILE, dev.certs[0]) }]);
  let early = 0;
  before.forEach((b, i) => {
    if (b.employedAt !== null && b.employedAt < 12) {
      early++;
      assert.equal(after[i].employedAt, b.employedAt);
    }
  });
  assert.ok(early > 0);
});
t("조건을 일찍 갖추면 늦게 갖출 때보다 낮지 않다", () => {
  assert.ok(hireRate(24, 1) >= hireRate(24, 20));
});
t("시험형: 공부 시간을 안 고치면 전후가 같고, 늘리면 오른다", () => {
  const step = { month: 3, title: "국어", item: { id: "k", kind: "exam", name: "국어", grade: "official", source: "t" } } as never;
  const input = { steps: [step], late: [], undated: [], weekly: 0 };
  const week = (w: number) => ({ ...input, weekly: w });
  const p = { ...DEMO_PROFILE, life: { ...DEMO_PROFILE.life, studyHours: 4, partTimeHours: 0 } };
  const same = planRerun(p, cs, 36, START, week(28), 400)!;
  assert.equal(same.before, same.after);
  assert.equal(planStages(p, cs, week(28)).stages.length, 0);
  const more = planRerun(p, cs, 36, START, week(56), 400)!;
  assert.ok(more.after > more.before, `${more.before} → ${more.after}`);
});
t("같은 조건은 한 번만, 이미 있는 자격은 안 넣는다", () => {
  const item = { id: "c", kind: "cert", name: dev.certs[0], grade: "official", source: "t" } as never;
  const p = withCert(DEMO_PROFILE, dev.certs[0]);
  assert.equal(planStages(p, dev, { steps: [{ month: 2, title: "a", item }], late: [], undated: [], weekly: 0 }).applied.length, 0);
  const q = { ...DEMO_PROFILE, spec: { ...DEMO_PROFILE.spec, certs: [] } };
  const r = planStages(q, dev, { steps: [{ month: 2, title: "a", item }, { month: 5, title: "b", item }], late: [], undated: [], weekly: q.life.studyHours * 7 - Math.round((q.life.partTimeHours / 7) * 0.8 * 7) });
  assert.equal(r.applied.length, 1);
  assert.deepEqual(r.notInSim, ["b"]);
});

console.log(`통과 ${n}개\n`);
console.log("진로 | 기간 | 전 → 후 | 넣은 조건 | 빠진 줄 | 시간(초)");
  for (const id of ["developer", "nurse", "civil-servant", "marketer", "teacher-elem"]) {
    const w = getWorld(id);
    const f = JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as RequirementsFile;
    const fam = majorFamily(DEMO_PROFILE.major);
    const req = (fam && f.byFamily?.[fam]) || f.default;
    const gaps = gapItems(req, DEMO_PROFILE, w);
    const rows: PriorityRow[] = prioritize(gaps, w, DEMO_PROFILE, gapDeltas(DEMO_PROFILE, w, 36, START, gaps));
    const plan = buildPlan(rows, DEMO_PROFILE, w, 36);
    const s = Date.now();
    const r = planRerun(DEMO_PROFILE, w, planHorizon(plan), START, planInput(plan, rows, w))!;
    console.log(`${id} | ${r.months}개월 | ${r.before}% → ${r.after}% | ${r.applied.map((a) => `${a.month}개월 ${a.label}`).join(", ") || "없음"} | 시뮬 밖 ${r.notInSim.length}·늦음 ${r.late.length}·시점 없음 ${r.undated.length} | ${((Date.now() - s) / 1000).toFixed(1)}`);
  }

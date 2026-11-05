// 시험 달 단위 테스트: 생활비 바닥이 시험을 없애지 않는지, 합격 기회 없는 불합격이 없는지, 시작 달에 안 흔들리는지.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-calendar.ts
import assert from "node:assert/strict";
import { DEMO_PROFILE } from "@/lib/demo";
import { runAll } from "@/lib/multiverse";
import { getWorld, WORLDS } from "@/lib/worlds";

let n = 0;
const t = (name: string, f: () => void) => {
  f();
  n++;
  console.log("통과", name);
};
const cs = getWorld("civil-servant");

t("생활비 바닥이 시험 달과 겹치면 시험을 먼저 보고 다음 달로 미룬다", () => {
  // 예시 인물은 16개월째에 돈이 바닥나고, 2027-03 시작이면 그 달이 7월(지방직)이다.
  const ps = runAll(DEMO_PROFILE, cs, 36, "2027-03", undefined, 300);
  let broke = 0;
  for (const p of ps) {
    for (const m of p.months) {
      if (m.event?.id !== "broke") continue;
      broke++;
      // 이미 합격했거나 다른 길로 간 사람은 그 달에 시험이 없으니 16개월째에 나도 된다.
      const before = p.months.slice(0, m.month).map((x) => x.event?.id ?? "");
      const noExam = before.some((id) => id.startsWith("exam-pass")) || p.months.some((x) => x.month < m.month && /다른 길|그만두/.test(x.status));
      if (m.month === 16) assert.ok(noExam, `시험 볼 사람이 시험 달에 생활비 바닥: ${before.filter(Boolean).join(",")}`);
    }
  }
  assert.ok(broke > 100, `생활비 바닥이 거의 안 났다: ${broke}`);
  const took = ps.filter((p) => /^exam-(fail|pass)/.test(p.months[16].event?.id ?? "")).length;
  assert.ok(took > 200, `16개월째 시험 본 사람 ${took}`);
});

t("모든 진로: 달력 있는 불합격은 같은 달·같은 시기에 합격 기회가 있다", () => {
  const bad: string[] = [];
  for (const w of WORLDS) {
    const gates = w.events.filter((e) => e.calendar && e.chance !== undefined);
    for (const f of gates.filter((e) => e.chance === 1)) {
      for (const cal of f.calendar!) {
        const can = gates.some((e) => (e.chance ?? 0) < 1 && e.calendar!.includes(cal) && (e.minMonth ?? 0) <= (f.minMonth ?? 0));
        if (!can) bad.push(`${w.id}:${f.id}:${cal}월`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

t("9급 3년 안: 시작 달 12개의 폭이 10%p 이하", () => {
  const v: number[] = [];
  for (let m = 1; m <= 12; m++) v.push(runAll(DEMO_PROFILE, cs, 36, `2027-${String(m).padStart(2, "0")}`).filter((p) => p.employedAt !== null).length / 10);
  console.log("  ", v.join(" "));
  assert.ok(Math.max(...v) - Math.min(...v) <= 10, v.join(" "));
});
console.log(`${n}개 통과`);

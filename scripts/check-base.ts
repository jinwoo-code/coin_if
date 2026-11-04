// 갈림길 기준 비율 검사: 보기가 2개 이상인 모든 갈림길에 기준 비율이 붙었는지, 한 갈림길(과 상황 칸마다)의 합이 1인지,
// 상황 키가 1~2개인지, 통계·인터뷰 값에 출처가 있는지, 성향이 모두 비교 집단 평균인 사람이 정확히 기준 비율대로 고르는지,
// 같은 입력이면 같은 인생이 나오는지. 하나라도 어긋나면 종료 코드 1.
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-base.ts
import norms from "../data/norms.json";
import { attachBase, baseShare } from "../lib/base";
import { choiceProbs, GLOBAL_EVENTS, simulatePath } from "../lib/engine";
import { normalizeProfile } from "../lib/profile";
import type { DepthMode, EventCard, LifeState } from "../lib/types";
import { WORLDS } from "../lib/worlds";

const EPS = 1e-9;
const errors: string[] = [];
let forks = 0;
const grades: Record<string, number> = { stat: 0, interview: 0, assumed: 0 };

function check(where: string, e: EventCard) {
  if (e.choices.length < 2) return;
  forks++;
  const bs = e.choices.map((c) => c.base);
  if (bs.some((b) => !b)) return void errors.push(`${where}: 기준 비율 없음`);
  const keys = e.stateKeys ?? [];
  if (keys.length < 1 || keys.length > 2) errors.push(`${where}: 상황 키 ${keys.length}개`);
  const sum = bs.reduce((s, b) => s + b!.share, 0);
  if (Math.abs(sum - 1) > EPS) errors.push(`${where}: 합 ${sum}`);
  for (const b of bs) {
    grades[b!.grade]++;
    if (b!.share <= 0) errors.push(`${where}: 0 이하 비율 ${b!.share}`);
    if (b!.grade !== "assumed" && !b!.ref) errors.push(`${where}: ${b!.grade} 값에 출처 없음`);
    if (b!.grade === "stat" && !b!.population) errors.push(`${where}: 통계 값에 대상 집단 없음`);
    if (b!.grade === "interview" && !b!.n) errors.push(`${where}: 현직자 인원(n) 없음`);
  }
  const buckets = new Set(bs.flatMap((b) => Object.keys(b!.byState ?? {})));
  for (const k of buckets) {
    const s = bs.reduce((acc, b) => acc + (b!.byState?.[k] ?? b!.share), 0);
    if (Math.abs(s - 1) > EPS) errors.push(`${where} [${k}]: 합 ${s}`);
  }
}

for (const w of WORLDS) for (const e of w.events) check(`${w.id}/${e.id}`, e);
for (const e of GLOBAL_EVENTS) check(`_global/${e.id}`, attachBase(e, "_global"));

// 비교 집단 평균 인물(성향 = norms 평균, 가치관 안 고름 = 기대값, 이야기·고친 선택 없음)은 기울기 0 → 기준 비율 그대로
let normChecks = 0;
for (const depthMode of ["quick", "standard", "deep", "ongoing"] as DepthMode[]) {
  const avg = normalizeProfile({ name: "평균", values: [], bigFive: norms.bigFive.mean, behavior: { ...norms.behavior.mean }, depthMode });
  for (const w of WORLDS)
    for (const e of w.events) {
      if (e.choices.length < 2) continue;
      for (const stress of [20, 50, 80]) {
        for (const bucket of new Set(["", ...e.choices.flatMap((c) => Object.keys(c.base?.byState ?? {}))])) {
          const base = e.choices.map((c) => baseShare(c.base, bucket)!);
          const pr = choiceProbs(
            avg,
            { skill: 50, stress, satisfaction: 50, relation: 50, money: 0 } as LifeState,
            e.choices.map((c) => c.tone),
            base,
          );
          normChecks++;
          if (pr.some((x, i) => Math.abs(x - base[i]) > EPS)) errors.push(`${w.id}/${e.id} [${bucket}] 스트레스 ${stress} ${depthMode}: 평균 인물 ${pr.map((x) => x.toFixed(4))} ≠ 기준 ${base}`);
        }
      }
    }
}

// 시드 고정: 같은 사람·진로·시드면 같은 인생
const someone = normalizeProfile({ name: "재현", values: ["성장", "돈", "자율", "인정"], bigFive: { O: 4.5, C: 2, E: 3, A: 3, N: 4 }, depthMode: "deep" });
for (const w of WORLDS.slice(0, 12)) {
  const a = simulatePath(someone, w, 120, "2026-11", `same:${w.id}`);
  const b = simulatePath(someone, w, 120, "2026-11", `same:${w.id}`);
  if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`${w.id}: 같은 시드인데 다른 인생`);
}

console.log(`평균 인물 = 기준 비율 확인 ${normChecks}건(깊이 4 × 스트레스 3 × 상황 칸)`);
console.log(`갈림길 ${forks}개(진로 ${WORLDS.length}개 + 공통 사건) · 보기 등급: 통계 ${grades.stat}, 현직자 ${grades.interview}, 가정값 ${grades.assumed}`);
if (errors.length) {
  console.log(`실패 ${errors.length}건\n${errors.slice(0, 30).join("\n")}`);
  process.exit(1);
}
console.log("통과: 모든 갈림길에 기준 비율이 있고 합이 1, 평균 인물은 기준 비율 그대로, 같은 시드면 같은 인생");

// 면허·교원 자격은 해당 학과·과정을 마쳐야 받는다. 전공이 안 맞으면 시뮬레이션 앞부분에 학과 다니는 기간을 넣는다.
// 기간은 data/weights.json retrain.months(가정값). 전공을 안 적었거나, 이미 준비 중이라고 직접 답했으면 넣지 않는다.
import type { Profile, WorldTemplate } from "./types";
import { WT } from "./weights";

export const RETRAIN_READINESS = ["license", "teaching"];

export function retrainMonths(p: Pick<Profile, "major" | "readiness">, world: Pick<WorldTemplate, "id" | "majors" | "readiness">): number {
  const months = WT("retrain.months")[world.id];
  if (!months) return 0;
  const m = (p.major ?? "").replace(/\s/g, "");
  if (!m || world.majors.some((k) => m.includes(k))) return 0;
  if (world.readiness.some((id) => RETRAIN_READINESS.includes(id) && (p.readiness?.[id] ?? 0) >= 1)) return 0;
  return months;
}

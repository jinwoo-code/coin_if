// 발표용 예시 인물(가상). 첫 화면의 '예시로 바로 보기'에서 쓴다. 값은 data/demo/에 있다.
import developer from "@/data/demo/developer.json";
import nurse from "@/data/demo/nurse.json";
import { nextMonthYm } from "./calendar";
import { normalizeProfile } from "./profile";
import type { Profile, Selection } from "./types";

type DemoFile = Partial<Profile> & { worldIds: string[]; months: number };
function profileOf(d: DemoFile) {
  const { worldIds: _w, months: _m, ...p } = d;
  return normalizeProfile(p as Parameters<typeof normalizeProfile>[0]);
}

export const DEMO_PROFILE = profileOf(developer as unknown as DemoFile);
export const NURSE_DEMO_PROFILE = profileOf(nurse as unknown as DemoFile);
export const DEMOS = {
  developer: { profile: DEMO_PROFILE, worldIds: developer.worldIds, months: developer.months },
  nurse: { profile: NURSE_DEMO_PROFILE, worldIds: nurse.worldIds, months: nurse.months },
};

export const demoSelection = (kind: keyof typeof DEMOS = "developer"): Selection => ({ worldIds: DEMOS[kind].worldIds, months: DEMOS[kind].months, startYm: nextMonthYm() });

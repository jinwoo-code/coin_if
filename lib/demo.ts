// 발표용 예시 인물(가상). 첫 화면의 '예시로 바로 보기'에서 쓴다. 값은 data/demo/에 있다.
import developer from "@/data/demo/developer.json";
import nurse from "@/data/demo/nurse.json";
import { nextMonthYm } from "./calendar";
import { normalizeProfile } from "./profile";
import type { Profile, Selection, Tone } from "./types";

// 시연에서 체크인을 끝까지 돌리려고 넣은 답. 가상 인물의 답이고 팀이 정한 값이다(실제 사람 답 아님).
export interface CheckinExample {
  picks: Record<string, number>;
  real: Tone | "none";
  mini: Record<string, number>;
}
type DemoFile = Partial<Profile> & { worldIds: string[]; months: number; checkinExample: CheckinExample };
function profileOf(d: DemoFile) {
  const { worldIds: _w, months: _m, checkinExample: _c, ...p } = d;
  return normalizeProfile(p as Parameters<typeof normalizeProfile>[0]);
}

export const DEMO_PROFILE = profileOf(developer as unknown as DemoFile);
export const NURSE_DEMO_PROFILE = profileOf(nurse as unknown as DemoFile);
export const DEMOS = {
  developer: { profile: DEMO_PROFILE, worldIds: developer.worldIds, months: developer.months, checkinExample: developer.checkinExample as CheckinExample },
  nurse: { profile: NURSE_DEMO_PROFILE, worldIds: nurse.worldIds, months: nurse.months, checkinExample: nurse.checkinExample as CheckinExample },
};

export const demoSelection = (kind: keyof typeof DEMOS = "developer"): Selection => ({ worldIds: DEMOS[kind].worldIds, months: DEMOS[kind].months, startYm: nextMonthYm() });

// 시연 인물인지(이름과 전공이 같으면). 로그인 없이 보는 발표 백업과, 무료 키에서 AI를 부를지 정할 때 쓴다.
export const isDemoPerson = (p: { name?: string; major?: string }) => Object.values(DEMOS).some((d) => d.profile.name === p.name && d.profile.major === p.major);

export const demoCheckinExample = (p: { name?: string; major?: string }) => Object.values(DEMOS).find((d) => d.profile.name === p.name && d.profile.major === p.major)?.checkinExample ?? null;
// 시연을 시작하는 때를 '검사를 끝낸 때'로 둔다. 체크인 날짜 계산에만 쓰여 결과에는 영향이 없다.
export const demoStart = (kind: keyof typeof DEMOS): Profile => ({ ...DEMOS[kind].profile, since: new Date().toISOString() });

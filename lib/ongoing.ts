// 계속 닮아 가기: 시뮬레이션 속 선택 고치기, 한 달 뒤 체크인. docs/검사-설계-근거.md '검사 깊이'.
// 고친 선택은 엔진(lib/engine.ts pushes)이 tone 무게에 조금씩 더한다. 체크인은 분신 점수의 기준선(본인 일치율)을 잰다.
import type { Checkin, Correction, Profile, Tone } from "./types";

export const CHECKIN_DAYS = 30;

export const TONE_WORD: Record<Tone, string> = { push: "밀어붙이는 쪽", change: "방향을 바꾸는 쪽", safe: "쉬거나 신중한 쪽" };

// 같은 사건을 다시 고치면 덮어쓴다. 엔진이 고른 쪽과 같은 걸 고르면 고친 걸 지운다.
export function withCorrection(p: Profile, c: Omit<Correction, "at">): Profile {
  const rest = p.corrections.filter((x) => x.eventId !== c.eventId);
  if (c.from === c.to) return { ...p, corrections: rest };
  return { ...p, corrections: [...rest, { ...c, at: new Date().toISOString() }] };
}

// 다음 체크인까지 남은 날(0 이하면 할 때가 됨). 기준: 마지막 체크인, 없으면 검사를 끝낸 때.
export function daysToCheckin(p: Profile, now = Date.now()): number | null {
  const from = p.checkins.filter((c) => !c.demo).at(-1)?.at ?? p.since;
  if (!from) return null;
  return Math.ceil((new Date(from).getTime() + CHECKIN_DAYS * 864e5 - now) / 864e5);
}

// 본인 일치율: 체크인에서 다시 고른 답이 처음 답과 같은 개수
export function selfAgreement(p: Profile, c: Checkin) {
  const ids = Object.keys(c.picks).filter((id) => p.holdoutPicks[id] !== undefined);
  return { n: ids.length, same: ids.filter((id) => c.picks[id] === p.holdoutPicks[id]).length };
}

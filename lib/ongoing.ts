// 계속 닮아 가기: 시뮬레이션 속 선택 고치기, 한 달 뒤 체크인. docs/검사-설계-근거.md '검사 깊이'.
// 고친 선택은 엔진(lib/engine.ts pushes)이 tone 무게에 조금씩 더한다. 체크인은 분신 점수의 기준선(본인 일치율)을 잰다.
import { scoreBfi } from "./bfi";
import type { BigFive, Checkin, Correction, Profile, Tone } from "./types";

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

// 체크인에서 다시 답한 성격 10문항. 같은 10문항끼리 비교한다(50문항을 했어도 그 값과 바로 빼면 도구 차이가 섞인다). 예전 답이 없으면 지금 값과 비교한다.
const B5_LABEL: Record<keyof BigFive, string> = { O: "개방성", C: "성실성", E: "외향성", A: "친화성", N: "신경성" };
const beforeOf = (p: Profile) => (Object.keys(p.answers.bfi10 ?? {}).length ? scoreBfi(p.answers.bfi10!) : p.bigFive);
export function bigFiveDiff(p: Profile, bfi10: Record<number, number>) {
  const before = beforeOf(p);
  const after = scoreBfi(bfi10);
  return (Object.keys(B5_LABEL) as (keyof BigFive)[]).map((key) => ({ key, label: B5_LABEL[key], before: before[key], after: after[key] }));
}

// 사용자가 '바꾸기'를 눌렀을 때만. 지금 값에 10문항의 차이만큼 더한다(1~5). 다음 비교 기준도 새 답이 된다.
export function withNewBigFive(p: Profile, bfi10: Record<number, number>): Profile {
  const next = { ...p.bigFive };
  for (const d of bigFiveDiff(p, bfi10)) next[d.key] = Math.round(Math.min(5, Math.max(1, p.bigFive[d.key] + d.after - d.before)) * 10) / 10;
  return { ...p, bigFive: next, answers: { ...p.answers, bfi10 } };
}

// 체크인 메일: 본인이 켰고 때가 됐고, 이번 차례에 아직 안 보냈을 때. ref는 차례 이름(마지막 체크인 또는 검사 끝낸 때)이라 체크인을 하면 다음 차례로 넘어간다.
export function checkinMailRef(p: Profile, now = Date.now()): string | null {
  if (!p.checkinMail) return null;
  const days = daysToCheckin(p, now);
  if (days === null || days > 0) return null;
  return `checkin:${(p.checkins.filter((c) => !c.demo).at(-1)?.at ?? p.since ?? "").slice(0, 10)}`;
}

// 분신 채점: 따로 떼어 둔 상황 질문(holdoutPicks)에서 분신이 내 답을 맞히는지 잰다. docs/검사-설계-근거.md '닮은 정도 측정'.
// 분신 = 시뮬레이션에서 '나'의 선택을 정하는 엔진 규칙(lib/engine.ts decide). 채점용 답은 성향 점수에 안 들어가서 미리 본 답이 아니다.
import { toneProbs } from "./engine";
import { SJT } from "./tests";
import type { LifeState, Profile } from "./types";

// 지치지도 여유롭지도 않은 평소 상태(스트레스 50이면 상태에서 오는 끌림이 0)
export const CALM: LifeState = { skill: 50, stress: 50, satisfaction: 50, relation: 50, money: 0 };

export interface TwinItem {
  id: string;
  text: string;
  options: string[];
  probs: number[]; // 분신이 각 보기를 고를 확률
  pick: number; // 내가 고른 보기
  guess: number; // 분신이 가장 고를 것 같은 보기
}

export interface TwinScore {
  n: number;
  hits: number; // 분신이 가장 고를 것 같은 보기 = 내 답
  chanceHits: number; // 아무거나 찍었을 때 기대하는 맞힌 개수
  brier: number; // 브라이어 점수(0~2, 낮을수록 잘 맞힘)
  chanceBrier: number; // 똑같은 확률로 찍었을 때
  items: TwinItem[];
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function twinScore(p: Profile): TwinScore | null {
  const items: TwinItem[] = [];
  for (const q of SJT) {
    const pick = p.holdoutPicks[q.id];
    if (pick === undefined || !q.options[pick]) continue;
    const probs = toneProbs(
      p,
      CALM,
      q.options.map((o) => o.tone),
    );
    // 같은 tone 보기가 둘이면 확률이 같다. 내 답이 가장 높은 확률과 같으면 분신도 그걸 고른 것으로 본다.
    const top = Math.max(...probs);
    const guess = probs[pick] >= top - 1e-9 ? pick : probs.indexOf(top);
    items.push({ id: q.id, text: q.text, options: q.options.map((o) => o.text), probs, pick, guess });
  }
  if (!items.length) return null;
  const hit = (it: TwinItem) => it.guess === it.pick;
  const brierOf = (it: TwinItem) => it.probs.reduce((s, q, i) => s + (q - (i === it.pick ? 1 : 0)) ** 2, 0);
  const chanceBrierOf = (k: number) => 1 - 1 / k;
  return {
    n: items.length,
    hits: items.filter(hit).length,
    chanceHits: round(
      items.reduce((s, it) => s + 1 / it.options.length, 0),
      1,
    ),
    brier: round(items.reduce((s, it) => s + brierOf(it), 0) / items.length),
    chanceBrier: round(items.reduce((s, it) => s + chanceBrierOf(it.options.length), 0) / items.length),
    items,
  };
}

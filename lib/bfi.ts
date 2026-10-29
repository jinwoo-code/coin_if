// 성격 검사 BFI-10 (Rammstedt & John, 2007). 10문항으로 성격 5요인을 잰다.
// reverse가 true인 문항은 점수를 뒤집는다(6 - 응답).
import type { BigFive } from "./types";

export const BFI_ITEMS: { id: number; text: string; trait: keyof BigFive; reverse: boolean }[] = [
  { id: 1, text: "나는 내성적인 편이다", trait: "E", reverse: true },
  { id: 2, text: "나는 대체로 남을 잘 믿는다", trait: "A", reverse: false },
  { id: 3, text: "나는 게으른 편이다", trait: "C", reverse: true },
  { id: 4, text: "나는 느긋하고 스트레스를 잘 다룬다", trait: "N", reverse: true },
  { id: 5, text: "나는 예술에 별 관심이 없다", trait: "O", reverse: true },
  { id: 6, text: "나는 사교적이고 외향적이다", trait: "E", reverse: false },
  { id: 7, text: "나는 남의 흠을 잘 잡는 편이다", trait: "A", reverse: true },
  { id: 8, text: "나는 일을 철저하게 하는 편이다", trait: "C", reverse: false },
  { id: 9, text: "나는 쉽게 긴장한다", trait: "N", reverse: false },
  { id: 10, text: "나는 상상력이 풍부하다", trait: "O", reverse: false },
];

export function scoreBfi(answers: Record<number, number>): BigFive {
  const sums: Record<keyof BigFive, number[]> = { O: [], C: [], E: [], A: [], N: [] };
  BFI_ITEMS.forEach((item) => {
    const raw = answers[item.id] ?? 3;
    sums[item.trait].push(item.reverse ? 6 - raw : raw);
  });
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  return { O: avg(sums.O), C: avg(sums.C), E: avg(sums.E), A: avg(sums.A), N: avg(sums.N) };
}

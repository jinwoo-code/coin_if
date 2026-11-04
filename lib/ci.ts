// 95% 신뢰구간(Wilson 방식). 1,000번 살아본 비율이 '진짜 확률'에서 얼마나 흔들릴 수 있는지(표본 오차만, 모델이 틀릴 가능성은 아님).
// pct: 비율(%), n: 살아본 횟수. 돌려주는 값도 %(정수).
export function wilson(pct: number, n: number): [number, number] {
  if (!n) return [0, 100];
  const z = 1.96;
  const p = Math.min(1, Math.max(0, pct / 100));
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, Math.round((c - h) * 100)), Math.min(100, Math.round((c + h) * 100))];
}

// 숫자에 쉼표(1,000)
export const times = (n: number) => n.toLocaleString("ko-KR");

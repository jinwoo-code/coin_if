// AI 단가. 가격이 바뀌면 이 파일만 고친다. usage_logs.cost_krw와 scripts/cost-report.ts가 여기서 계산한다.
// 출처: Gemini API 가격표(유료 Standard, 1M 토큰당 USD, 출력에는 생각 토큰 포함) https://ai.google.dev/gemini-api/docs/pricing (2026-11-02 확인)

export const KRW_PER_USD = 1400; // 가정값(환율). 바꾸면 원가가 같이 바뀐다.

export const PRICES: Record<string, { input: number; output: number; note: string }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5, note: "공식 가격표" },
  // 공식 가격표에 3.5 Flash가 없다(2026-11-02). 2차 출처 값을 가정값으로 둔다.
  "gemini-3.5-flash": { input: 1.5, output: 9.0, note: "가정값(공식 표에 없음)" },
  "gemini-3.6-flash": { input: 0.75, output: 3.75, note: "공식 가격표(2026-12-31까지, 2027-01-01부터 1.50/7.50)" },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4, note: "공식 가격표" },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, note: "공식 가격표" },
};

// 모르는 모델이면 null(원가를 지어내지 않는다).
export function costKrw(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return ((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * KRW_PER_USD;
}

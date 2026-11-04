// AI 분신 판단 응답 검사와 재요청(app/api/judge). AI 호출을 인자로 받아서 가짜 응답으로 시험할 수 있다(scripts/check-judge.ts).

// 그 보기를 안 고르는 이유·망설임이 섞인 표현
export const NEGATIVE = /망설|하지 않|안 할/;

export interface JudgeParsed {
  probs: Record<string, number[]>; // 상황 칸별, 보기 순서대로(합 1)
  reasons: string[]; // 보기 순서대로. 없거나 길거나 부정 표현이면 빈 문자열
  shift: string;
  rejected: number; // 부정 표현으로 비운 이유 수
}

// 상황 칸마다 모든 보기에 0 이상 숫자, 합이 0보다 크면 합 1로 정규화. 이유는 보기마다 50자 이내 문자열.
export function parseJudge(raw: unknown, ids: string[], buckets: string[]): JudgeParsed {
  const r = (raw ?? {}) as { probs?: Record<string, Record<string, unknown>>; reasons?: Record<string, unknown>; shift?: unknown };
  const probs: Record<string, number[]> = {};
  for (const b of buckets) {
    const row = r.probs?.[b];
    const xs = ids.map((id) => Number(row?.[id]));
    const sum = xs.reduce((a, c) => a + c, 0);
    if (xs.every((x) => Number.isFinite(x) && x >= 0) && sum > 0) probs[b] = xs.map((x) => x / sum);
  }
  let rejected = 0;
  const reasons = ids.map((id) => {
    const t = r.reasons?.[id];
    if (typeof t !== "string" || !t.trim() || t.trim().length > 50) return "";
    if (NEGATIVE.test(t)) {
      rejected++;
      return "";
    }
    return t.trim();
  });
  const shift = typeof r.shift === "string" && r.shift.trim().length <= 80 ? r.shift.trim() : "";
  return { probs, reasons, shift, rejected };
}

// 확률 형식이 틀리거나 이유에 부정 표현이 있으면 한 번 더 묻는다. 두 번째에도 부정 표현이면 그 이유는 비운다(규칙 이유로).
// 길이만 틀린 이유는 다시 묻지 않는다. ask가 null이면 모든 모델 실패(한도 등).
export async function askJudge(ask: () => Promise<unknown>, ids: string[], buckets: string[]) {
  let got: JudgeParsed = { probs: {}, reasons: ids.map(() => ""), shift: "", rejected: 0 };
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await ask();
    calls++;
    if (raw === null) break;
    const next = parseJudge(raw, ids, buckets);
    got = { probs: { ...got.probs, ...next.probs }, reasons: ids.map((_, i) => next.reasons[i] || got.reasons[i]), shift: next.shift || got.shift, rejected: next.rejected };
    if (buckets.every((b) => got.probs[b]) && !next.rejected) break;
  }
  return { ...got, calls };
}

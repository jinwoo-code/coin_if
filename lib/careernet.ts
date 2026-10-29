// 커리어넷 심리검사 Open API 연결(서버 전용). 키는 .env.local의 CAREERNET_KEY에만 둔다.
// 대학생·일반이 받을 수 있는 검사 중 '직업가치관검사'(qestrnSeq 6, 28문항 쌍비교)만 쓴다.
// - 직업흥미검사는 중·고등학생용만 있어서 쓰지 않는다(2026-10-29 실제 호출로 확인).
// - 결과 API는 점수가 아니라 결과 번호와 커리어넷 결과 페이지 URL만 준다. 그래서 링크로 보여 준다.
// 키가 없거나 호출이 실패하면 null을 돌려줘서 앱이 멈추지 않게 한다.
// 문서: https://www.career.go.kr/cnet/front/openapi/openApiTestCenter.do (심리검사 v1)

const BASE = "https://www.career.go.kr/inspct/openapi/test";
const VALUES_Q = "6";
const KEY = process.env.CAREERNET_KEY;

// 문서의 코드표
const GENDER = { 남: "100323", 여: "100324" } as const;
const TARGET = { 대학생: "100208", 일반: "100209" } as const;

export function hasCareernet() {
  return Boolean(KEY);
}

export interface ValueChoice {
  label: string; // 가치 이름(예: 능력발휘)
  desc: string; // 가치 설명
  score: string; // 제출할 값
}

export interface ValueItem {
  no: number;
  a: ValueChoice;
  b: ValueChoice;
}

interface RawQuestion {
  qitemNo: number;
  answer01: string | null;
  answer02: string | null;
  answer03: string | null;
  answer04: string | null;
  answerScore01: string | null;
  answerScore02: string | null;
}

// 문항 응답은 { SUCC_YN, ERROR_REASON, RESULT: [...] }. 보기 1·2가 가치 이름, 3·4가 그 설명이다.
export async function valueQuestions(): Promise<ValueItem[] | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/questions?apikey=${encodeURIComponent(KEY)}&q=${VALUES_Q}`, { next: { revalidate: 3600 * 24 } } as RequestInit);
    const body = await res.json();
    if (body?.SUCC_YN !== "Y" || !Array.isArray(body.RESULT)) throw new Error(body?.ERROR_REASON || `HTTP ${res.status}`);
    const items = (body.RESULT as RawQuestion[]).map((q) => ({
      no: Number(q.qitemNo),
      a: { label: q.answer01 ?? "", desc: q.answer03 ?? "", score: q.answerScore01 ?? "" },
      b: { label: q.answer02 ?? "", desc: q.answer04 ?? "", score: q.answerScore02 ?? "" },
    }));
    if (!items.length || items.some((i) => !i.a.label || !i.b.label || !i.a.score || !i.b.score)) throw new Error("문항 형식이 문서와 달라요");
    return items;
  } catch (err) {
    console.error("[커리어넷 실패] 가치관검사 문항", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface ValuesSubmit {
  answers: Record<string, string>; // 문항 번호 → 고른 보기의 score
  gender: keyof typeof GENDER;
  target: keyof typeof TARGET;
  grade: string;
  startedAt: number; // 검사 시작 시각(ms)
}

// 결과 응답은 { SUCC_YN, ERROR_REASON, RESULT: { inspctSeq, url } }
export async function submitValues(input: ValuesSubmit): Promise<{ seq: number; url: string } | null> {
  if (!KEY) return null;
  const items = await valueQuestions();
  if (!items) return null;
  // 보기에 있는 값만 보낸다(문서: 문항 결과에 표시된 보기 중에서만 선택)
  const parts = items.map((i) => {
    const v = input.answers[String(i.no)];
    return v === i.a.score || v === i.b.score ? `B${i.no}=${v}` : null;
  });
  if (parts.some((p) => p === null)) return null;
  try {
    const res = await fetch(`${BASE}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: KEY,
        qestrnSeq: VALUES_Q,
        trgetSe: TARGET[input.target],
        gender: GENDER[input.gender],
        grade: input.grade,
        startDtm: input.startedAt,
        answers: parts.join(" "),
      }),
      cache: "no-store",
    });
    const body = await res.json();
    const r = body?.RESULT;
    if (body?.SUCC_YN !== "Y" || !r?.url) throw new Error(body?.ERROR_REASON || `HTTP ${res.status}`);
    return { seq: Number(r.inspctSeq), url: String(r.url) };
  } catch (err) {
    console.error("[커리어넷 실패] 가치관검사 제출", err instanceof Error ? err.message : err);
    return null;
  }
}

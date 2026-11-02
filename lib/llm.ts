// Gemini 호출을 한곳에 모은 파일. 서버(API 라우트)에서만 import한다.
// GEMINI_API_KEY가 없으면 hasLLM()이 false가 되고, 각 API는 목업 결과를 돌려준다.
import { GoogleGenAI } from "@google/genai";
import { costKrw } from "./pricing";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

// 모델 순서. 앞 모델이 한도(429)에 걸리거나 응답이 없으면 같은 프롬프트·설정으로 다음 모델을 쓴다(무료 등급 키는 모델마다 하루 20회).
// 세 모델 모두 생각 최소(minimal)에서 1~2초, 생각 토큰 0으로 답한다(2026-11-02 확인).
// 3.8 Flash는 minimal을 거부(400)하고 다른 설정에선 25초 넘게 응답이 없어 넣지 않는다. 2.5 계열은 새 키에서 404.
const chain = (first: string | undefined, rest: string[]) => Array.from(new Set([first, ...rest].filter((m): m is string => Boolean(m))));
export const MODELS = {
  // 주변 인물·사건 서술처럼 양이 많은 일: 저렴한 모델부터
  fast: chain(process.env.GEMINI_FAST_MODEL, ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"]),
  // '그때의 나' 대화, 리포트처럼 품질이 중요한 일
  smart: chain(process.env.GEMINI_SMART_MODEL, ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]),
};

// 한도에 걸렸거나 응답이 없던 모델은 잠시 건너뛴다(서버가 켜져 있는 동안만 기억).
const TIMEOUT_MS = 30_000;
const resting = new Map<string, number>();
function restFor(model: string, err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  let ms = 0;
  if (/"code":\s*429|RESOURCE_EXHAUSTED/.test(msg)) {
    const m = msg.match(/retry in (?:(\d+)m)?([\d.]+)s/);
    ms = m ? (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 : 60_000;
    if (/PerDay/.test(msg)) ms = Math.max(ms, 30 * 60_000); // 하루 한도면 30분은 다시 묻지 않는다
  } else if (/"code":\s*404|NOT_FOUND/.test(msg)) ms = 6 * 3600_000;
  else if ((err as Error)?.name === "TimeoutError" || /timed? ?out|abort/i.test(msg)) ms = 10 * 60_000;
  if (ms) resting.set(model, Date.now() + ms);
  return ms;
}

// 생각(thinking)은 끈다. 이미 정해진 결과를 문장으로 쓰는 일이라 필요 없고, 생각 토큰도 출력 요금이 붙는다.
// 3 계열은 thinkingBudget: 0을 거부해서(400) thinkingLevel "minimal"을 쓴다.
function thinkingOff(model: string) {
  return /^gemini-[3-9]/.test(model) ? { thinkingLevel: "minimal" } : { thinkingBudget: 0 };
}

export function hasLLM(): boolean {
  return client !== null;
}

type Usage = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };

// 누가(로그인했으면) 어느 대학 소속으로 불렀는지. AI 호출과 동시에 찾는다.
// 스크립트처럼 요청 밖에서 부르거나 Supabase 키가 없으면 null(기록은 콘솔에만).
async function caller(): Promise<{ userId: string | null; orgId: string | null } | null> {
  try {
    const { currentUser } = await import("./supabase/server");
    const { supabaseAdmin } = await import("./supabase/admin");
    const admin = supabaseAdmin();
    if (!admin) return null;
    const user = await currentUser().catch(() => null);
    if (!user) return { userId: null, orgId: null };
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("memberships")
      .select("org_id, organizations!inner(contract_start, contract_end)")
      .eq("user_id", user.id)
      .lte("organizations.contract_start", today)
      .gte("organizations.contract_end", today)
      .limit(1)
      .maybeSingle();
    return { userId: user.id, orgId: data?.org_id ?? null };
  } catch {
    return null;
  }
}

// 토큰 사용량을 콘솔과 usage_logs에 남긴다(원가 실측). 생각 토큰도 출력 요금이라 같이 센다. 실패해도 응답은 막지 않는다.
async function logUsage(tag: string, model: string, usage: Usage | undefined, who: Promise<Awaited<ReturnType<typeof caller>>>) {
  if (!usage) return;
  const input = usage.promptTokenCount ?? 0;
  const output = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const krw = costKrw(model, input, output);
  console.log(`[토큰] ${tag} ${model} 입력 ${input} / 출력 ${output}${krw === null ? " (단가 없음)" : ` ≈ ${krw.toFixed(2)}원`}`);
  const w = await who;
  if (!w) return;
  try {
    const { supabaseAdmin } = await import("./supabase/admin");
    const { error } = await supabaseAdmin()!
      .from("usage_logs")
      .insert({ user_id: w.userId, org_id: w.orgId, feature: tag.split(" ")[0], model, input_tokens: input, output_tokens: output, cost_krw: krw ?? 0 });
    if (error) console.error("[이용 기록 실패]", error.message);
  } catch (e) {
    console.error("[이용 기록 실패]", (e as Error).message);
  }
}

// JSON으로 답을 받는다. 실패하면 fallback을 돌려줘서 데모가 멈추지 않게 한다.
export async function generateJSON<T>(opts: {
  tag: string;
  model: keyof typeof MODELS;
  system: string;
  prompt: string;
  fallback: () => T;
}): Promise<T> {
  if (!client) return opts.fallback();
  const who = caller();
  const now = Date.now();
  const models = MODELS[opts.model].filter((m) => (resting.get(m) ?? 0) <= now);
  for (const model of models.length ? models : MODELS[opts.model].slice(0, 1)) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          temperature: 0.8,
          thinkingConfig: thinkingOff(model) as never,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      await logUsage(opts.tag, model, res.usageMetadata, who);
      return JSON.parse(res.text ?? "") as T;
    } catch (err) {
      const rest = restFor(model, err);
      console.error(`[LLM 실패] ${opts.tag} ${model}${rest ? ` → ${Math.round(rest / 60_000)}분 쉬고 다음 모델` : " → 다음 모델"}`, String((err as Error)?.message ?? err).slice(0, 200));
    }
  }
  console.error(`[LLM 실패] ${opts.tag} 모든 모델 실패 → 목업 문장`);
  return opts.fallback();
}

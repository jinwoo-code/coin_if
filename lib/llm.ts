// Gemini 호출을 한곳에 모은 파일. 서버(API 라우트)에서만 import한다.
// GEMINI_API_KEY가 없으면 hasLLM()이 false가 되고, 각 API는 목업 결과를 돌려준다.
import { GoogleGenAI } from "@google/genai";
import { costKrw } from "./pricing";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

// 2.5 계열은 2026-11 기준 새 키로는 404("no longer available to new users")라서 3.5 계열을 쓴다.
export const MODELS = {
  // 주변 인물·사건 서술처럼 양이 많은 일: 저렴한 모델
  fast: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
  // '그때의 나' 대화, 리포트처럼 품질이 중요한 일
  smart: process.env.GEMINI_SMART_MODEL || "gemini-3.5-flash",
};

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
  try {
    const res = await client.models.generateContent({
      model: MODELS[opts.model],
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        temperature: 0.8,
        thinkingConfig: thinkingOff(MODELS[opts.model]) as never,
      },
    });
    await logUsage(opts.tag, MODELS[opts.model], res.usageMetadata, who);
    const text = res.text ?? "";
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(`[LLM 실패] ${opts.tag}`, err);
    return opts.fallback();
  }
}

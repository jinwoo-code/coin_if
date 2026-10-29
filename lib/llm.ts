// Gemini 호출을 한곳에 모은 파일. 서버(API 라우트)에서만 import한다.
// GEMINI_API_KEY가 없으면 hasLLM()이 false가 되고, 각 API는 목업 결과를 돌려준다.
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const MODELS = {
  // 주변 인물·사건 서술처럼 양이 많은 일: 저렴한 모델
  fast: process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash-lite",
  // '그때의 나' 대화, 리포트처럼 품질이 중요한 일
  smart: process.env.GEMINI_SMART_MODEL || "gemini-2.5-flash",
};

export function hasLLM(): boolean {
  return client !== null;
}

// 토큰 사용량을 서버 로그에 남겨 회당 원가를 잴 수 있게 한다.
function logUsage(tag: string, usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined) {
  if (!usage) return;
  console.log(`[토큰] ${tag} 입력 ${usage.promptTokenCount ?? 0} / 출력 ${usage.candidatesTokenCount ?? 0}`);
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
  try {
    const res = await client.models.generateContent({
      model: MODELS[opts.model],
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    logUsage(opts.tag, res.usageMetadata);
    const text = res.text ?? "";
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(`[LLM 실패] ${opts.tag}`, err);
    return opts.fallback();
  }
}

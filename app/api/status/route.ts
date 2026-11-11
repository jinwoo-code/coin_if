// 화면에서 '목업 모드' 표시를 할지 확인하는 용도
import { NextResponse } from "next/server";
import { geminiTier, llmOn, MODELS } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ llm: await llmOn(), models: MODELS, tier: geminiTier() });
}

// 화면에서 '목업 모드' 표시를 할지 확인하는 용도
import { NextResponse } from "next/server";
import { hasLLM, MODELS } from "@/lib/llm";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ llm: hasLLM(), models: MODELS });
}

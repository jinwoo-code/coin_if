// 매직링크·Google 로그인에서 돌아오는 곳. 코드를 세션으로 바꾸고 동의 화면으로 보낸다.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const sb = supabaseServer();
  if (!sb || !code) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[로그인 실패]", error.message);
    return NextResponse.redirect(new URL("/login?error=1", url.origin));
  }
  return NextResponse.redirect(new URL("/welcome", url.origin));
}

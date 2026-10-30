// 수집·이용 동의 기록. 로그인한 본인의 프로필 행에만 쓴다(RLS).
import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  const { error } = await sb
    .from("profiles")
    .upsert({ user_id: user.id, consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION }, { onConflict: "user_id" });
  if (error) {
    console.error("[동의 저장 실패]", error.message);
    return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

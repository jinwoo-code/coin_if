// 수집·이용 동의 기록. 로그인한 본인의 프로필 행에만 쓴다(RLS).
import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  // 프로필 행은 가입할 때 DB 트리거가 만든다. upsert(=insert)는 RLS에 insert 정책이 없어서 막히므로 update만 한다.
  const { data, error } = await sb
    .from("profiles")
    .update({ consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION })
    .eq("user_id", user.id)
    .select("user_id");
  if (error || !data?.length) {
    console.error("[동의 저장 실패]", error?.message ?? "프로필 행 없음(가입 트리거 확인)");
    return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

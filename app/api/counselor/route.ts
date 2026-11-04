// 상담사 화면. 내가 counselor인 대학의 학생 중 본인이 '보여 주기'를 켠 사람만 counselor_students로 받는다.
import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/flags";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!FLAGS.counselor) return NextResponse.json({ error: "지금은 꺼져 있어요" }, { status: 404 });
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { data: m } = await sb.from("memberships").select("org_id").eq("user_id", user.id).eq("role", "counselor").limit(1).maybeSingle();
  if (!m) return NextResponse.json({ error: "상담 선생님 계정만 볼 수 있어요." }, { status: 403 });
  const { data, error } = await sb.rpc("counselor_students", { p_org: m.org_id });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "상담 선생님 계정만 볼 수 있어요." : "불러오지 못했어요." }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json({ students: data });
}

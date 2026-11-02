// 대학 관리자 집계. 내가 admin인 대학을 찾고 org_stats(함수 안에서 admin 확인, 5명 미만 항목 숨김)만 부른다.
// 관리자도 학생 개인 행은 받지 않는다.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { data: m } = await sb.from("memberships").select("org_id").eq("user_id", user.id).eq("role", "admin").limit(1).maybeSingle();
  if (!m) return NextResponse.json({ error: "대학 관리자만 볼 수 있어요." }, { status: 403 });
  const { data, error } = await sb.rpc("org_stats", { p_org: m.org_id });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "대학 관리자만 볼 수 있어요." : "집계를 불러오지 못했어요." }, { status: error.code === "42501" ? 403 : 500 });
  // 1명당 AI 비용은 이번 달 실제로 AI를 쓴 사람 수로 나눈다(가입만 한 학생·가상 학생으로 나누면 작아 보인다).
  // org_stats가 admin을 확인한 뒤에만 여기 온다. 사람 수만 세고 누구인지는 돌려주지 않는다.
  if (!data.hidden && data.cost?.calls) {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const { data: rows } = await supabaseAdmin()!.from("usage_logs").select("user_id").eq("org_id", m.org_id).gte("created_at", month.toISOString()).not("user_id", "is", null);
    data.cost.users = new Set((rows ?? []).map((r) => r.user_id)).size;
  }
  return NextResponse.json(data);
}

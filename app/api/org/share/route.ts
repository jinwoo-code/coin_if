// 상담 선생님에게 내 요약 보여 주기(본인 행만, RLS). 소속 대학이 하나라고 보고 첫 소속으로 켠다.
import { NextResponse } from "next/server";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function orgOf() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return null;
  const { data } = await sb.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  return data ? { sb, userId: user.id, orgId: data.org_id as string } : null;
}

export async function GET() {
  const me = await orgOf();
  if (!me) return NextResponse.json({ on: false });
  const { data, error } = await me.sb.from("counsel_shares").select("org_id").eq("student_id", me.userId).eq("org_id", me.orgId).maybeSingle();
  if (error) return NextResponse.json({ error: "불러오지 못했어요" }, { status: 503 });
  return NextResponse.json({ on: Boolean(data) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { on?: boolean } | null;
  if (typeof body?.on !== "boolean") return NextResponse.json({ error: "입력이 없어요" }, { status: 400 });
  const me = await orgOf();
  if (!me) return NextResponse.json({ error: "학교 소속이 아니에요" }, { status: 403 });
  const q = me.sb.from("counsel_shares");
  const { error } = body.on ? await q.upsert({ student_id: me.userId, org_id: me.orgId }) : await q.delete().eq("student_id", me.userId).eq("org_id", me.orgId);
  if (error) return NextResponse.json({ error: "바꾸지 못했어요" }, { status: 503 });
  return NextResponse.json({ on: body.on });
}

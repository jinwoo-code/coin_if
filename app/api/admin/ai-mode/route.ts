// 전체 목업 스위치. 보기는 로그인한 관리자만(다른 사람에게는 버튼을 안 보인다), 바꾸기도 대학 관리자(memberships.role = admin)만.
import { NextResponse } from "next/server";
import { readAiSwitch, setAiOff } from "@/lib/ai-switch";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function admin() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return null;
  const { data } = await sb.from("memberships").select("org_id").eq("user_id", user.id).eq("role", "admin").limit(1).maybeSingle();
  return data ? user : null;
}

export async function GET() {
  const user = await admin();
  if (!user) return NextResponse.json({ canEdit: false });
  return NextResponse.json({ canEdit: true, ...(await readAiSwitch()) });
}

export async function POST(req: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "관리자만 바꿀 수 있어요." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.off !== "boolean") return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const ok = await setAiOff(body.off, user.id);
  if (!ok) return NextResponse.json({ error: "저장하지 못했어요. 0008(app_settings)을 SQL Editor에 적용했는지 확인해 주세요." }, { status: 500 });
  return NextResponse.json({ off: body.off, ready: true, canEdit: true });
}

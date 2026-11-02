// 초대코드로 대학에 들어가기. DB 함수 join_org가 로그인한 본인(auth.uid())만 넣는다.
import { NextResponse } from "next/server";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: "초대코드를 입력해 주세요." }, { status: 400 });
  const { data, error } = await sb.rpc("join_org", { p_code: code });
  if (error) return NextResponse.json({ error: "가입하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ error: "맞지 않거나 계약이 끝난 초대코드예요." }, { status: 404 });
  return NextResponse.json(data);
}

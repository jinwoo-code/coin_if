// 실시간 판단 모드를 AI 실패로 규칙 계산으로 끝낼 때, AI가 판단하지 못한 몫의 토큰을 돌려준다(내림, 한 실행에 한 번).
// AI가 몇 번 답했는지는 브라우저 말을 믿지 않고 이용 기록(usage_logs)으로 센다. 전체 수는 서버가 규칙으로 끝까지 살아 센다.
import { NextResponse } from "next/server";
import { refundLive } from "@/lib/live-refund";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: string; profile?: Profile; worldIds?: string[]; months?: number; startYm?: string } | null;
  if (!body?.key || !/^[a-z0-9]{1,16}$/.test(body.key) || !body.profile || !Array.isArray(body.worldIds) || !body.worldIds.length || body.worldIds.length > 3 || !Number.isInteger(body.months) || !/^\d{4}-\d{2}$/.test(body.startYm ?? ""))
    return NextResponse.json({ error: "입력이 없어요" }, { status: 400 });
  const user = await currentUser();
  const admin = supabaseAdmin();
  if (!user || !admin) return NextResponse.json({ refunded: 0 });
  try {
    return NextResponse.json({ refunded: await refundLive(admin, user.id, body as Parameters<typeof refundLive>[2]) });
  } catch {
    return NextResponse.json({ error: "입력이 맞지 않아요" }, { status: 400 });
  }
}

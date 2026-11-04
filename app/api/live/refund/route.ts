// 실시간 판단 모드를 AI 실패로 규칙 계산으로 끝낼 때, AI가 판단하지 못한 몫의 토큰을 돌려준다(내림, 한 실행에 한 번).
// AI가 몇 번 답했는지는 브라우저 말을 믿지 않고 이용 기록(usage_logs)으로 센다. 전체 수는 서버가 규칙으로 끝까지 살아 센다.
import { NextResponse } from "next/server";
import { liveForkCount, liveRefundTokens } from "@/lib/live";
import { normalizeProfile } from "@/lib/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";
import { refund } from "@/lib/tokens";
import type { Profile } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: string; profile?: Profile; worldIds?: string[]; months?: number; startYm?: string } | null;
  if (!body?.key || !/^[a-z0-9]{1,16}$/.test(body.key) || !body.profile || !Array.isArray(body.worldIds) || !body.worldIds.length || body.worldIds.length > 3 || !Number.isInteger(body.months) || !/^\d{4}-\d{2}$/.test(body.startYm ?? ""))
    return NextResponse.json({ error: "입력이 없어요" }, { status: 400 });
  const user = await currentUser();
  const admin = supabaseAdmin();
  if (!user || !admin) return NextResponse.json({ refunded: 0 });
  const ref = `live_simulate:${user.id}:${body.key}`;
  const { data: spent } = await admin.from("token_ledger").select("amount, created_at").eq("user_id", user.id).eq("ref", ref).maybeSingle();
  if (!spent || spent.amount >= 0) return NextResponse.json({ refunded: 0 }); // 안 뺐거나 대학 계약(0토큰)
  const { data: done } = await admin.from("token_ledger").select("id").eq("ref", `refund:${ref}`).maybeSingle();
  if (done) return NextResponse.json({ refunded: 0 });
  let total = 0;
  try {
    const p = normalizeProfile({ ...body.profile, storyRaw: {} });
    for (const id of body.worldIds) total += liveForkCount(p, getWorld(id), body.months!, body.startYm!);
  } catch {
    return NextResponse.json({ error: "입력이 맞지 않아요" }, { status: 400 });
  }
  const { count } = await admin.from("usage_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feature", "judge_live").gte("created_at", spent.created_at);
  const tokens = liveRefundTokens(-spent.amount, count ?? 0, total);
  if (tokens > 0) await refund(user.id, "live_simulate", ref, tokens);
  return NextResponse.json({ refunded: tokens });
}

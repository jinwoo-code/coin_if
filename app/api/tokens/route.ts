// 내 토큰 잔액과 대학 무제한 여부. 본인 행만 읽는다(RLS, anon 키 + 세션).
import { NextResponse } from "next/server";
import { COSTS, TALK_LIMIT } from "@/lib/tokens";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ loggedIn: false, costs: COSTS, talkLimit: TALK_LIMIT });
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: bal }, { data: orgs }] = await Promise.all([
    sb.from("token_balances").select("balance").eq("user_id", user.id).maybeSingle(),
    sb.from("memberships").select("role, organizations(name, contract_start, contract_end, status)").eq("user_id", user.id),
  ]);
  type Org = { name: string; contract_start: string; contract_end: string; status: string };
  const live = (orgs ?? [])
    .map((m) => m.organizations as unknown as Org | null)
    .find((o) => o && o.contract_start <= today && today <= o.contract_end);
  return NextResponse.json({
    loggedIn: true,
    balance: bal?.balance ?? 0,
    unlimited: Boolean(live),
    org: live ? { name: live.name, until: live.contract_end, status: live.status } : null,
    costs: COSTS,
    talkLimit: TALK_LIMIT,
  });
}

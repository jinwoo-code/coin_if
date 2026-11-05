// 실시간 판단 토큰 돌려주기. 라우트와 DB 확인 스크립트(scripts/check-refund.ts)가 같이 쓴다.
// AI가 몇 번 답했는지는 브라우저 말을 믿지 않고 이용 기록(usage_logs)으로 센다. 전체 수는 서버가 규칙으로 끝까지 살아 센다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveForkCount, liveRefundTokens } from "./live";
import { normalizeProfile } from "./profile";
import type { Profile } from "./types";
import { getWorld } from "./worlds";

export async function refundLive(admin: SupabaseClient, userId: string, input: { key: string; profile: Profile; worldIds: string[]; months: number; startYm: string }) {
  const ref = `live_simulate:${userId}:${input.key}`;
  const { data: spent } = await admin.from("token_ledger").select("amount, created_at").eq("user_id", userId).eq("ref", ref).maybeSingle();
  if (!spent || spent.amount >= 0) return 0; // 안 뺐거나 대학 계약(0토큰)
  const { data: done } = await admin.from("token_ledger").select("id").eq("ref", `refund:${ref}`).maybeSingle();
  if (done) return 0;
  const p = normalizeProfile({ ...input.profile, storyRaw: {} });
  let total = 0;
  for (const id of input.worldIds) total += liveForkCount(p, getWorld(id), input.months, input.startYm);
  const { count } = await admin.from("usage_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feature", "judge_live").gte("created_at", spent.created_at);
  const tokens = liveRefundTokens(-spent.amount, count ?? 0, total);
  if (tokens > 0) {
    const { error } = await admin.from("token_ledger").insert({ user_id: userId, amount: tokens, reason: "refund", ref: `refund:${ref}` });
    if (error) throw new Error(error.message);
  }
  return tokens;
}

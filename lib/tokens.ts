// 토큰 차감(서버 전용). 잔액 확인과 차감은 DB 함수 spend_tokens가 한 번에 한다(동시에 눌러도 마이너스가 안 된다).
// 가격은 사업계획서 6장(1토큰 990원) 그대로. 일반 리포트는 무료라 여기 없다.
import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { currentUser } from "./supabase/server";

export const COSTS = {
  simulate: 1, // 시뮬레이션 1회(진로 2~3개)
  live_simulate: 4, // 실시간 판단 모드 1회(진로 2~3개, 가정값)
  premium_report: 5, // 프리미엄 리포트
  talk: 2, // 미래의 나와 대화, 세계선 하나에 20마디까지
} as const;
export type Feature = keyof typeof COSTS;
export const TALK_LIMIT = 20;
export const LIVE_MONTHLY_LIMIT = 3; // 대학 계약 학생의 실시간 판단 모드 한 달 횟수(가정값)

export type Spend =
  { ok: true; charged: boolean; unlimited: boolean; already?: boolean; balance: number; orgId: string | null; userId: string | null; ref: string } | { ok: false; status: 401 | 402 | 503; error: string; balance?: number; cost?: number };

// 로그인 안 한 사람은 무료(발표·체험용). requireLogin이면 로그인부터 요구한다(프리미엄 리포트).
// key: 같은 일을 두 번 빼지 않기 위한 이름(없으면 매번 새로 뺀다). 원장의 ref는 '기능:사용자:key'라 사람끼리 겹치지 않는다.
export async function spend(feature: Feature, key: string | null, opts: { requireLogin?: boolean } = {}): Promise<Spend> {
  const user = await currentUser();
  if (!user) {
    if (opts.requireLogin) return { ok: false, status: 401, error: "로그인이 필요해요" };
    return { ok: true, charged: false, unlimited: false, balance: 0, orgId: null, userId: null, ref: "" };
  }
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: "토큰 서버 설정이 없어요" };
  const ref = `${feature}:${user.id}:${key ?? crypto.randomUUID()}`;
  const { data, error } = await admin.rpc("spend_tokens", { p_user: user.id, p_reason: feature, p_cost: COSTS[feature], p_ref: ref });
  if (error || !data) {
    console.error("[토큰 실패]", feature, error?.message);
    return { ok: false, status: 503, error: "토큰을 확인하지 못했어요" };
  }
  const r = data as { ok: boolean; unlimited?: boolean; already?: boolean; balance: number; cost?: number; org_id?: string };
  if (!r.ok) return { ok: false, status: 402, error: "토큰이 부족해요", balance: r.balance, cost: r.cost };
  return { ok: true, charged: !r.unlimited && !r.already, unlimited: Boolean(r.unlimited), already: Boolean(r.already), balance: r.balance, orgId: r.org_id ?? null, userId: user.id, ref };
}

// 서버 쪽 실패로 결과를 못 줬을 때 돌려준다(반대 금액 행을 더한다. 원장은 고치지 않는다).
export async function refund(userId: string, feature: Feature, ref: string, amount: number = COSTS[feature]) {
  await supabaseAdmin()
    ?.from("token_ledger")
    .insert({ user_id: userId, amount, reason: "refund", ref: `refund:${ref}` })
    .then(({ error }) => error && console.error("[환불 실패]", error.message));
}

// 이번 달 실시간 판단 모드를 한도보다 많이 시작했는지(방금 시작한 것 포함). 확인을 못 하면 막지 않는다.
export async function liveOverLimit(userId: string) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const res = await supabaseAdmin()?.from("token_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("reason", "live_simulate").gte("created_at", from);
  return (res?.count ?? 0) > LIVE_MONTHLY_LIMIT;
}

export function paywall(s: Extract<Spend, { ok: false }>) {
  return Response.json({ error: s.error, balance: s.balance, cost: s.cost }, { status: s.status });
}

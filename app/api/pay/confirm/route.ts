// 결제 승인. 토스가 successUrl로 돌려준 paymentKey·orderId·amount를 받아
// 1) 내 주문인지, 금액이 주문과 같은지 확인 → 2) 시크릿 키로 토스 승인 API 호출 → 3) 원장에 적립.
// 같은 주문이 두 번 와도 원장 ref('topup:'+orderId)가 unique라 한 번만 들어간다.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail("로그인이 필요해요.", 401);
  const admin = supabaseAdmin();
  const secret = process.env.TOSS_SECRET_KEY;
  if (!admin || !secret) return fail("결제 설정이 아직 없어요.", 503);

  const { paymentKey, orderId, amount } = (await req.json()) as { paymentKey?: string; orderId?: string; amount?: number | string };
  if (!paymentKey || !orderId) return fail("결제 정보가 없어요.", 400);

  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!order) return fail("주문을 찾지 못했어요.", 404);
  if (Number(amount) !== order.amount) return fail("주문 금액과 결제 금액이 달라요.", 400);

  const balance = async () => {
    const { data } = await admin.from("token_balances").select("balance").eq("user_id", user.id).maybeSingle();
    return data?.balance ?? 0;
  };
  if (order.status === "paid") return NextResponse.json({ ok: true, already: true, tokens: order.tokens, balance: await balance() });

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
  });
  const toss = (await res.json().catch(() => ({}))) as { status?: string; totalAmount?: number; code?: string; message?: string };

  // 이미 승인된 결제를 다시 승인하면 토스가 ALREADY_PROCESSED_PAYMENT로 답한다 → 적립은 ref로 한 번만.
  const done = (res.ok && toss.status === "DONE" && toss.totalAmount === order.amount) || toss.code === "ALREADY_PROCESSED_PAYMENT";
  if (!done) {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId).eq("status", "pending");
    return fail(toss.message ?? "결제를 승인하지 못했어요.", 400);
  }

  const { error } = await admin.from("token_ledger").insert({ user_id: user.id, amount: order.tokens, reason: "topup", ref: `topup:${orderId}` });
  if (error && error.code !== "23505") return fail("토큰을 적립하지 못했어요. 문의해 주세요.", 500);
  await admin.from("orders").update({ status: "paid", payment_key: paymentKey, paid_at: new Date().toISOString() }).eq("id", orderId);

  return NextResponse.json({ ok: true, already: Boolean(error), tokens: order.tokens, balance: await balance() });
}

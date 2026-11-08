// 충전 주문 만들기. 금액은 브라우저가 보낸 값이 아니라 서버 상품표로 정한다.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";
import { PRODUCTS } from "@/lib/token-policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin || !process.env.TOSS_SECRET_KEY) return NextResponse.json({ error: "결제 설정이 아직 없어요." }, { status: 503 });

  const { productId, agreed } = (await req.json()) as { productId?: string; agreed?: boolean };
  const p = PRODUCTS.find((x) => x.id === productId);
  if (!p) return NextResponse.json({ error: "없는 상품이에요." }, { status: 400 });
  // 결제 전 환불·유효기간 안내(lib/token-policy.ts REFUND_NOTICE)에 동의해야 주문을 만든다.
  if (agreed !== true) return NextResponse.json({ error: "환불·유효기간 안내에 동의해 주세요." }, { status: 400 });

  const orderId = `cr-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await admin.from("orders").insert({ id: orderId, user_id: user.id, product_id: p.id, tokens: p.tokens, amount: p.price });
  if (error) return NextResponse.json({ error: "주문을 만들지 못했어요." }, { status: 500 });

  return NextResponse.json({
    orderId,
    amount: p.price,
    orderName: `진로 리허설 토큰 ${p.tokens}개`,
    customerKey: user.id, // 토스 위젯의 구매자 식별값(이메일·전화 같은 개인정보가 아닌 무작위 id)
    customerEmail: user.email,
  });
}

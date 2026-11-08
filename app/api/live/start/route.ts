// AI가 직접 살아 보는 모드(실시간 판단) 시작: 3토큰(lib/token-policy.ts, 로그인한 경우만). 같은 실행(key)은 이어서 해도 다시 안 뺀다. 대학 계약 학생은 한 달 LIVE_MONTHLY_LIMIT회까지(넘으면 막음, 토큰으로 더 쓰기는 준비 중: spend_tokens가 계약 학생을 늘 0토큰으로 처리해서 DB 함수를 고쳐야 함).
import { NextResponse } from "next/server";
import { liveOverLimit, paywall, spend } from "@/lib/tokens";
import { LIVE_OVER_LIMIT_MESSAGE } from "@/lib/token-policy";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: string } | null;
  if (!body?.key || !/^[a-z0-9]{1,16}$/.test(body.key)) return NextResponse.json({ error: "입력이 없어요" }, { status: 400 });
  const paid = await spend("live_simulate", body.key);
  if (!paid.ok) return paywall(paid);
  if (paid.unlimited && !paid.already && paid.userId && (await liveOverLimit(paid.userId))) return NextResponse.json({ error: LIVE_OVER_LIMIT_MESSAGE }, { status: 429 });
  return NextResponse.json({ ok: true, balance: paid.balance });
}

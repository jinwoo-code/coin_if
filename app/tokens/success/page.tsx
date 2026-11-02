"use client";
// 토스가 결제 인증 뒤 돌려보내는 곳. 서버(/api/pay/confirm)가 금액을 확인하고 승인해야 토큰이 들어온다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/ui";

type State = { kind: "wait" } | { kind: "ok"; tokens: number; balance: number } | { kind: "err"; msg: string };

export default function PaySuccess() {
  const [s, setS] = useState<State>({ kind: "wait" });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return; // 개발 모드에서 effect가 두 번 돌아도 승인은 한 번만 요청
    sent.current = true;
    const q = new URLSearchParams(window.location.search);
    fetch("/api/pay/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey: q.get("paymentKey"), orderId: q.get("orderId"), amount: q.get("amount") }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.ok) return setS({ kind: "err", msg: d.error ?? "결제를 승인하지 못했어요." });
        setS({ kind: "ok", tokens: d.tokens, balance: d.balance });
        window.dispatchEvent(new Event("cr:tokens"));
      })
      .catch(() => setS({ kind: "err", msg: "연결이 끊겼어요. 잠시 뒤 토큰 화면에서 잔액을 확인해 주세요." }));
  }, []);

  return (
    <Screen title="충전" back="/tokens">
      <p role="note" className="mt-2 rounded-2xl border-2 border-[#F5C400] bg-[#FFF6CC] p-4 text-center font-bold">
        테스트 결제예요. 실제로 돈이 나가지 않았어요.
      </p>
      <section className="card mt-4 p-5" aria-live="polite">
        {s.kind === "wait" ? (
          <p className="text-muted">결제를 확인하는 중…</p>
        ) : s.kind === "ok" ? (
          <>
            <p className="text-2xl font-extrabold">
              토큰 <span className="num">{s.tokens}</span>개를 충전했어요
            </p>
            <p className="mt-1 text-muted">
              남은 토큰 <span className="num">{s.balance}</span>개
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">충전하지 못했어요</p>
            <p className="mt-1 text-sm text-muted">{s.msg}</p>
          </>
        )}
      </section>
      <Link href="/" className="btn-primary mt-4 w-full">
        처음 화면으로
      </Link>
      <Link href="/tokens" className="btn-ghost mt-2 w-full">
        토큰 화면
      </Link>
    </Screen>
  );
}

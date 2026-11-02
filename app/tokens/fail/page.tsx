"use client";
// 결제창에서 취소하거나 실패하면 토스가 code·message를 붙여 여기로 보낸다. 토큰은 그대로다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";

export default function PayFail() {
  const [q, setQ] = useState<{ code: string | null; message: string | null }>({ code: null, message: null });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ code: p.get("code"), message: p.get("message") });
  }, []);
  const canceled = q.code === "PAY_PROCESS_CANCELED" || q.code === "USER_CANCEL";
  return (
    <Screen title="충전" back="/tokens">
      <section className="card mt-4 p-5">
        <p className="text-xl font-extrabold">{canceled ? "결제를 취소했어요" : "결제하지 못했어요"}</p>
        <p className="mt-1 text-sm text-muted">토큰과 잔액은 그대로예요.{q.message && !canceled ? ` (${q.message})` : ""}</p>
      </section>
      <Link href="/tokens" className="btn-primary mt-4 w-full">
        다시 충전하기
      </Link>
    </Screen>
  );
}

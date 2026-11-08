"use client";
// 토큰 잔액·가격·충전. 토큰이 부족하면 각 화면이 ?for=기능 을 붙여 여기로 보낸다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { Screen } from "@/components/ui";
import { COSTS, FEATURE_LABEL, LIVE_MONTHLY_LIMIT, PRODUCTS, REFUND_NOTICE, SIGNUP_BONUS, TALK_LIMIT } from "@/lib/token-policy";
import { T } from "@/lib/copy";

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

interface Info {
  loggedIn: boolean;
  balance?: number;
  unlimited?: boolean;
  org?: { name: string; until: string } | null;
  costs: Record<string, number>;
  talkLimit: number;
}

export default function Tokens() {
  const [info, setInfo] = useState<Info | null>(null);
  const [need, setNeed] = useState<string | null>(null);
  useEffect(() => {
    setNeed(new URLSearchParams(window.location.search).get("for"));
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <Screen title="토큰" back="/">
      <p role="note" className="mt-2 rounded-2xl border-2 border-[#F5C400] bg-[#FFF6CC] p-4 text-center font-bold">
        테스트 결제예요. 실제로 돈이 나가지 않아요.
      </p>
      {need && info?.loggedIn && !info.unlimited ? (
        <p className="mt-2 rounded-2xl bg-[#FFF4E5] p-4">
          <b>{FEATURE_LABEL[need] ?? need}</b>에 토큰 {info.costs[need]}개가 필요한데 {info.balance}개 남았어요.
        </p>
      ) : null}

      <section className="card mt-4 p-5">
        {!info ? (
          <p className="text-muted">불러오는 중…</p>
        ) : !info.loggedIn ? (
          <>
            <p className="font-semibold">로그인하지 않으면 무료로 체험할 수 있어요.</p>
            <p className="mt-1 text-sm text-muted">로그인하면 결과가 계정에 남고, 가입 선물로 토큰 {SIGNUP_BONUS}개를 드려요.</p>
            <Link href="/login" className="btn-primary mt-4 w-full">
              로그인
            </Link>
          </>
        ) : info.unlimited ? (
          <>
            <p className="label">{info.org?.name}</p>
            <p className="mt-1 text-2xl font-extrabold">학교 계약 이용 중</p>
            <p className="mt-1 text-sm text-muted">
              {info.org?.until}까지 토큰이 줄지 않아요. 프리미엄 리포트 포함, {T.liveMode}는 한 달 <span className="num">{LIVE_MONTHLY_LIMIT}</span>번까지예요.
            </p>
          </>
        ) : (
          <>
            <p className="label">남은 토큰</p>
            <p className="num mt-1 text-3xl font-extrabold">{info.balance}개</p>
          </>
        )}
      </section>

      <h2 className="mt-8 text-lg font-bold">어디에 쓰나요</h2>
      <p className="mt-1 text-sm text-muted">토큰은 로그인했을 때만 빠져요. 프리미엄 리포트는 로그인이 필요해요.</p>
      <ul className="card mt-3 divide-y divide-hair" data-testid="token-costs">
        {(
          [
            ["simulate", `검사, ${T.lineMap}, 진로 비교표 포함`],
            ["talk", `${T.line} 하나에 ${TALK_LIMIT}마디까지`],
            ["live_simulate", "진로마다 30번, AI가 큰 갈림길을 직접 판단"],
            ["premium_report", `${T.line} 전체 비교, 격차 전체, 월별 일정, 다시 살아 보기, 공유`],
          ] as const
        ).map(([k, note]) => (
          <li key={k} className="flex items-center justify-between gap-3 p-4">
            <span>
              <span className="font-semibold">{FEATURE_LABEL[k]}</span>
              <span className="block text-cap text-muted">{note}</span>
            </span>
            <span className="num flex-none font-bold">{COSTS[k] === 0 ? "무료" : `${COSTS[k]}개`}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 p-4">
          <span>
            <span className="font-semibold">일반 리포트 · 한 달 체크인</span>
          </span>
          <span className="flex-none font-bold">무료</span>
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-bold">충전</h2>
      <p className="mt-1 text-sm text-muted">
        5개·12개 묶음으로 팔아요(1개씩은 안 팔아요). 학교가 계약했다면{" "}
        <Link href="/org" className="font-semibold underline underline-offset-4">
          초대코드
        </Link>
        를 넣으면 토큰 없이 써요.
      </p>
      <Checkout canPay={Boolean(info?.loggedIn && !info.unlimited && CLIENT_KEY)} />
      {!CLIENT_KEY ? <p className="mt-2 text-cap text-muted">결제 키가 설정되지 않아 충전 버튼이 꺼져 있어요.</p> : null}
    </Screen>
  );
}

// 상품을 고르면 서버가 주문(금액 포함)을 만들고, 그 금액으로 토스 결제위젯을 띄운다.
function Checkout({ canPay }: { canPay: boolean }) {
  const [order, setOrder] = useState<{ orderId: string; amount: number; orderName: string; customerKey: string; customerEmail?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const widgets = useRef<TossPaymentsWidgets | null>(null);
  const rendered = useRef(false);

  async function choose(productId: string) {
    setErr(null);
    setReady(false);
    setBusy(true);
    try {
      const res = await fetch("/api/pay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, agreed }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "주문을 만들지 못했어요.");
      setOrder(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // 주문이 바뀔 때마다 결제위젯을 새로 그린다(금액은 주문의 값 그대로).
  useEffect(() => {
    if (!order) return;
    let alive = true;
    (async () => {
      try {
        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const toss = await loadTossPayments(CLIENT_KEY);
        if (!alive) return;
        const w = (widgets.current ??= toss.widgets({ customerKey: order.customerKey }));
        await w.setAmount({ currency: "KRW", value: order.amount });
        // 위젯은 한 번만 그린다. 상품을 바꾸면 금액만 바꾼다.
        if (!rendered.current) {
          rendered.current = true;
          await Promise.all([
            w.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
            w.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
          ]);
        }
        if (alive) setReady(true);
      } catch (e) {
        if (alive) setErr((e as Error).message || "결제창을 불러오지 못했어요.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [order]);

  async function pay() {
    if (!order || !widgets.current) return;
    setErr(null);
    try {
      await widgets.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/tokens/success`,
        failUrl: `${window.location.origin}/tokens/fail`,
        customerEmail: order.customerEmail,
      });
    } catch (e) {
      setErr((e as Error).message || "결제를 시작하지 못했어요.");
    }
  }

  return (
    <>
      <section className="card mt-3 p-4" aria-labelledby="refund-title" data-testid="refund-notice">
        <h3 id="refund-title" className="font-bold">
          환불·유효기간
        </h3>
        <p className="mt-1 text-sm">{REFUND_NOTICE}</p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 flex-none accent-ink" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required aria-required="true" />
          위 내용을 확인했어요(필수)
        </label>
      </section>
      <ul className="mt-3 grid gap-2">
        {PRODUCTS.map((p) => (
          <li key={p.id} className="card flex items-center justify-between p-4">
            <span>
              <span className="num text-lg font-bold">{p.tokens}토큰</span>
              <span className="num block text-cap text-muted">1개에 {Math.round(p.price / p.tokens).toLocaleString("ko-KR")}원</span>
            </span>
            <button className="btn-ghost min-h-[44px] px-5" disabled={!canPay || busy || !agreed} onClick={() => choose(p.id)} aria-label={`${p.tokens}토큰 ${p.price.toLocaleString("ko-KR")}원 충전`}>
              <span className="num">{p.price.toLocaleString("ko-KR")}원</span>
            </button>
          </li>
        ))}
      </ul>
      {err ? <p role="alert" className="mt-3 rounded-2xl bg-[#FDECEC] p-4 text-sm">{err}</p> : null}
      {order ? (
        <section className="card mt-4 p-4" aria-label="테스트 결제">
          <p className="font-semibold">
            {order.orderName} · <span className="num">{order.amount.toLocaleString("ko-KR")}원</span>
          </p>
          <p className="mt-1 text-cap text-muted">테스트 결제창이에요. 카드사를 고르고 진행해도 실제로 청구되지 않아요.</p>
          <div id="payment-method" className="mt-2" />
          <div id="agreement" />
          <button className="btn-primary mt-3 w-full" disabled={!ready} onClick={pay}>
            {ready ? "테스트 결제하기" : "결제창 불러오는 중…"}
          </button>
        </section>
      ) : null}
    </>
  );
}

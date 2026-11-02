"use client";
// 토큰 잔액·가격·충전. 토큰이 부족하면 각 화면이 ?for=기능 을 붙여 여기로 보낸다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { FEATURE_LABEL, PRODUCTS } from "@/lib/products";

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
            <p className="mt-1 text-sm text-muted">로그인하면 결과가 계정에 남고, 가입 선물로 토큰 5개를 드려요.</p>
            <Link href="/login" className="btn-primary mt-4 w-full">
              로그인
            </Link>
          </>
        ) : info.unlimited ? (
          <>
            <p className="label">{info.org?.name}</p>
            <p className="mt-1 text-2xl font-extrabold">무제한 이용 중</p>
            <p className="mt-1 text-sm text-muted">{info.org?.until}까지 학교가 계약해서 토큰이 줄지 않아요.</p>
          </>
        ) : (
          <>
            <p className="label">남은 토큰</p>
            <p className="num mt-1 text-3xl font-extrabold">{info.balance}개</p>
          </>
        )}
      </section>

      <h2 className="mt-8 text-lg font-bold">어디에 쓰나요</h2>
      <ul className="card mt-3 divide-y divide-hair">
        {[
          ["simulate", ""],
          ["premium_report", "세계선 전체 비교, 바꿀 수 있는 것 전체, 막혔을 때 할 일, PDF"],
          ["talk", `${info?.talkLimit ?? 20}마디까지`],
        ].map(([k, note]) => (
          <li key={k} className="flex items-center justify-between gap-3 p-4">
            <span>
              <span className="font-semibold">{FEATURE_LABEL[k]}</span>
              {note ? <span className="block text-cap text-muted">{note}</span> : null}
            </span>
            <span className="num flex-none font-bold">{info?.costs[k] ?? "-"}개</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 p-4">
          <span className="font-semibold">일반 리포트</span>
          <span className="flex-none font-bold">무료</span>
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-bold">충전</h2>
      <p className="mt-1 text-sm text-muted">1토큰 990원. 학교가 계약했다면 초대코드로 무제한 이용할 수 있어요.</p>
      <ul className="mt-3 grid gap-2">
        {PRODUCTS.map((p) => (
          <li key={p.id} className="card flex items-center justify-between p-4">
            <span className="num text-lg font-bold">{p.tokens}토큰</span>
            <button className="btn-ghost min-h-[44px] px-5" disabled>
              <span className="num">{p.price.toLocaleString("ko-KR")}원</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-cap text-muted">테스트 결제는 다음 단계에서 붙어요.</p>
    </Screen>
  );
}

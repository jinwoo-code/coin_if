"use client";
// 로그인 상태. SyncBridge는 모든 화면에 깔려 동의 전이면 /welcome으로 보내고, 동의했으면 자동 저장을 켠다.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasSupabase } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { fetchStatus, restore, startAutoSync, stopAutoSync } from "@/lib/sync";

// 동의 전에도 볼 수 있는 화면
const OPEN = ["/welcome", "/privacy", "/login"];

export function SyncBridge() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!hasSupabase() || OPEN.includes(path)) return;
    let alive = true;
    fetchStatus().then((s) => {
      if (!alive || !s.user) return stopAutoSync();
      if (!s.consented) return router.replace("/welcome");
      // 빈 기기에 계정 기록을 깔았으면 이미 그려진 화면이 다시 읽도록 알린다.
      if (restore(s)) window.dispatchEvent(new Event("cr:restored"));
      startAutoSync();
    });
    return () => {
      alive = false;
    };
  }, [path, router]);
  return null;
}

export function AccountButton() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return setEmail(null);
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!hasSupabase() || email === undefined) return null;
  if (!email)
    return (
      <Link href="/login" className="chip">
        로그인
      </Link>
    );
  return (
    <span className="flex items-center gap-2">
      <TokenChip />
      <span className="hidden max-w-[12rem] truncate text-sm text-muted sm:inline">{email}</span>
      <button
        className="chip"
        onClick={async () => {
          stopAutoSync();
          await supabaseBrowser()?.auth.signOut();
          setEmail(null);
        }}
      >
        로그아웃
      </button>
    </span>
  );
}

// 토큰 잔액 칩. 차감·충전 뒤에는 window에 "cr:tokens" 이벤트를 쏘면 다시 읽는다.
export function TokenChip() {
  const [t, setT] = useState<{ balance: number; unlimited: boolean } | null>(null);
  useEffect(() => {
    if (!hasSupabase()) return;
    const load = () =>
      fetch("/api/tokens", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setT(d.loggedIn ? { balance: d.balance, unlimited: d.unlimited } : null))
        .catch(() => setT(null));
    load();
    window.addEventListener("cr:tokens", load);
    return () => window.removeEventListener("cr:tokens", load);
  }, []);
  if (!t) return null;
  return (
    <Link href="/tokens" className="chip min-h-[36px] px-3 text-cap font-semibold" aria-label={t.unlimited ? "대학 무제한 이용 중" : `토큰 ${t.balance}개`}>
      {t.unlimited ? "무제한" : <span className="num">토큰 {t.balance}</span>}
    </Link>
  );
}

// 버튼 아래 한 줄: 로그인 전이면 저장 안내, 로그인했으면 이 버튼이 쓰는 토큰.
export function CostNote({ cost }: { cost: number }) {
  const [t, setT] = useState<{ loggedIn: boolean; balance?: number; unlimited?: boolean } | null>(null);
  useEffect(() => {
    if (!hasSupabase()) return;
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then(setT)
      .catch(() => setT(null));
  }, []);
  if (!t) return null;
  const text = !t.loggedIn
    ? "로그인하면 결과가 계정에 저장돼요. 로그인 없이도 무료로 해 볼 수 있어요."
    : t.unlimited
      ? "학교 무제한 이용 중이라 토큰이 줄지 않아요."
      : `토큰 ${cost}개를 써요(남은 토큰 ${t.balance}개).`;
  return (
    <p className="mt-2 text-center text-cap text-muted">
      {text}
      {!t.loggedIn ? (
        <Link href="/login" className="ml-1 font-semibold underline underline-offset-4">
          로그인
        </Link>
      ) : null}
    </p>
  );
}

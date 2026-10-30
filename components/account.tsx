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
      restore(s);
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

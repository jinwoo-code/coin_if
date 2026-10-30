// 서버용(anon 키 + 쿠키의 로그인 세션). API 라우트·서버 컴포넌트에서 '이 사용자'로 DB를 쓴다.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./config";

export function supabaseServer() {
  if (!hasSupabase()) return null;
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 못 쓴다. 세션 갱신은 middleware가 한다.
        }
      },
    },
  });
}

// 로그인한 사용자(없으면 null). getUser는 Supabase에 토큰을 확인하므로 위조된 쿠키를 믿지 않는다.
export async function currentUser() {
  const sb = supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

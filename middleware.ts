// 로그인 세션 갱신(Supabase 쿠키). 키가 없으면 아무것도 안 한다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase()) return response;
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return response;
}

// 정적 파일과 시뮬레이션 스트림(SSE)은 건너뛴다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/simulate|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

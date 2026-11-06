// service role 클라이언트. RLS를 건너뛰므로 서버에서만, 토큰 원장·이용 기록처럼 사용자가 직접 못 쓰는 곳에만 쓴다.
// "server-only" 때문에 브라우저 코드에서 import하면 빌드가 실패한다(키가 번들에 들어갈 수 없다).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  // Next가 fetch 응답을 저장해 두면 취소한 공유 링크가 그대로 열린다. 서버 DB 읽기는 항상 새로 받는다.
  const fresh: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });
  client ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fresh } });
  return client;
}

"use client";
// 브라우저용(anon 키 + 로그인 세션). 읽고 쓰는 범위는 RLS가 정한다.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./config";

let client: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (!hasSupabase()) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// Supabase 주소와 공개(anon) 키. 둘 다 브라우저에 나가도 되는 값이다(데이터는 RLS가 막는다).
// 키가 없으면 로그인 기능만 숨기고 앱은 지금처럼 브라우저 저장으로 돈다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

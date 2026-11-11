-- 앱 전체 설정(행 하나에 키 하나). 지금은 'ai_off'(전체 목업 스위치)만 쓴다.
-- 읽기·쓰기 모두 서버(service role)만 한다. 사용자·anon에게 정책을 주지 않는다(RLS 켬, 정책 없음).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.app_settings enable row level security;

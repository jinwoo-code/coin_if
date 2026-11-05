-- 상담사에게 공유하는 읽기 전용 링크. 결과와 계획만 담는다(이야기 원문·문항별 답 없음).
-- 사용자·anon에게 정책을 안 준다. 서버(service role)만 읽고 쓴다.
create table if not exists public.shared_reports (
  token text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  owner_hash text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists shared_reports_expires on public.shared_reports (expires_at);
alter table public.shared_reports enable row level security;

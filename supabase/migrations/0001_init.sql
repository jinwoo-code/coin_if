-- 진로 리허설 DB 1단계: 계정에 결과 저장 + 토큰·대학·이용 기록 테이블.
-- 적용: Supabase 대시보드 > SQL Editor에 통째로 붙여 넣고 실행(또는 supabase db push).
--
-- 원칙
-- - 모든 테이블 RLS 켬. 학생은 자기 행만 본다.
-- - 대학 관리자도 학생 개인 행은 못 본다. 집계는 4단계의 security definer 함수로만 준다.
-- - 토큰 잔액은 token_ledger의 합계. 사용자는 원장에 쓰지 못하고(정책 없음), 서버 함수만 쓴다.
-- - service role 키는 RLS를 건너뛰므로 서버(app/api)에서만 쓴다.

-- ---------- 프로필 ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb, -- lib/types.ts의 Profile 그대로
  consent_at timestamptz, -- 수집·이용 동의 시각(없으면 아직 동의 전)
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 시뮬레이션 ----------
-- 진로 하나를 살아본 결과 1건. 숫자는 전부 엔진(lib/multiverse)이 낸 값 그대로 저장한다.
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_key text not null, -- 같은 결과를 두 번 올려도 한 행만 남게(브라우저가 결과 내용으로 만든 키)
  career text not null, -- 진로 id(data/jobs.ts)
  months int not null, -- 살아본 기간(개월)
  start_month text not null, -- 시작 연월 "2026-11"
  summary jsonb not null, -- Multiverse(통계·세계선·나무)
  chosen_line text, -- 지금 보고 있는 세계선 id
  scenes jsonb not null default '{}'::jsonb, -- { [lineId]: SimEvent[] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, run_key)
);
create index simulations_user on public.simulations (user_id, created_at desc);

-- ---------- 미래의 나와 대화(세계선마다) ----------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  simulation_id uuid references public.simulations (id) on delete cascade,
  career text not null,
  line_id text not null,
  turns jsonb not null default '[]'::jsonb, -- ChatMessage[]
  count int not null default 0, -- 내가 보낸 마디 수(20마디 제한은 서버가 센다)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, career, line_id)
);

-- ---------- 대학 ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  contract_start date not null,
  contract_end date not null,
  status text not null default 'trial' check (status in ('trial', 'active')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- ---------- 토큰 원장 ----------
-- 잔액은 합계로만 낸다. 행을 고치거나 지우지 않고, 바로잡을 때도 반대 금액 행을 더한다.
create table public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null, -- 적립 +, 사용 −
  reason text not null, -- signup | simulate | premium_report | talk | topup | adjust
  ref text unique, -- 같은 일로 두 번 적립·차감되지 않게(예: 결제 orderId)
  created_at timestamptz not null default now()
);
create index token_ledger_user on public.token_ledger (user_id);

create view public.token_balances with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::int as balance from public.token_ledger group by user_id;

-- ---------- AI 이용 기록(원가) ----------
create table public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null, -- 로그인 안 한 호출은 null
  org_id uuid references public.organizations (id) on delete set null,
  feature text not null, -- simulate | line | explore | profile | resume | report | premium_report | talk
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_krw numeric(12, 4) not null default 0, -- lib/pricing.ts 단가로 계산
  created_at timestamptz not null default now()
);
create index usage_logs_org_month on public.usage_logs (org_id, created_at);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.simulations enable row level security;
alter table public.chats enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.token_ledger enable row level security;
alter table public.usage_logs enable row level security;

-- 학생: 자기 프로필·시뮬레이션·대화만 읽고 쓴다.
create policy "own profile read" on public.profiles for select using (user_id = auth.uid());
create policy "own profile write" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own simulations" on public.simulations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own chats read" on public.chats for select using (user_id = auth.uid());
-- 대화 쓰기는 서버(마디 수를 세는 /api/talk)만 한다.

-- 대학: 내가 속한 대학의 이름·기간만 본다. 초대코드 가입은 서버 함수(4단계)로.
create policy "my orgs" on public.organizations for select
  using (exists (select 1 from public.memberships m where m.org_id = organizations.id and m.user_id = auth.uid()));
create policy "my memberships" on public.memberships for select using (user_id = auth.uid());

-- 토큰: 내 원장 읽기만. 쓰기 정책이 없으므로 브라우저에서는 적립·차감이 불가능하다.
create policy "own ledger read" on public.token_ledger for select using (user_id = auth.uid());

-- 이용 기록: 학생도 관리자도 직접 못 본다(정책 없음). 관리자는 집계 함수로만.

-- ---------- 가입하면 프로필 행 만들기 ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at 자동 갱신
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger simulations_touch before update on public.simulations for each row execute function public.touch_updated_at();
create trigger chats_touch before update on public.chats for each row execute function public.touch_updated_at();

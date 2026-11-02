-- 3단계: 토큰 충전 주문(토스페이먼츠 테스트 결제). 적용: SQL Editor에 붙여 넣고 Run(0002 다음에).
-- 주문은 결제창을 열기 전에 서버가 만든다. 금액은 서버의 상품표(lib/products.ts)로 정하고,
-- 승인할 때 토스가 돌려준 금액이 이 행과 같을 때만 적립한다. 적립은 원장 ref 'topup:'||id로 한 번만.

create table public.orders (
  id text primary key, -- 토스 orderId(6~64자, 영문·숫자·-·_)
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  tokens int not null check (tokens > 0),
  amount int not null check (amount > 0), -- 원
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payment_key text,
  test boolean not null default true, -- 테스트 키로 만든 주문(실제 돈 안 나감)
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;
-- 학생은 자기 주문 읽기만. 만들기·승인은 서버(service role)만 한다.
create policy "own orders read" on public.orders for select using (user_id = auth.uid());

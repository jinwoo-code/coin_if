-- 2단계: 토큰. 가입 보너스, 차감 함수, 대화를 시뮬레이션마다 따로 세기.
-- 적용: SQL Editor에 통째로 붙여 넣고 Run(0001 다음에).

-- ---------- 가입 보너스 5토큰 ----------
-- 프로필 행과 함께 원장에 +5. ref로 한 사람에게 한 번만.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.token_ledger (user_id, amount, reason, ref) values (new.id, 5, 'signup', 'signup:' || new.id) on conflict (ref) do nothing;
  return new;
end;
$$;

-- 이미 가입한 사람에게도 한 번
insert into public.token_ledger (user_id, amount, reason, ref)
select id, 5, 'signup', 'signup:' || id from auth.users
on conflict (ref) do nothing;

-- ---------- 차감 ----------
-- 서버(service role)만 부른다. 한 사람의 요청은 잠금으로 줄 세워서, 동시에 눌러도 잔액이 마이너스가 되지 않는다.
-- - 같은 ref가 이미 있으면 다시 빼지 않는다(같은 리포트를 다시 열 때 등).
-- - 계약 기간 안의 대학 소속이면 빼지 않고 0토큰 행만 남긴다(이용 횟수는 남음).
-- 돌려주는 값: { ok, unlimited, balance, already, org_id }
create or replace function public.spend_tokens(p_user uuid, p_reason text, p_cost int, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_balance int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select coalesce(sum(amount), 0) into v_balance from token_ledger where user_id = p_user;

  if p_ref is not null and exists (select 1 from token_ledger where ref = p_ref) then
    return jsonb_build_object('ok', true, 'already', true, 'balance', v_balance);
  end if;

  select m.org_id into v_org
  from memberships m join organizations o on o.id = m.org_id
  where m.user_id = p_user and current_date between o.contract_start and o.contract_end
  limit 1;

  if v_org is not null then
    insert into token_ledger (user_id, amount, reason, ref) values (p_user, 0, p_reason, p_ref);
    return jsonb_build_object('ok', true, 'unlimited', true, 'org_id', v_org, 'balance', v_balance);
  end if;

  if v_balance < p_cost then
    return jsonb_build_object('ok', false, 'balance', v_balance, 'cost', p_cost);
  end if;

  insert into token_ledger (user_id, amount, reason, ref) values (p_user, -p_cost, p_reason, p_ref);
  return jsonb_build_object('ok', true, 'balance', v_balance - p_cost);
end;
$$;

revoke all on function public.spend_tokens(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.spend_tokens(uuid, text, int, text) to service_role;

-- ---------- 대화: 시뮬레이션(run_key)마다 세계선별로 센다 ----------
-- 같은 세계선 이름이라도 다시 살아본 결과면 새 대화(새로 2토큰)다.
alter table public.chats add column if not exists run_key text not null default '';
alter table public.chats drop constraint if exists chats_user_id_career_line_id_key;
alter table public.chats add constraint chats_user_run_line_key unique (user_id, run_key, career, line_id);

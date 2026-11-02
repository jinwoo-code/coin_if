-- 4단계: 대학. 시범 대학 시드, 초대코드 가입, 관리자 집계(학생 5명 미만 항목은 숨김).
-- 적용: SQL Editor에 붙여 넣고 Run(0003 다음에).
--
-- 원칙
-- - 관리자도 학생 개인 행(simulations·chats 등)을 직접 읽는 정책은 없다. 집계는 org_stats 하나로만.
-- - org_stats는 호출한 사람이 그 대학의 admin인지 함수 안에서 확인하고, 개인 행은 돌려주지 않는다.
-- - 숫자는 엔진이 낸 값(simulations.summary, levers)을 세기만 한다.

-- ---------- 시연용 표시 ----------
alter table public.profiles add column if not exists demo boolean not null default false; -- scripts/seed-demo.ts가 만든 가상 학생
alter table public.simulations add column if not exists levers jsonb; -- 바꿀 수 있는 것 상위 3개 제목(서버가 엔진으로 계산)

-- ---------- 시범 대학 ----------
insert into public.organizations (name, invite_code, contract_start, contract_end, status)
values ('경기과기대 시범', 'GTEC-DEMO', current_date, (current_date + interval '6 months')::date, 'trial')
on conflict (invite_code) do nothing;

-- ---------- 초대코드로 가입(학생) ----------
-- 로그인한 본인만(auth.uid()). 계약 기간이 끝난 대학 코드는 받지 않는다.
create or replace function public.join_org(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org organizations;
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '28000';
  end if;
  select * into v_org from organizations where invite_code = upper(trim(p_code));
  if v_org.id is null or current_date not between v_org.contract_start and v_org.contract_end then
    return jsonb_build_object('ok', false);
  end if;
  insert into memberships (user_id, org_id, role) values (auth.uid(), v_org.id, 'student') on conflict do nothing;
  return jsonb_build_object('ok', true, 'name', v_org.name, 'until', v_org.contract_end);
end;
$$;
revoke all on function public.join_org(text) from public, anon;
grant execute on function public.join_org(text) to authenticated;

-- ---------- 관리자 집계 ----------
-- 항목마다 서로 다른 학생 수를 세고, 5명 미만인 항목은 결과에서 뺀다. 전체 학생이 5명 미만이면 숫자를 하나도 주지 않는다.
create or replace function public.org_stats(p_org uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k constant int := 5;
  v_org organizations;
  v_students int;
  v_demo int;
  v_sims int;
  v_out jsonb;
begin
  if not exists (select 1 from memberships where org_id = p_org and user_id = auth.uid() and role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_org from organizations where id = p_org;

  create temp table _st on commit drop as
    select m.user_id, coalesce(p.demo, false) as demo
    from memberships m left join profiles p on p.user_id = m.user_id
    where m.org_id = p_org and m.role = 'student';
  create temp table _sim on commit drop as
    select s.* from simulations s join _st on _st.user_id = s.user_id;

  select count(*), count(*) filter (where demo) into v_students, v_demo from _st;
  select count(*) into v_sims from _sim;

  v_out := jsonb_build_object(
    'org', jsonb_build_object('name', v_org.name, 'status', v_org.status, 'until', v_org.contract_end),
    'k', k, 'students', v_students, 'demoStudents', v_demo
  );
  if v_students < k then
    return v_out || jsonb_build_object('hidden', true);
  end if;

  return v_out || jsonb_build_object(
    'hidden', false,
    'simulations', v_sims,
    -- 많이 살아본 진로 Top 10
    'careers', coalesce((
      select jsonb_agg(x order by (x->>'students')::int desc) from (
        select jsonb_build_object('career', career, 'students', count(distinct user_id), 'runs', count(*)) as x
        from _sim group by career having count(distinct user_id) >= k
        order by count(distinct user_id) desc, career limit 10
      ) t), '[]'::jsonb),
    -- 많이 막힌 길: 시뮬레이션마다 만족 비율이 가장 낮은 세계선(100번 중 3번 이상 나온 길)
    'stuck', coalesce((
      select jsonb_agg(x order by (x->>'students')::int desc) from (
        select jsonb_build_object('career', career, 'line', title, 'students', count(distinct user_id), 'satisfied', round(avg(sat))) as x
        from (
          select distinct on (s.id) s.id, s.user_id, s.career, l->>'title' as title, (l->>'satisfiedShare')::numeric as sat
          from _sim s, jsonb_array_elements(s.summary->'lines') l
          where (l->>'count')::int >= 3
          order by s.id, (l->>'satisfiedShare')::numeric asc
        ) w
        group by career, title having count(distinct user_id) >= k
        order by count(distinct user_id) desc limit 10
      ) t), '[]'::jsonb),
    -- 바꿀 수 있는 것 빈도(시뮬레이션마다 엔진이 고른 상위 3개)
    'levers', coalesce((
      select jsonb_agg(x order by (x->>'students')::int desc) from (
        select jsonb_build_object('career', career, 'title', title, 'students', count(distinct user_id)) as x
        from (select s.user_id, s.career, jsonb_array_elements_text(s.levers) as title from _sim s where s.levers is not null) v
        group by career, title having count(distinct user_id) >= k
        order by count(distinct user_id) desc limit 10
      ) t), '[]'::jsonb),
    -- 이번 달 AI 비용(5단계에서 usage_logs가 채워진다)
    'cost', (
      select jsonb_build_object('calls', count(*), 'krw', coalesce(round(sum(cost_krw)), 0))
      from usage_logs u
      where u.org_id = p_org and u.created_at >= date_trunc('month', now())
    )
  );
end;
$$;
revoke all on function public.org_stats(uuid) from public, anon;
grant execute on function public.org_stats(uuid) to authenticated;

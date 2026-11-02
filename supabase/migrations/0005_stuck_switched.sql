-- 4단계 보완: '많이 막힌 길'에서 다른 진로로 갈아탄 세계선을 뺀다.
-- 엔진은 갈아탄 뒤의 진로를 살아보지 않아서(만족도가 50 쪽으로만 움직임) 그 길의 만족 비율은 늘 0%였다.
-- 세계선에 switched 표시가 생겼다(lib/multiverse.ts). 적용: SQL Editor에 붙여 넣고 Run(0004 다음에).

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
    -- 많이 막힌 길: 시뮬레이션마다 만족 비율이 가장 낮은 세계선(100번 중 3번 이상, 다른 진로로 갈아탄 길 제외)
    'stuck', coalesce((
      select jsonb_agg(x order by (x->>'students')::int desc) from (
        select jsonb_build_object('career', career, 'line', title, 'students', count(distinct user_id), 'satisfied', round(avg(sat))) as x
        from (
          select distinct on (s.id) s.id, s.user_id, s.career, l->>'title' as title, (l->>'satisfiedShare')::numeric as sat
          from _sim s, jsonb_array_elements(s.summary->'lines') l
          where (l->>'count')::int >= 3
            and not coalesce((l->>'switched')::boolean, false) -- 다른 진로로 갈아탄 길은 만족 비율을 살아보지 않았다
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

-- 상담사 화면과 체크인 메일. SQL Editor에 붙여넣어 적용한다.
-- - 상담사는 학생이 직접 '보여 주기'를 켠 경우에만 그 학생의 요약을 본다(끄면 바로 안 보임). 대학 관리자 집계(k=5)와는 따로다.
-- - 이야기 원문·근거 인용은 원래 계정에 없다(scrubStory). 함수도 원문 칸을 돌려주지 않는다.
-- - 메일 기록은 같은 체크인 차례에 두 번 안 보내려고 둔다. 사용자에게 정책을 주지 않는다(서버만).

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_check check (role in ('student', 'admin', 'counselor'));

create table if not exists public.counsel_shares (
  student_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, org_id)
);
alter table public.counsel_shares enable row level security;
create policy "내 공유 보기" on public.counsel_shares for select using (student_id = auth.uid());
create policy "내 공유 끄기" on public.counsel_shares for delete using (student_id = auth.uid());
-- 켤 때는 그 대학 소속인지 확인한다
create policy "내 공유 켜기" on public.counsel_shares for insert with check (
  student_id = auth.uid() and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = counsel_shares.org_id)
);

create or replace function public.counselor_students(p_org uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not exists (select 1 from memberships where user_id = auth.uid() and org_id = p_org and role = 'counselor') then
    raise exception 'counselor only' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(t.item order by t.item->>'sharedAt' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', s.student_id,
      'sharedAt', s.created_at,
      'name', p.data->>'name',
      'major', p.data->>'major',
      'dilemma', p.data->>'dilemma',
      'values', p.data->'values',
      'checkins', jsonb_array_length(coalesce(p.data->'checkins', '[]'::jsonb)),
      'sims', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'career', x.career,
          'months', x.months,
          'startYm', x.start_month,
          'runs', x.summary->'stats'->'runs',
          'gate', x.summary->'stats'->'gate',
          'satisfied', x.summary->'stats'->'satisfiedShare',
          'stressed', x.summary->'stats'->'stressedShare',
          'levers', x.levers,
          'updatedAt', x.updated_at
        ) order by x.updated_at desc), '[]'::jsonb)
        from (select * from simulations where user_id = s.student_id order by updated_at desc limit 6) x
      )
    ) as item
    from counsel_shares s
    join memberships m on m.user_id = s.student_id and m.org_id = s.org_id
    join profiles p on p.user_id = s.student_id
    where s.org_id = p_org and not coalesce(p.demo, false)
  ) t;
  return v;
end;
$$;
revoke all on function public.counselor_students(uuid) from public, anon;
grant execute on function public.counselor_students(uuid) to authenticated;

create table if not exists public.checkin_mail_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, ref)
);
alter table public.checkin_mail_log enable row level security;

-- A group's calendar (그룹 지도 → 달력): who of its members pinged on each day
-- of a range — TODAY pings and photos sent to the group — as { day, user_id }
-- pairs, nothing else (no places, no times). Members only, at most 62 days.
create or replace function public.group_ping_days(gid uuid, from_day date, to_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'user_id', x.user_id) order by x.day), '[]'::jsonb)
  from (
    select distinct k.day, k.user_id
      from public.pings k join public.group_members m on m.user_id = k.user_id and m.group_id = gid
      where k.day between from_day and to_day and k.deleted_at is null
    union
    select f.day, f.user_id
      from public.group_photos f join public.group_members m on m.user_id = f.user_id and m.group_id = gid
      where f.group_id = gid and f.day between from_day and to_day
  ) x
  where public.is_group_member(gid) and to_day >= from_day and to_day - from_day <= 62
$$;

revoke execute on function public.group_ping_days(uuid, date, date) from public, anon;
grant execute on function public.group_ping_days(uuid, date, date) to authenticated;

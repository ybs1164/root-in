-- root-in: the gallery's 만난 날. For the groups and days asked (the ones
-- the gallery has photos on), every pair of members who were at the same
-- place — a TODAY ping or a sent photo of each within 50 m, the client's
-- SAME_PLACE_M — on that day. Only who and when leave: no place, no time.
-- Groups I'm not in are skipped; 30 groups and 400 days at most.

create function public.group_met_days(gids uuid[], days date[])
returns table (group_id uuid, day date, user_a uuid, user_b uuid)
language sql stable security definer set search_path = pg_catalog as $$
  with asked as (
    select g.id from public.groups g
     where g.id = any (gids) and public.is_group_member(g.id)
       and cardinality(gids) <= 30 and cardinality(days) <= 400
  ),
  spots as (
    select m.group_id, k.day, k.user_id,
           (k.place -> 'center' ->> 0)::float8 as lng, (k.place -> 'center' ->> 1)::float8 as lat
      from public.group_members m
      join asked a on a.id = m.group_id
      join public.pings k on k.user_id = m.user_id
     where k.day = any (days) and k.deleted_at is null
       and jsonb_typeof(k.place -> 'center') = 'array'
    union all
    select f.group_id, f.day, f.user_id, (f.center ->> 0)::float8, (f.center ->> 1)::float8
      from public.group_photos f
      join asked a on a.id = f.group_id
      join public.group_members m on m.group_id = f.group_id and m.user_id = f.user_id
     where f.day = any (days)
  )
  select distinct a.group_id, a.day, a.user_id, b.user_id
    from spots a
    join spots b on b.group_id = a.group_id and b.day = a.day and a.user_id < b.user_id
   -- Metres on a flat patch of map: close enough for 50 m.
   where sqrt(power((a.lat - b.lat) * 111320, 2) + power((a.lng - b.lng) * 111320 * cos(radians((a.lat + b.lat) / 2)), 2)) <= 50
$$;

revoke execute on function public.group_met_days(uuid[], date[]) from public, anon;
grant execute on function public.group_met_days(uuid[], date[]) to authenticated;

notify pgrst, 'reload schema';

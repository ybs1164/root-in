-- A group's map is only the photos sent to it (2026-11-13): a TODAY ping no
-- longer reaches any group — not on its map, not in its calendar, not as a
-- 새로운 루트 alert. A place exists there while a photo of it does, so
-- deleting its last photo takes the place with it.
-- Needs 20261113000000_group_ping_looks.sql first (my_groups is redefined).

-- TODAY pings tell nobody; photos sent to a group still do (group_photos_place_news).
drop trigger if exists pings_news on public.pings;

-- my_groups: as before, each member's pings being only the photos they sent this group.
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'cover_path', g.cover_path, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'color', m.color, 'nickname', p.nickname,
        'own_profile', m.own_profile,
        'alias', case when m.own_profile then m.alias end,
        'avatar_path', case when m.own_profile and m.photo_path is not null then m.photo_path else p.avatar_path end,
        'group_alias', case when m.user_id = auth.uid() then m.alias end,
        'group_photo', case when m.user_id = auth.uid() then m.photo_path end,
        'looks', (select l.looks from public.group_ping_looks l where l.group_id = g.id and l.user_id = m.user_id),
        'pings', (select coalesce(jsonb_agg(jsonb_build_object('at', f.at, 'center', f.center, 'name', f.name, 'photo', f.path) order by f.at), '[]'::jsonb)
                      from public.group_photos f where f.group_id = g.id and f.user_id = m.user_id and f.day = on_day)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;


-- The group calendar: who sent this group a photo on each day.
create or replace function public.group_ping_days(gid uuid, from_day date, to_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'user_id', x.user_id) order by x.day), '[]'::jsonb)
  from (
    select distinct f.day, f.user_id
      from public.group_photos f join public.group_members m on m.user_id = f.user_id and m.group_id = gid
      where f.group_id = gid and f.day between from_day and to_day
  ) x
  where public.is_group_member(gid) and to_day >= from_day and to_day - from_day <= 62
$$;

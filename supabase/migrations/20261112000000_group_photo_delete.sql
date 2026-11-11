-- root-in: taking my own photos and places off a group's map.
--
-- In a group (the photo panel's … menu):
--   사진 삭제 — that one photo leaves that group only (delete_group_photos).
--   핀 삭제   — the whole place leaves that group only: every photo I sent
--               there (delete_group_photos) and my TODAY pings of it, which
--               every group of mine sees, hidden from this one
--               (hide_group_pings → group_ping_hides).
-- From TODAY (a ping's ✕): the ping goes from every group with it (its
-- deleted_at, as before) and so do the photos I sent from that place that
-- day, from every group (delete_place_photos).
--
-- A photo no group has any more is gone for good: the functions hand back
-- those paths for the app to delete from the bucket (only the owner can).
-- Needs 20261109000001_group_covers.sql first (my_groups is redefined).

create table if not exists public.group_ping_hides (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ping_id text not null check (char_length(ping_id) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, ping_id)
);
alter table public.group_ping_hides enable row level security;
drop policy if exists "own hides" on public.group_ping_hides;
create policy "own hides" on public.group_ping_hides for select using (user_id = auth.uid());

-- My photos at `paths` off group `gid` (null: every group); { deleted, gone }
-- with `gone` the paths no group has any more.
create or replace function public.delete_group_photos(gid uuid, paths text[]) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare n integer;
begin
  if auth.uid() is null or paths is null or cardinality(paths) > 100 then
    return jsonb_build_object('deleted', 0, 'gone', '[]'::jsonb);
  end if;
  delete from public.group_photos f
   where f.user_id = auth.uid() and f.path = any (paths) and (gid is null or f.group_id = gid);
  get diagnostics n = row_count;
  return jsonb_build_object('deleted', n, 'gone', coalesce((
    select jsonb_agg(distinct p) from unnest(paths) p
     where split_part(p, '/', 1) = auth.uid()::text
       and not exists (select 1 from public.group_photos f where f.path = p)), '[]'::jsonb));
end $$;

-- My TODAY pings `ids` hidden from group `gid` (I'm in); how many are hidden now.
create or replace function public.hide_group_pings(gid uuid, ids text[]) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare n integer;
begin
  if auth.uid() is null or ids is null or cardinality(ids) > 100 or not public.is_group_member(gid) then return 0; end if;
  insert into public.group_ping_hides (group_id, user_id, ping_id)
    select distinct gid, auth.uid(), i from unnest(ids) i where char_length(i) between 1 and 64
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- TODAY's ✕: my photos sent from that place that day (within 50 m, the
-- client's SAME_PLACE_M, and the same name) off every group; as delete_group_photos.
create or replace function public.delete_place_photos(on_day date, ping_center jsonb, place_name text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare paths text[]; lng float8; lat float8;
begin
  if auth.uid() is null or jsonb_typeof(ping_center) <> 'array' then
    return jsonb_build_object('deleted', 0, 'gone', '[]'::jsonb);
  end if;
  lng := (ping_center ->> 0)::float8;
  lat := (ping_center ->> 1)::float8;
  select array_agg(distinct f.path) into paths from public.group_photos f
   where f.user_id = auth.uid() and f.day = on_day and f.name = left(btrim(place_name), 80)
     and sqrt(power(((f.center ->> 1)::float8 - lat) * 111320, 2)
            + power(((f.center ->> 0)::float8 - lng) * 111320 * cos(radians(lat)), 2)) <= 50;
  if paths is null then return jsonb_build_object('deleted', 0, 'gone', '[]'::jsonb); end if;
  return public.delete_group_photos(null, paths);
end $$;

revoke execute on function public.delete_group_photos(uuid, text[]) from public, anon;
grant execute on function public.delete_group_photos(uuid, text[]) to authenticated;
revoke execute on function public.hide_group_pings(uuid, text[]) from public, anon;
grant execute on function public.hide_group_pings(uuid, text[]) to authenticated;
revoke execute on function public.delete_place_photos(date, jsonb, text) from public, anon;
grant execute on function public.delete_place_photos(date, jsonb, text) to authenticated;

-- my_groups: as before, without the TODAY pings their owner hid from the group.
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
        'pings', (select coalesce(jsonb_agg(x.ping order by x.at), '[]'::jsonb) from (
                    select k.at, jsonb_build_object('at', k.at, 'center', k.place -> 'center', 'name', left(k.place ->> 'name', 80)) as ping
                      from public.pings k where k.user_id = m.user_id and k.day = on_day and k.deleted_at is null
                       and not exists (select 1 from public.group_ping_hides h
                                        where h.group_id = g.id and h.user_id = k.user_id and h.ping_id = k.id)
                    union all
                    select f.at, jsonb_build_object('at', f.at, 'center', f.center, 'name', f.name, 'photo', f.path)
                      from public.group_photos f where f.group_id = g.id and f.user_id = m.user_id and f.day = on_day
                  ) x)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;

notify pgrst, 'reload schema';

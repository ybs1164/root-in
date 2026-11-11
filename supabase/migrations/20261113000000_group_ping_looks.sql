-- root-in: on a group's map a member long-presses their own ping or the line
-- between two for its shape (핀·점·별·하트·투명) or style (실선·파선·점선·굵은
-- 선·투명) — in that group only, seen by everyone in it. One row per member
-- per group: { pings: { <key>: look }, edges: { <key>: look } }, the keys
-- being the pings' times (the app's pingLookKey / edgeLookKey). my_groups
-- sends each member's as `looks`.
-- Needs 20261112000000_group_photo_delete.sql first (my_groups is redefined).

create table if not exists public.group_ping_looks (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  looks jsonb not null default '{"pings": {}, "edges": {}}'::jsonb check (octet_length(looks::text) <= 65536),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_ping_looks enable row level security;
-- Read through my_groups only.

-- One of my looks in group `gid` (I'm in): `look_kind` 'ping' or 'edge', its
-- key, the look (null: back to the plain pin / solid line). True when kept.
create or replace function public.set_group_look(gid uuid, look_kind text, look_key text, new_look text) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare bag text; kept jsonb;
begin
  if auth.uid() is null or not public.is_group_member(gid) then return false; end if;
  if look_kind = 'ping' then bag := 'pings';
  elsif look_kind = 'edge' then bag := 'edges';
  else return false; end if;
  if look_key is null or look_key !~ '^[0-9T:.\-Z>]{10,120}$' then return false; end if;
  if new_look is not null and not (
       (bag = 'pings' and new_look in ('transparent', 'pin', 'dot', 'star', 'heart'))
    or (bag = 'edges' and new_look in ('transparent', 'solid', 'dashed', 'dotted', 'bold'))) then
    return false;
  end if;
  insert into public.group_ping_looks (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  select coalesce(looks -> bag, '{}'::jsonb) into kept
    from public.group_ping_looks where group_id = gid and user_id = auth.uid() for update;
  if new_look is null then kept := kept - look_key;
  else
    -- 600 of a kind at most (a new key past that is refused; changing one is fine).
    if not (kept ? look_key) and (select count(*) from jsonb_object_keys(kept)) >= 600 then return false; end if;
    kept := kept || jsonb_build_object(look_key, new_look);
  end if;
  update public.group_ping_looks
     set looks = jsonb_set(looks, array[bag], kept, true), updated_at = now()
   where group_id = gid and user_id = auth.uid();
  return true;
end $$;

revoke execute on function public.set_group_look(uuid, text, text, text) from public, anon;
grant execute on function public.set_group_look(uuid, text, text, text) to authenticated;

-- my_groups: as before, with each member's looks in the group.
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

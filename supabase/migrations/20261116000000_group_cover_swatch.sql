-- root-in: a colour for the group's own (shared) cover — one of the four
-- app themes (domain/decor.ts APP_COVER_THEMES: 말차·바나나·초코·딸기), picked
-- by the maker in 새 그룹/그룹 관리 next to COVER. Shown to any member whose
-- own MY COVER (goodroot:group-cover-override:v1, this phone only) hasn't
-- overridden it; null keeps each viewer's own app theme, as before.
-- Needs 20261109000001_group_covers.sql first (cover/cover_path, set_group_cover).

alter table public.groups add column if not exists cover_swatch text
  check (cover_swatch in ('matcha', 'banana', 'choco', 'strawberry'));

drop function if exists public.create_group(text, smallint, text);
create function public.create_group(group_name text, group_cover smallint, slug text, group_swatch text default null) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare gid uuid;
begin
  if auth.uid() is null then return null; end if;
  if group_swatch not in ('matcha', 'banana', 'choco', 'strawberry') then group_swatch := null; end if;
  insert into public.groups (name, cover, cover_swatch, owner_id, invite_slug)
       values (btrim(group_name), group_cover, group_swatch, auth.uid(), slug) returning id into gid;
  if not public.add_group_member(gid) then raise exception 'too many groups'; end if;
  return gid;
end $$;
revoke execute on function public.create_group(text, smallint, text, text) from public, anon;
grant execute on function public.create_group(text, smallint, text, text) to authenticated;

drop function if exists public.set_group_cover(uuid, smallint, text);
create function public.set_group_cover(gid uuid, new_cover smallint, new_photo text, new_swatch text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare before text;
begin
  if auth.uid() is null or new_cover is null or new_cover not between 0 and 6 then return jsonb_build_object('ok', false); end if;
  if new_photo is not null and new_photo <> '' and split_part(new_photo, '/', 1) <> auth.uid()::text then
    return jsonb_build_object('ok', false);
  end if;
  if new_swatch not in ('matcha', 'banana', 'choco', 'strawberry') then new_swatch := null; end if;
  select cover_path into before from public.groups where id = gid and owner_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;
  update public.groups
     set cover = new_cover,
         cover_swatch = new_swatch,
         cover_path = case when new_photo is null then cover_path when new_photo = '' then null else new_photo end
   where id = gid and owner_id = auth.uid();
  return jsonb_build_object('ok', true, 'old_photo',
    case when new_photo is not null and before is distinct from nullif(new_photo, '') then before end);
end $$;
revoke execute on function public.set_group_cover(uuid, smallint, text, text) from public, anon;
grant execute on function public.set_group_cover(uuid, smallint, text, text) to authenticated;

-- my_groups: as before, with the cover's colour.
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'cover_path', g.cover_path, 'cover_swatch', g.cover_swatch, 'invite_slug', g.invite_slug,
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

notify pgrst, 'reload schema';

-- root-in: seven cover patterns (was four), and a cover photo of the
-- group's own, picked from the gallery by its maker. The photo lives in the
-- avatars bucket under the maker's folder (<uid>/c<random>.jpg, a new name
-- each time); the pattern stays underneath for when the photo is taken off.
-- Needs 20261103000000_group_profiles.sql first (my_groups is redefined
-- from it). Safe to run again after a failed try.

alter table public.groups drop constraint if exists groups_cover_check;
alter table public.groups add constraint groups_cover_check check (cover between 0 and 6);
alter table public.groups add column if not exists cover_path text
  check (cover_path ~ '^[0-9a-f-]{36}/c[A-Za-z0-9_-]{6,40}\.jpg$');

-- The group's cover (its maker only): the pattern, and the photo (null: keep
-- it, '': none, else a path of mine). The photo it replaced comes back as
-- `old_photo`, for the app to delete.
create or replace function public.set_group_cover(gid uuid, new_cover smallint, new_photo text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare before text;
begin
  if auth.uid() is null or new_cover is null or new_cover not between 0 and 6 then return jsonb_build_object('ok', false); end if;
  if new_photo is not null and new_photo <> '' and split_part(new_photo, '/', 1) <> auth.uid()::text then
    return jsonb_build_object('ok', false);
  end if;
  select cover_path into before from public.groups where id = gid and owner_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;
  update public.groups
     set cover = new_cover,
         cover_path = case when new_photo is null then cover_path when new_photo = '' then null else new_photo end
   where id = gid and owner_id = auth.uid();
  return jsonb_build_object('ok', true, 'old_photo',
    case when new_photo is not null and before is distinct from nullif(new_photo, '') then before end);
end $$;
revoke execute on function public.set_group_cover(uuid, smallint, text) from public, anon;
grant execute on function public.set_group_cover(uuid, smallint, text) to authenticated;

-- my_groups: as before, with the cover photo's path.
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

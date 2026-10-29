-- root-in: in each group a member uses either their 통합 프로필 (the profile's
-- photo and nickname, following it) or an 개별 프로필 just for that group (its
-- own photo and name). The group's photo lives in the avatars bucket under
-- the member's own folder (<uid>/g<random>.jpg); the stored name is the old
-- alias column. Switching back to 통합 keeps the group's ones for next time.
-- Needs 20261031000000_group_member_color.sql first (my_groups sends the
-- colour). Safe to run again after a failed try (if not exists / or replace).

alter table public.group_members add column if not exists own_profile boolean not null default false;
alter table public.group_members add column if not exists photo_path text
  check (photo_path ~ '^[0-9a-f-]{36}/g[A-Za-z0-9_-]{6,40}\.jpg$');

-- Members who gave the group a name of its own keep showing it.
update public.group_members m
   set own_profile = true
  from public.profiles p
 where p.id = m.user_id and m.alias is not null and m.alias <> left(btrim(coalesce(p.nickname, '')), 20);

-- My profile in a group: `own` picks which one shows; with it, a name (not
-- empty) and the photo (null: keep it, '': none, else a path of mine). The
-- photo it replaced comes back as `old_photo`, for the app to delete.
create or replace function public.set_group_profile(gid uuid, own boolean, new_alias text, new_photo text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare before text;
begin
  if auth.uid() is null or not public.is_group_member(gid) then return jsonb_build_object('ok', false); end if;
  if own and btrim(coalesce(new_alias, '')) = '' then return jsonb_build_object('ok', false); end if;
  if new_photo is not null and new_photo <> '' and split_part(new_photo, '/', 1) <> auth.uid()::text then
    return jsonb_build_object('ok', false);
  end if;
  select photo_path into before from public.group_members where group_id = gid and user_id = auth.uid();
  update public.group_members
     set own_profile = own,
         alias = case when own then left(btrim(new_alias), 20) else alias end,
         photo_path = case when new_photo is null then photo_path when new_photo = '' then null else new_photo end
   where group_id = gid and user_id = auth.uid();
  return jsonb_build_object('ok', true, 'old_photo',
    case when new_photo is not null and before is distinct from nullif(new_photo, '') then before end);
end $$;
revoke execute on function public.set_group_profile(uuid, boolean, text, text) from public, anon;
grant execute on function public.set_group_profile(uuid, boolean, text, text) to authenticated;

-- my_groups: as before, with each member's photo and name as the group
-- shows them, and for my own row the group's ones even while I use 통합.
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
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

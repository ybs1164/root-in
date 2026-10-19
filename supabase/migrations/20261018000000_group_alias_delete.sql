-- root-in: 그룹 설정. A member's own name in a group (내 별명, shown to the
-- group instead of their nickname) and 그룹 삭제 for the group's maker.

alter table public.group_members
  add column alias text check (alias is null or char_length(alias) between 1 and 20);

-- An empty name clears it (back to the profile nickname).
create function public.set_group_alias(gid uuid, new_alias text) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with done as (
    update public.group_members set alias = nullif(btrim(new_alias), '')
     where group_id = gid and user_id = auth.uid()
    returning 1)
  select exists (select 1 from done)
$$;

-- The whole group, for everyone in it (members go with it).
create function public.delete_group(gid uuid) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with gone as (delete from public.groups where id = gid and owner_id = auth.uid() returning 1)
  select exists (select 1 from gone)
$$;

-- As before, with each member's alias.
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'nickname', p.nickname, 'alias', m.alias, 'avatar_path', p.avatar_path,
        'pings', (select coalesce(jsonb_agg(jsonb_build_object('at', k.at, 'center', k.place -> 'center') order by k.at), '[]'::jsonb)
                    from public.pings k where k.user_id = m.user_id and k.day = on_day and k.deleted_at is null)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;

revoke execute on function public.set_group_alias(uuid, text), public.delete_group(uuid) from public, anon;
grant execute on function public.set_group_alias(uuid, text), public.delete_group(uuid) to authenticated;

notify pgrst, 'reload schema';

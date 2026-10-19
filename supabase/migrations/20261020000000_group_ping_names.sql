-- root-in: a group member picked on the map shows the names of the places
-- they pinged today, so my_groups now sends each ping's place name too (still
-- never the address; pings at a 제외 주소 never reach the server at all).

create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'nickname', p.nickname, 'alias', m.alias, 'avatar_path', p.avatar_path,
        'pings', (select coalesce(jsonb_agg(jsonb_build_object(
                    'at', k.at, 'center', k.place -> 'center', 'name', left(k.place ->> 'name', 80)
                  ) order by k.at), '[]'::jsonb)
                    from public.pings k where k.user_id = m.user_id and k.day = on_day and k.deleted_at is null)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;

notify pgrst, 'reload schema';

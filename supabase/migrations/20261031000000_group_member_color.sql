-- root-in: each member picks their own colour in a group (그룹 설정's palette).
-- The colour is its own column rather than the slot: the slot also orders the
-- member row, which shouldn't jump when someone changes colour. 20 colours for
-- at most 20 members, never two the same in a group.

alter table public.group_members add column color smallint check (color between 0 and 19);
-- Members already in a group keep what they show now (the colour followed the slot).
update public.group_members set color = slot where color is null;
alter table public.group_members alter column color set not null;
alter table public.group_members add constraint group_members_color_key unique (group_id, color);

-- As before, with the first colour nobody in the group has yet.
create or replace function public.add_group_member(gid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare free smallint;
declare hue smallint;
declare nick text;
begin
  if auth.uid() is null then return false; end if;
  if public.is_group_member(gid) then return true; end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 30 then return false; end if;
  select s into free from generate_series(0, 19) s
   where s not in (select slot from public.group_members where group_id = gid) order by s limit 1;
  if free is null then return false; end if;
  select s into hue from generate_series(0, 19) s
   where s not in (select color from public.group_members where group_id = gid) order by s limit 1;
  if hue is null then return false; end if;
  select nullif(left(btrim(nickname), 20), '') into nick from public.profiles where id = auth.uid();
  insert into public.group_members (group_id, user_id, slot, color, alias) values (gid, auth.uid(), free, hue, nick);
  return true;
end $$;
revoke execute on function public.add_group_member(uuid) from public, anon, authenticated;

-- My colour in a group: false when someone else has it (the unique key says no).
create function public.set_group_color(gid uuid, new_color smallint) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new_color is null or new_color < 0 or new_color > 19 then return false; end if;
  update public.group_members set color = new_color where group_id = gid and user_id = auth.uid();
  return found;
exception when unique_violation then
  return false;
end $$;
revoke execute on function public.set_group_color(uuid, smallint) from public, anon;
grant execute on function public.set_group_color(uuid, smallint) to authenticated;

-- my_groups: as before, with each member's colour.
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'color', m.color, 'nickname', p.nickname, 'alias', m.alias, 'avatar_path', p.avatar_path,
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

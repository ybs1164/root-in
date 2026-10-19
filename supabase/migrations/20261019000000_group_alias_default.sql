-- root-in: a member's name in a group starts as their profile nickname when
-- they join (written into group_members.alias), and from then on only
-- changes when they change it there — a profile rename doesn't follow, and
-- it can't be emptied.

-- Members already in a group keep what they show now.
update public.group_members m
   set alias = left(btrim(p.nickname), 20)
  from public.profiles p
 where p.id = m.user_id and m.alias is null and btrim(p.nickname) <> '';

-- As before, with the joiner's profile nickname as their name in the group.
create or replace function public.add_group_member(gid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare free smallint;
declare nick text;
begin
  if auth.uid() is null then return false; end if;
  if public.is_group_member(gid) then return true; end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 30 then return false; end if;
  select s into free from generate_series(0, 19) s
   where s not in (select slot from public.group_members where group_id = gid) order by s limit 1;
  if free is null then return false; end if;
  select nullif(left(btrim(nickname), 20), '') into nick from public.profiles where id = auth.uid();
  insert into public.group_members (group_id, user_id, slot, alias) values (gid, auth.uid(), free, nick);
  return true;
end $$;
revoke execute on function public.add_group_member(uuid) from public, anon, authenticated;

-- A name can be changed, not emptied.
create or replace function public.set_group_alias(gid uuid, new_alias text) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with done as (
    update public.group_members set alias = btrim(new_alias)
     where group_id = gid and user_id = auth.uid() and btrim(coalesce(new_alias, '')) <> ''
    returning 1)
  select exists (select 1 from done)
$$;

notify pgrst, 'reload schema';

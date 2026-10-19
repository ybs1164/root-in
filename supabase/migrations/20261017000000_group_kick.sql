-- root-in: 그룹원 관리 → 추방. Only the group's maker can send someone out,
-- and not themselves (they leave with 그룹 나가기). The member's colour slot
-- frees up for the next to join.

create function public.kick_group_member(gid uuid, member uuid) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with gone as (
    delete from public.group_members m
     where m.group_id = gid and m.user_id = member and member <> auth.uid()
       and exists (select 1 from public.groups g where g.id = gid and g.owner_id = auth.uid())
    returning 1)
  select exists (select 1 from gone)
$$;

revoke execute on function public.kick_group_member(uuid, uuid) from public, anon;
grant execute on function public.kick_group_member(uuid, uuid) to authenticated;

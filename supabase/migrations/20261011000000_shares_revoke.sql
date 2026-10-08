-- root-in: short links stop working when their route is deleted, and count
-- how many people added the route (docs/schema-plan.md D).

alter table public.shares
  -- Day (#diary=) and pin-set (#pins=) links will share this table; course_id is for routes only.
  add column kind text not null default 'route' check (kind in ('route', 'day', 'pins')),
  -- A revoked link opens to nothing, like one that never existed.
  add column revoked_at timestamptz,
  -- Times someone pressed 루트 추가 on it (not its owner).
  add column add_count integer not null default 0,
  add column last_opened_at timestamptz;

-- Deleting a route (a deletion mark, on any device) revokes its links. A route
-- brought back later keeps them revoked: sharing it again makes a new link.
-- No quotes inside the $$ bodies (see 20261009000000_shares.sql).
create function public.revoke_shares_of_deleted_course()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.shares
       set revoked_at = now()
     where owner_id = new.user_id
       and course_id = new.id
       and revoked_at is null;
  end if;
  return new;
end
$$;
create trigger revoke_shares after update of deleted_at on public.courses
  for each row execute function public.revoke_shares_of_deleted_course();

-- open_share as before (20261009000000_shares.sql), but a revoked link returns
-- null, and a counted open records when.
drop function if exists public.open_share(text, boolean);
create function public.open_share(share_slug text, count_open boolean default true)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  with bumped as (
    update public.shares
       set open_count = open_count + 1,
           last_opened_at = now()
     where slug = share_slug
       and revoked_at is null
       and count_open
       and owner_id is distinct from auth.uid()
    returning open_count
  )
  select jsonb_build_object(
    'snapshot', s.snapshot,
    'open_count', coalesce((select b.open_count from bumped b), s.open_count),
    'owner', jsonb_build_object('nickname', p.nickname, 'handle', p.handle, 'avatar_path', p.avatar_path)
  )
  from public.shares s
  left join public.profiles p on p.id = s.owner_id
  where s.slug = share_slug
    and s.revoked_at is null
$$;
grant execute on function public.open_share(text, boolean) to anon, authenticated;

-- 루트 추가 on a received short link. Anyone may call it (adding works signed
-- out too); it can only add one, and the owner adding their own doesn't count.
create function public.count_share_add(share_slug text)
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  update public.shares
     set add_count = add_count + 1
   where slug = share_slug
     and revoked_at is null
     and owner_id is distinct from auth.uid()
$$;
grant execute on function public.count_share_add(text) to anon, authenticated;

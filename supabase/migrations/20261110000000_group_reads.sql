-- root-in: who has read a group's 대화 up to when. One row per member per
-- group: the time they last had the 대화 open. From it the app shows, beside
-- each line, how many members haven't read it yet (as a messenger does), and
-- on the 대화 buttons how many lines I haven't read.
-- Needs 20261105000000_group_chat.sql and 20261108000000_realtime_talk.sql first.
-- Safe to run again after a failed try.

create table if not exists public.group_reads (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_reads enable row level security;
-- Members read the group's rows (also what lets Realtime send them); written through mark_group_read().
drop policy if exists "members read" on public.group_reads;
create policy "members read" on public.group_reads for select to authenticated
  using (public.is_group_member(group_id));

-- I've read the group's 대화 up to now. Never goes back.
create or replace function public.mark_group_read(gid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not public.is_group_member(gid) then return false; end if;
  insert into public.group_reads (group_id, user_id, read_at) values (gid, auth.uid(), now())
  on conflict (group_id, user_id) do update set read_at = greatest(public.group_reads.read_at, excluded.read_at);
  return true;
end $$;

-- Each member's last read of the group's 대화 (nothing for a group I'm not in).
create or replace function public.group_reads(gid uuid)
returns table (user_id uuid, read_at timestamptz)
language sql stable security definer set search_path = pg_catalog as $$
  select r.user_id, r.read_at from public.group_reads r
   join public.group_members m on m.group_id = r.group_id and m.user_id = r.user_id
   where r.group_id = gid and public.is_group_member(gid)
$$;

-- Per group of mine, how many lines of its 대화 (photos sent to it, comments
-- on those, messages) others wrote since I last read it — since I joined if
-- I never have. Counted up to 300, the most the 대화 shows.
create or replace function public.my_unread_talk() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_object_agg(g.group_id, g.n), '{}'::jsonb) from (
    select m.group_id, least(300, (
      (select count(*) from public.group_photos f
        where f.group_id = m.group_id and f.user_id <> auth.uid() and f.created_at > since.t)
      + (select count(*) from public.photo_comments c
          where c.user_id <> auth.uid() and c.created_at > since.t
            and exists (select 1 from public.group_photos f where f.group_id = m.group_id and f.path = c.path))
      + (select count(*) from public.group_messages x
          where x.group_id = m.group_id and x.user_id <> auth.uid() and x.created_at > since.t)
    )) as n
    from public.group_members m
    cross join lateral (
      select coalesce((select r.read_at from public.group_reads r where r.group_id = m.group_id and r.user_id = m.user_id), m.joined_at) as t
    ) since
    where m.user_id = auth.uid()
  ) g
$$;

revoke execute on function public.mark_group_read(uuid), public.group_reads(uuid), public.my_unread_talk() from public, anon;
grant execute on function public.mark_group_read(uuid), public.group_reads(uuid), public.my_unread_talk() to authenticated;

-- Someone reading comes in live too (the numbers beside the lines go down).
do $$
begin
  alter publication supabase_realtime add table public.group_reads;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

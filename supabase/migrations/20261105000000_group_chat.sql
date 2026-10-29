-- root-in: a group's 대화 (the button at the bottom-right of a group's map).
-- One feed, oldest to newest, of what happened in the group: the photos
-- sent to it (with their place), the comments on those photos, and plain
-- messages written in the 대화 itself. Only members read or write.

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index group_messages_group_idx on public.group_messages (group_id, created_at);

alter table public.group_messages enable row level security;
-- Read through group_feed(); written through send_group_message().

-- A message in a group of mine; its id, or null when it can't be.
create function public.send_group_message(gid uuid, message text) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare new_id uuid;
begin
  if auth.uid() is null or not public.is_group_member(gid) then return null; end if;
  if char_length(btrim(coalesce(message, ''))) not between 1 and 200 then return null; end if;
  -- Not a flood: 30 a minute each.
  if (select count(*) from public.group_messages
       where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then return null; end if;
  insert into public.group_messages (group_id, user_id, body) values (gid, auth.uid(), btrim(message))
    returning id into new_id;
  return new_id;
end $$;

-- The group's feed, the newest 300 (the app shows them oldest first):
-- kind 'photo' (path, place), 'comment' (body, and the photo it's on:
-- path, place) or 'message' (body). Who by id only — the app has the
-- members' faces and names — and whether it's mine. Nothing for a group
-- I'm not in.
create function public.group_feed(gid uuid)
returns table (kind text, id uuid, user_id uuid, at timestamptz, body text, path text, place text, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select feed.*, feed.user_id = auth.uid() from (
    select 'photo'::text as kind, f.id, f.user_id, f.created_at as at, null::text as body, f.path, f.name as place
      from public.group_photos f where f.group_id = gid
    union all
    select 'comment', c.id, c.user_id, c.created_at, c.body, c.path,
           (select f.name from public.group_photos f where f.group_id = gid and f.path = c.path limit 1)
      from public.photo_comments c
     where exists (select 1 from public.group_photos f where f.group_id = gid and f.path = c.path)
    union all
    select 'message', m.id, m.user_id, m.created_at, m.body, null, null
      from public.group_messages m where m.group_id = gid
  ) feed
  where public.is_group_member(gid)
  order by feed.at desc
  limit 300
$$;

revoke execute on function public.send_group_message(uuid, text), public.group_feed(uuid) from public, anon;
grant execute on function public.send_group_message(uuid, text), public.group_feed(uuid) to authenticated;

notify pgrst, 'reload schema';

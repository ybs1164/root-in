-- root-in: a group 대화's long press (and swipe) — 답장 · 모두에게 삭제 · 나에게만 삭제.
--   답장           — a message can answer any line of the 대화 (a photo, a
--                     comment, a message): reply_kind + reply_id on it, and
--                     group_feed hands them back so the app quotes that line.
--   모두에게 삭제   — only my own line: a message stays as '삭제된 메시지예요'
--                     (deleted_at, its text never sent again, so replies to it
--                     still have something to point at); a comment is deleted;
--                     a photo leaves this group (delete_group_photos, as before).
--   나에게만 삭제   — the app hides the line on this phone; nothing here.
-- Others see a deletion live: the same 'feed' note on the group's channel,
-- under a fresh id (the app skips notes about lines it already shows).
-- Needs 20261105000000_group_chat.sql and 20261109000000_realtime_group_events.sql.

alter table public.group_messages
  add column if not exists reply_kind text check (reply_kind in ('photo', 'comment', 'message')),
  add column if not exists reply_id uuid,
  add column if not exists deleted_at timestamptz;

-- A message in a group of mine, maybe answering a line there; its id, or null.
drop function if exists public.send_group_message(uuid, text);
create or replace function public.send_group_message(gid uuid, message text, reply_kind text default null, reply_id uuid default null)
returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare new_id uuid;
begin
  if auth.uid() is null or not public.is_group_member(gid) then return null; end if;
  if char_length(btrim(coalesce(message, ''))) not between 1 and 200 then return null; end if;
  if (reply_kind is null) <> (reply_id is null) or (reply_kind is not null and reply_kind not in ('photo', 'comment', 'message')) then
    return null;
  end if;
  if (select count(*) from public.group_messages
       where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then return null; end if;
  insert into public.group_messages (group_id, user_id, body, reply_kind, reply_id)
    values (gid, auth.uid(), btrim(message), send_group_message.reply_kind, send_group_message.reply_id)
    returning id into new_id;
  return new_id;
end $$;

-- My message `mid` deleted for everyone; whether it was.
create or replace function public.delete_group_message(mid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare n integer;
begin
  update public.group_messages set deleted_at = now()
   where id = mid and user_id = auth.uid() and deleted_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- My comment `cid` deleted (from the photo, so from every 대화 with it); whether it was.
create or replace function public.delete_photo_comment(cid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare n integer;
begin
  delete from public.photo_comments where id = cid and user_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- The feed as before, plus what a message answers and whether it was deleted
-- (a deleted one's text is never sent).
drop function if exists public.group_feed(uuid);
create function public.group_feed(gid uuid)
returns table (kind text, id uuid, user_id uuid, at timestamptz, body text, path text, place text,
               reply_kind text, reply_id uuid, deleted boolean, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select feed.*, feed.user_id = auth.uid() from (
    select 'photo'::text as kind, f.id, f.user_id, f.created_at as at, null::text as body, f.path, f.name as place,
           null::text as reply_kind, null::uuid as reply_id, false as deleted
      from public.group_photos f where f.group_id = gid
    union all
    select 'comment', c.id, c.user_id, c.created_at, c.body, c.path,
           (select f.name from public.group_photos f where f.group_id = gid and f.path = c.path limit 1),
           null, null, false
      from public.photo_comments c
     where exists (select 1 from public.group_photos f where f.group_id = gid and f.path = c.path)
    union all
    select 'message', m.id, m.user_id, m.created_at,
           case when m.deleted_at is null then m.body end, null, null,
           m.reply_kind, m.reply_id, m.deleted_at is not null
      from public.group_messages m where m.group_id = gid
  ) feed
  where public.is_group_member(gid)
  order by feed.at desc
  limit 300
$$;

-- A line deleted for everyone: a note on the group's channel so open 대화s read again.
create or replace function public.feed_gone() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  begin
    if tg_table_name = 'group_messages' then
      if new.deleted_at is not null and old.deleted_at is null then
        perform realtime.send(jsonb_build_object('kind', 'message', 'id', gen_random_uuid(), 'by', new.user_id),
                              'feed', 'group:' || new.group_id::text, true);
      end if;
    elsif tg_table_name = 'group_photos' then
      perform realtime.send(jsonb_build_object('kind', 'photo', 'id', gen_random_uuid(), 'by', old.user_id, 'path', old.path),
                            'feed', 'group:' || old.group_id::text, true);
    elsif tg_table_name = 'photo_comments' then
      perform realtime.send(jsonb_build_object('kind', 'comment', 'id', gen_random_uuid(), 'by', old.user_id, 'path', old.path),
                            'feed', 'photo:' || old.path, true);
      perform realtime.send(jsonb_build_object('kind', 'comment', 'id', gen_random_uuid(), 'by', old.user_id, 'path', old.path),
                            'feed', 'group:' || f.group_id::text, true)
         from (select distinct group_id from public.group_photos where path = old.path) f;
    end if;
  exception when others then
    raise warning 'feed_gone: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists group_messages_gone on public.group_messages;
create trigger group_messages_gone after update of deleted_at on public.group_messages
  for each row execute function public.feed_gone();
drop trigger if exists group_photos_gone on public.group_photos;
create trigger group_photos_gone after delete on public.group_photos
  for each row execute function public.feed_gone();
drop trigger if exists photo_comments_gone on public.photo_comments;
create trigger photo_comments_gone after delete on public.photo_comments
  for each row execute function public.feed_gone();

revoke execute on function public.feed_gone() from public, anon, authenticated;
revoke execute on function public.send_group_message(uuid, text, text, uuid), public.group_feed(uuid),
  public.delete_group_message(uuid), public.delete_photo_comment(uuid) from public, anon;
grant execute on function public.send_group_message(uuid, text, text, uuid), public.group_feed(uuid),
  public.delete_group_message(uuid), public.delete_photo_comment(uuid) to authenticated;

notify pgrst, 'reload schema';

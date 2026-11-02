-- root-in: the group 대화 and a big photo's comments, live. When a message,
-- a photo or a comment is written, a short note goes out on a private
-- Realtime channel (Broadcast from Database) and the app reads the feed or
-- the comments again through group_feed() / photo_comments() — so names,
-- checks and who-may-read stay in those functions. The note carries no text:
-- only what kind of line, its id, who wrote it and the photo it's on.
--   group:<group id>   — a line in that group's 대화 (message, photo, comment)
--   photo:<photo path> — a comment on that photo (open big anywhere)
-- In the dashboard, Realtime settings: turn off public channel access.

-- One note: { kind, id, by, path? }, event 'feed'. Never stops the insert.
create function public.feed_news() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare note jsonb;
begin
  begin
    if tg_table_name = 'group_messages' then
      perform realtime.send(jsonb_build_object('kind', 'message', 'id', new.id, 'by', new.user_id),
                            'feed', 'group:' || new.group_id::text, true);
    elsif tg_table_name = 'group_photos' then
      perform realtime.send(jsonb_build_object('kind', 'photo', 'id', new.id, 'by', new.user_id, 'path', new.path),
                            'feed', 'group:' || new.group_id::text, true);
    elsif tg_table_name = 'photo_comments' then
      note := jsonb_build_object('kind', 'comment', 'id', new.id, 'by', new.user_id, 'path', new.path);
      perform realtime.send(note, 'feed', 'photo:' || new.path, true);
      -- Every group the photo was sent to has the comment in its 대화.
      perform realtime.send(note, 'feed', 'group:' || f.group_id::text, true)
         from (select distinct group_id from public.group_photos where path = new.path) f;
    end if;
  exception when others then
    raise warning 'feed_news: %', sqlerrm;
  end;
  return null;
end $$;

create trigger group_messages_news after insert on public.group_messages
  for each row execute function public.feed_news();
create trigger group_photos_news after insert on public.group_photos
  for each row execute function public.feed_news();
create trigger photo_comments_news after insert on public.photo_comments
  for each row execute function public.feed_news();

revoke execute on function public.feed_news() from public, anon, authenticated;

-- Who may join a channel (checked as the joining user, guests included):
-- a group's members its group: channel, those who can see a photo its
-- photo: channel. No insert policy — only the triggers above send.
-- `case` so a malformed topic never reaches the uuid cast.
grant execute on function public.can_see_photo(text) to authenticated;

create policy "group members hear their feed" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when realtime.topic() ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.is_group_member(substr(realtime.topic(), 7)::uuid)
      when realtime.topic() ~ '^photo:[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.jpg$'
        then public.can_see_photo(substr(realtime.topic(), 7))
      else false
    end
  );

-- root-in: the 대화, photo comments and doodles come in live. The app
-- listens to Realtime's postgres_changes on these tables and, on any change,
-- reads again through the same functions as before (group_feed,
-- photo_comments, photo_decors) — the event is only a nudge.
-- Realtime only sends a row to a listener its select policy lets read it,
-- so each table gets the policy its reading function already applies.

grant execute on function public.can_see_photo(text) to authenticated;

create policy "members read" on public.photo_comments for select to authenticated
  using (public.can_see_photo(path));
create policy "members read" on public.group_messages for select to authenticated
  using (public.is_group_member(group_id));
create policy "members read" on public.photo_decor for select to authenticated
  using (public.can_see_photo(path));

-- Doodles can be big (up to 300 kB each): only the key goes out.
alter publication supabase_realtime add table
  public.group_messages,
  public.group_photos,
  public.photo_comments,
  public.photo_decor (path, user_id, updated_at);

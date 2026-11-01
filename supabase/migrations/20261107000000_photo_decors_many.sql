-- root-in: the gallery's squares wear their photos' doodles too, so it reads
-- every layer of many photos at once (one call, not one per square). Same
-- rule as photo_decors: only photos of a group of mine, oldest change first.

create function public.photo_decors_many(photo_paths text[])
returns table (path text, user_id uuid, decor jsonb, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select d.path, d.user_id, d.decor, d.user_id = auth.uid()
    from public.photo_decor d
   where d.path = any (photo_paths[1:600]) and public.can_see_photo(d.path)
   order by d.path, d.updated_at
   limit 6000
$$;

revoke execute on function public.photo_decors_many(text[]) from public, anon;
grant execute on function public.photo_decors_many(text[]) to authenticated;

notify pgrst, 'reload schema';

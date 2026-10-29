-- root-in: doodles on a photo opened big in a group (pen, stickers, text,
-- each in the doodler's colour in that group). Each member keeps one layer
-- per photo (its upload path — one photo sent to several groups is one) and
-- edits only their own; everyone the photo was sent to sees every layer,
-- in the gallery too (there it can't be edited — the app's choice).
-- The layer is the app's DayDecor JSON, checked by the app when read.

create table public.photo_decor (
  path text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.jpg$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  decor jsonb not null check (jsonb_typeof(decor) = 'object' and octet_length(decor::text) <= 300000),
  updated_at timestamptz not null default now(),
  primary key (path, user_id)
);

alter table public.photo_decor enable row level security;
-- Read through photo_decors(); written through set_photo_decor().

-- My layer on a photo of a group of mine: replaced, or gone when `decor` is
-- null. False when the photo isn't in a group of mine.
create function public.set_photo_decor(photo_path text, decor jsonb) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not public.can_see_photo(photo_path) then return false; end if;
  if decor is null then
    delete from public.photo_decor where path = photo_path and user_id = auth.uid();
    return true;
  end if;
  if jsonb_typeof(decor) <> 'object' or octet_length(decor::text) > 300000 then return false; end if;
  insert into public.photo_decor (path, user_id, decor) values (photo_path, auth.uid(), decor)
    on conflict (path, user_id) do update set decor = excluded.decor, updated_at = now();
  return true;
end $$;

-- Every layer on a photo of a group of mine, oldest change first (drawn in
-- that order), and whether it's mine.
create function public.photo_decors(photo_path text)
returns table (user_id uuid, decor jsonb, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select d.user_id, d.decor, d.user_id = auth.uid()
    from public.photo_decor d
   where d.path = photo_path and public.can_see_photo(photo_path)
   order by d.updated_at
   limit 20
$$;

revoke execute on function public.set_photo_decor(text, jsonb), public.photo_decors(text) from public, anon;
grant execute on function public.set_photo_decor(text, jsonb), public.photo_decors(text) to authenticated;

notify pgrst, 'reload schema';

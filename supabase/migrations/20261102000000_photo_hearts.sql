-- root-in: a heart on a photo in the gallery. Hearting tells the photo's
-- sender (an in-app notice the next time their app looks); nobody sees how
-- many hearts a photo has. A heart is on the upload (its path in
-- group-photos — one photo sent to several groups is one), from someone in
-- a group it was sent to, never on one's own photo.

create table public.photo_hearts (
  path text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.jpg$'),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- When the sender's app showed it (null: not yet).
  seen_at timestamptz,
  primary key (path, from_user)
);
create index photo_hearts_to_idx on public.photo_hearts (to_user, seen_at);

alter table public.photo_hearts enable row level security;
-- My own hearts (which photos I hearted); the ones on my photos come through heart_news.
create policy "own hearts read" on public.photo_hearts for select using (from_user = auth.uid());

-- Heart (on) or take it back (off). False when the photo isn't in a group of mine, or it's mine.
create function public.heart_photo(photo_path text, heart boolean) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare owner uuid;
begin
  if auth.uid() is null then return false; end if;
  select f.user_id into owner from public.group_photos f
   where f.path = photo_path and public.is_group_member(f.group_id) limit 1;
  if owner is null or owner = auth.uid() then return false; end if;
  if heart then
    insert into public.photo_hearts (path, from_user, to_user) values (photo_path, auth.uid(), owner)
      on conflict (path, from_user) do nothing;
  else
    delete from public.photo_hearts where path = photo_path and from_user = auth.uid();
  end if;
  return true;
end $$;

-- The hearts on my photos my app hasn't shown yet, newest first, with who
-- (their name in a group we share, else their nickname) and where the photo was taken.
create function public.heart_news() returns table (path text, from_user uuid, nickname text, place text, at timestamptz)
language sql stable security definer set search_path = pg_catalog as $$
  select h.path, h.from_user,
         coalesce(
           (select m.alias from public.group_members m
              join public.group_members mine on mine.group_id = m.group_id and mine.user_id = auth.uid()
             where m.user_id = h.from_user and m.alias is not null limit 1),
           nullif(btrim(p.nickname), ''), '누군가'),
         (select f.name from public.group_photos f where f.path = h.path limit 1),
         h.created_at
    from public.photo_hearts h left join public.profiles p on p.id = h.from_user
   where h.to_user = auth.uid() and h.seen_at is null
   order by h.created_at desc
   limit 50
$$;

-- Shown: the hearts on my photos up to `upto` stop coming back.
create function public.hearts_seen(upto timestamptz) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with done as (
    update public.photo_hearts set seen_at = now()
     where to_user = auth.uid() and seen_at is null and created_at <= upto
    returning 1)
  select true
$$;

revoke execute on function public.heart_photo(text, boolean), public.heart_news(), public.hearts_seen(timestamptz) from public, anon;
grant execute on function public.heart_photo(text, boolean), public.heart_news(), public.hearts_seen(timestamptz) to authenticated;

notify pgrst, 'reload schema';

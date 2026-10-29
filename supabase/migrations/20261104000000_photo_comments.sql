-- root-in: comments on a photo opened big (a group's map, the gallery).
-- A comment is on the upload (its path in group-photos — one photo sent to
-- several groups is one), from anyone in a group it was sent to, the
-- sender too; everyone in those groups reads them. TODAY's photos never
-- leave the phone, so their comments don't either (the app keeps them).

create table public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  path text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.jpg$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index photo_comments_path_idx on public.photo_comments (path, created_at);

alter table public.photo_comments enable row level security;
-- Read through photo_comments(); written through comment_photo().

-- Whether the photo at `photo_path` was sent to a group of mine.
create function public.can_see_photo(photo_path text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (select 1 from public.group_photos f where f.path = photo_path and public.is_group_member(f.group_id))
$$;

-- A comment on a photo of a group of mine; its id, or null when it can't be.
create function public.comment_photo(photo_path text, comment text) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare new_id uuid;
begin
  if auth.uid() is null or not public.can_see_photo(photo_path) then return null; end if;
  if char_length(btrim(coalesce(comment, ''))) not between 1 and 200 then return null; end if;
  -- Not a flood: 30 a minute each.
  if (select count(*) from public.photo_comments
       where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then return null; end if;
  insert into public.photo_comments (path, user_id, body) values (photo_path, auth.uid(), btrim(comment))
    returning id into new_id;
  return new_id;
end $$;

-- A photo's comments, oldest first, with who (their name in a group we
-- share, else their nickname) and whether it's mine. Nothing when the
-- photo isn't in a group of mine.
create function public.photo_comments(photo_path text)
returns table (id uuid, user_id uuid, nickname text, body text, at timestamptz, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select c.id, c.user_id,
         coalesce(
           (select m.alias from public.group_members m
              join public.group_members me on me.group_id = m.group_id and me.user_id = auth.uid()
             where m.user_id = c.user_id and m.alias is not null limit 1),
           nullif(btrim(p.nickname), ''), '누군가'),
         c.body, c.created_at, c.user_id = auth.uid()
    from public.photo_comments c left join public.profiles p on p.id = c.user_id
   where c.path = photo_path and public.can_see_photo(photo_path)
   order by c.created_at
   limit 200
$$;

revoke execute on function public.can_see_photo(text), public.comment_photo(text, text), public.photo_comments(text) from public, anon;
grant execute on function public.comment_photo(text, text), public.photo_comments(text) to authenticated;

notify pgrst, 'reload schema';

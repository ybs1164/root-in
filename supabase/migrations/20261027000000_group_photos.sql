-- root-in: a photo from the camera sent to some of my groups, with a ping of
-- where I was. Unlike TODAY's pings (seen by every group I'm in) each row
-- belongs to one group, so only the groups I picked see it. The photo is
-- uploaded once (group-photos/<uid>/<id>.jpg) and every picked group gets a
-- row pointing at it. The app never sends one from near a 제외 주소.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Public bucket like avatars (the paths are random): only the owner writes under their own <uid>/ folder.
create policy "own group photo write" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own group photo delete" on storage.objects for delete to authenticated
  using (bucket_id = 'group-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.group_photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The day screen it belongs to (the phone's local date), like pings.day.
  day date not null,
  at timestamptz not null,
  -- [lng, lat], inside Korea.
  center jsonb not null check (
    jsonb_typeof(center) = 'array' and jsonb_array_length(center) = 2
    and (center ->> 0)::float8 between 124 and 132 and (center ->> 1)::float8 between 33 and 39
  ),
  name text not null check (char_length(name) between 1 and 80),
  path text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.jpg$'),
  created_at timestamptz not null default now()
);
create index group_photos_day_idx on public.group_photos (group_id, day);

alter table public.group_photos enable row level security;
create policy "members read" on public.group_photos for select using (public.is_group_member(group_id));

-- Sends one uploaded photo to each of `gids` I'm a member of (others are
-- skipped); how many groups got it.
create function public.send_group_photo(gids uuid[], on_day date, at_time timestamptz, ping_center jsonb, place_name text, photo_path text)
returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare sent integer;
begin
  if auth.uid() is null or gids is null or cardinality(gids) > 30 then return 0; end if;
  if split_part(photo_path, '/', 1) <> auth.uid()::text then return 0; end if;
  insert into public.group_photos (group_id, user_id, day, at, center, name, path)
    select distinct g, auth.uid(), on_day, at_time, ping_center, left(btrim(place_name), 80), photo_path
      from unnest(gids) g where public.is_group_member(g);
  get diagnostics sent = row_count;
  return sent;
end
$$;

-- my_groups: each member's pings on the day are now their TODAY pings plus
-- the photos they sent to this group (with `photo`, the path in group-photos).
create or replace function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'nickname', p.nickname, 'alias', m.alias, 'avatar_path', p.avatar_path,
        'pings', (select coalesce(jsonb_agg(x.ping order by x.at), '[]'::jsonb) from (
                    select k.at, jsonb_build_object('at', k.at, 'center', k.place -> 'center', 'name', left(k.place ->> 'name', 80)) as ping
                      from public.pings k where k.user_id = m.user_id and k.day = on_day and k.deleted_at is null
                    union all
                    select f.at, jsonb_build_object('at', f.at, 'center', f.center, 'name', f.name, 'photo', f.path)
                      from public.group_photos f where f.group_id = g.id and f.user_id = m.user_id and f.day = on_day
                  ) x)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;

revoke execute on function public.send_group_photo(uuid[], date, timestamptz, jsonb, text, text) from public, anon;
grant execute on function public.send_group_photo(uuid[], date, timestamptz, jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';

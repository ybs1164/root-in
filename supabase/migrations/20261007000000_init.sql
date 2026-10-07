-- root-in: first schema. Every table is owned by one auth user and row-level
-- security keeps each user to their own rows; only shares (short share links)
-- and public profile fields are readable by others.
--
-- Shapes that change often on the app side (place snapshots, route looks, day
-- decorations) are jsonb rather than columns, so a client change doesn't need
-- a migration. The client validates them on load just like localStorage data.

create extension if not exists postgis with schema extensions;

-- ── 프로필 ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Same rule as domain/profile.ts: 3–20 of a-z 0-9 . _ -, starting and ending on a letter or digit.
  handle text not null unique
    check (handle ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$' and char_length(handle) between 3 and 20),
  nickname text not null check (char_length(nickname) <= 20),
  -- Path inside the avatars bucket (<uid>/avatar.jpg), null until a photo is set.
  avatar_path text,
  -- 소리·알림·디스플레이 (Profile.sound, pingAlerts, shareAlerts, scheme).
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone may read a profile: the sender's name and photo show on a received route.
create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ── 핀 카테고리·핀 ────────────────────────────────────────────────────────
create table public.pin_categories (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 12),
  icon text not null,
  -- 1–8 (palette) or '#rrggbb', kept as text like the client's PinColor.
  color text not null,
  "order" integer not null default 0,
  primary key (user_id, id)
);

create table public.pins (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  -- PlaceRef snapshot: { id, provider, name, address, lat, lng, ... }.
  place jsonb not null,
  -- Filled from place.lat/lng so nearby queries (e.g. 150m 제외 주소) can use an index.
  geom extensions.geography (point, 4326),
  memo text check (char_length(memo) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (user_id, id)
);
create index pins_geom_idx on public.pins using gist (geom);

-- ── 루트 폴더·루트 ────────────────────────────────────────────────────────
create table public.route_folders (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 12),
  "order" integer not null default 0,
  primary key (user_id, id)
);

create table public.courses (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id text,
  title text not null,
  theme text not null default 'etc',
  travel_mode text not null default 'walk',
  note text,
  stops jsonb not null default '[]'::jsonb,
  stop_shapes jsonb,
  edge_styles jsonb,
  shared_by text,
  "order" integer,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (user_id, id)
);

-- ── 하루 (날짜 화면 꾸미기·핑) ─────────────────────────────────────────────
create table public.days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  decor jsonb not null default '{}'::jsonb,
  pings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- 제외 주소 (집 등) is deliberately NOT here: it stays on the device
-- (goodroot:privacy:v1) so the most sensitive data never leaves the phone.

-- Spelled out rather than a DO loop: the dashboard SQL Editor cuts $$ bodies at their semicolons.
alter table public.pin_categories enable row level security;
create policy "own rows" on public.pin_categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.pins enable row level security;
create policy "own rows" on public.pins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.route_folders enable row level security;
create policy "own rows" on public.route_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.courses enable row level security;
create policy "own rows" on public.courses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.days enable row level security;
create policy "own rows" on public.days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 짧은 공유 링크 ────────────────────────────────────────────────────────
create table public.shares (
  slug text primary key check (slug ~ '^[A-Za-z0-9_-]{6,16}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  -- The same self-contained snapshot a #share= link carries.
  snapshot jsonb not null,
  open_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;
create policy "shares are readable by link" on public.shares for select using (true);
create policy "own shares insert" on public.shares for insert with check (owner_id = auth.uid());
create policy "own shares delete" on public.shares for delete using (owner_id = auth.uid());

-- Opening a short link counts once; anyone (even signed out) may call it, but
-- it can only add one, never set a value. The owner opening it does not count.
create function public.open_share(share_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  update public.shares
     set open_count = open_count + case when owner_id = auth.uid() then 0 else 1 end
   where slug = share_slug
  returning snapshot;
$$;
grant execute on function public.open_share(text) to anon, authenticated;

-- ── 탈퇴 ──────────────────────────────────────────────────────────────────
-- Deleting the auth user cascades to every table above. Storage objects are
-- removed by the client first (it owns them under <uid>/).
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── 프로필 사진 ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 262144, array['image/jpeg'])
on conflict (id) do nothing;

-- Public bucket: anyone can read; only the owner writes under their own <uid>/ folder.
create policy "own avatar write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

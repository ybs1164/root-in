-- root-in: finishes a database where 20261007000000_init.sql stopped after
-- the `days` table (the tables exist, but not row level security, `shares`,
-- the functions or the avatars bucket), and applies the two later migrations
-- (20261008000000_sync.sql, 20261009000000_shares.sql) on top.
--
-- Safe to run more than once, and whether or not the sync migration already
-- ran: everything checks what's there first. Run it once in the SQL Editor
-- instead of the three migration files. It doesn't delete any rows.

create extension if not exists postgis with schema extensions;

-- ── 열 이름·추가 열 (sync 마이그레이션) ─────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pin_categories' and column_name = 'order') then
    alter table public.pin_categories rename column "order" to position;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'route_folders' and column_name = 'order') then
    alter table public.route_folders rename column "order" to position;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'courses' and column_name = 'order') then
    alter table public.courses rename column "order" to position;
  end if;
end $$;

alter table public.route_folders add column if not exists icon text not null default '📁';
alter table public.days add column if not exists looks jsonb not null default '{}'::jsonb;
alter table public.pin_categories drop constraint if exists pin_categories_name_check;
alter table public.route_folders drop constraint if exists route_folders_name_check;
alter table public.pins drop constraint if exists pins_memo_check;

-- ── 프로필: 본인만 읽고 씀 ───────────────────────────────────────────────
alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ── 핀·카테고리·폴더·루트·하루: 본인 행만 ────────────────────────────────
alter table public.pin_categories enable row level security;
drop policy if exists "own rows" on public.pin_categories;
create policy "own rows" on public.pin_categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.pins enable row level security;
drop policy if exists "own rows" on public.pins;
create policy "own rows" on public.pins for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.route_folders enable row level security;
drop policy if exists "own rows" on public.route_folders;
create policy "own rows" on public.route_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.courses enable row level security;
drop policy if exists "own rows" on public.courses;
create policy "own rows" on public.courses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.days enable row level security;
drop policy if exists "own rows" on public.days;
create policy "own rows" on public.days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 짧은 공유 링크 ────────────────────────────────────────────────────────
create table if not exists public.shares (
  slug text primary key check (slug ~ '^[A-Za-z0-9_-]{6,16}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  snapshot jsonb not null check (octet_length(snapshot::text) <= 8000),
  open_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shares_owner_course_idx on public.shares (owner_id, course_id);

alter table public.shares enable row level security;
drop policy if exists "shares are readable by link" on public.shares;
drop policy if exists "own shares read" on public.shares;
drop policy if exists "own shares insert" on public.shares;
drop policy if exists "own shares delete" on public.shares;
create policy "own shares read" on public.shares for select using (owner_id = auth.uid());
create policy "own shares insert" on public.shares for insert with check (owner_id = auth.uid());
create policy "own shares delete" on public.shares for delete using (owner_id = auth.uid());

drop function if exists public.open_share(text);
drop function if exists public.open_share(text, boolean);
create function public.open_share(share_slug text, count_open boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.shares;
  p public.profiles;
begin
  if count_open then
    update public.shares
       set open_count = open_count + 1
     where slug = share_slug
       and owner_id is distinct from auth.uid();
  end if;
  select * into s from public.shares where slug = share_slug;
  if not found then
    return null;
  end if;
  select * into p from public.profiles where id = s.owner_id;
  return jsonb_build_object(
    'snapshot', s.snapshot,
    'open_count', s.open_count,
    'owner', jsonb_build_object('nickname', coalesce(p.nickname, ''), 'handle', p.handle, 'avatar_path', p.avatar_path)
  );
end;
$$;
grant execute on function public.open_share(text, boolean) to anon, authenticated;

-- ── 탈퇴 ──────────────────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;

-- ── 프로필 사진 ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 262144, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "own avatar write" on storage.objects;
drop policy if exists "own avatar update" on storage.objects;
drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 확인 ──────────────────────────────────────────────────────────────────
-- Every table should show rls_on = true, and shares should be in the list.
select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by 1;

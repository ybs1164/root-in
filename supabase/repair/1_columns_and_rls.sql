-- 복구 1/3: 열 이름·추가 열, 프로필과 각 테이블의 접근 권한(RLS).
-- 순서대로 1 → 2 → 3 실행. 여러 번 실행해도 안전 (자세한 설명: supabase/repair/README.md).

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


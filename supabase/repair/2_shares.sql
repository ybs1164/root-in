-- 복구 2/3: 짧은 공유 링크 테이블과 open_share 함수.

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
-- No quotes or apostrophes around or inside the $$ body: the dashboard SQL
-- Editor splits statements itself and loses track of $$ after an empty
-- string literal. One statement: the CTE update is not visible to the outer
-- select, so the new count comes from its RETURNING.
create function public.open_share(share_slug text, count_open boolean default true)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  with bumped as (
    update public.shares
       set open_count = open_count + 1
     where slug = share_slug
       and count_open
       and owner_id is distinct from auth.uid()
    returning open_count
  )
  select jsonb_build_object(
    'snapshot', s.snapshot,
    'open_count', coalesce((select b.open_count from bumped b), s.open_count),
    'owner', jsonb_build_object('nickname', p.nickname, 'handle', p.handle, 'avatar_path', p.avatar_path)
  )
  from public.shares s
  left join public.profiles p on p.id = s.owner_id
  where s.slug = share_slug
$$;
grant execute on function public.open_share(text, boolean) to anon, authenticated;


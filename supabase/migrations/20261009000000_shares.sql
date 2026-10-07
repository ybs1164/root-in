-- root-in: short share links and share counts (step 3).
--
-- A short link is #s=<slug>; its row holds the same token a #share= link
-- carries (snapshot = { "token": "..." }), so the client decodes and checks
-- it exactly like a long link. Opening goes through open_share only: nobody
-- can list other people's shares or profiles directly any more.

-- Shares: only the owner reads their rows (for their share counts).
drop policy if exists "shares are readable by link" on public.shares;
create policy "own shares read" on public.shares for select using (owner_id = auth.uid());

alter table public.shares
  add constraint shares_snapshot_size check (octet_length(snapshot::text) <= 8000);
create index if not exists shares_owner_course_idx on public.shares (owner_id, course_id);

-- Profiles: settings are private; the public face (nickname, @id, photo)
-- reaches a link's opener through open_share.
drop policy if exists "profiles are public" on public.profiles;
create policy "own profile read" on public.profiles for select using (id = auth.uid());

-- Opens a short link: the snapshot, how many times it has been opened, and
-- who shared it. Counts the open unless `count_open` is false (the opener
-- has seen this link before) or the opener is its owner.
drop function if exists public.open_share(text);
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

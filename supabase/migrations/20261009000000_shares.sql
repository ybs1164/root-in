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

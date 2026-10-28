-- root-in: 카테고리 구독. A pin category shared by link (#c=<slug>): the
-- owner's phone writes the category's snapshot (look + places, 제외 주소
-- places already left out on the phone) to its row whenever it changes, and
-- anyone with the link reads it through open_category_share. Followers keep
-- their own copy in step; nothing about them is stored here.

create table public.category_shares (
  slug text primary key check (slug ~ '^[A-Za-z0-9_-]{6,16}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  -- { v: 1, c: { n, ic, co }, p: [{ i, n, c, a?, y?, m? }] } (services/categoryShareService.ts).
  snapshot jsonb not null check (octet_length(snapshot::text) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 공유 중지, or the category was deleted: the link opens to nothing.
  revoked_at timestamptz
);
-- One live link per category; a stopped one stays dead, sharing again makes a new one.
create unique index category_shares_live_idx on public.category_shares (owner_id, category_id) where revoked_at is null;

alter table public.category_shares enable row level security;
create policy "own rows" on public.category_shares for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- No quotes inside the $$ bodies (see 20261009000000_shares.sql).
create function public.touch_category_share()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger touch before update on public.category_shares
  for each row execute function public.touch_category_share();

-- Deleting a category (a deletion mark, on any device) revokes its link.
create function public.revoke_shares_of_deleted_category()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.category_shares
       set revoked_at = now()
     where owner_id = new.user_id
       and category_id = new.id
       and revoked_at is null;
  end if;
  return new;
end
$$;
create trigger revoke_category_shares after update of deleted_at on public.pin_categories
  for each row execute function public.revoke_shares_of_deleted_category();

-- Opens a category link: its snapshot and who shares it (nickname, photo);
-- null when there is no such link or sharing stopped. Anyone may call it
-- (following works signed out); mine tells the owner it is their own.
create function public.open_category_share(share_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'snapshot', s.snapshot,
    'updated_at', s.updated_at,
    'mine', s.owner_id = auth.uid(),
    'owner', jsonb_build_object('nickname', p.nickname, 'avatar_path', p.avatar_path)
  )
  from public.category_shares s
  left join public.profiles p on p.id = s.owner_id
  where s.slug = share_slug
    and s.revoked_at is null
$$;
grant execute on function public.open_category_share(text) to anon, authenticated;

notify pgrst, 'reload schema';

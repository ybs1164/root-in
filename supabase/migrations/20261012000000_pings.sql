-- root-in: TODAY's pings (docs/schema-plan.md C). One row per ping: one of
-- your pins you were at (within 50m), added from the day screen. A snapshot
-- kept apart from pins — deleting or renaming the pin leaves the day as it
-- was. Pings at a 제외 주소 never reach the server (the app keeps them on the phone).
--
-- The ping shapes and line styles stay in days.looks, keyed by date|time|name
-- as before.

create table public.pings (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The pin it came from (no FK: the pin may be deleted, the ping stays).
  pin_id text,
  -- The day screen it belongs to (the phone's local date).
  day date not null,
  at timestamptz not null,
  -- { name, center: [lng, lat], address? }
  place jsonb not null check (octet_length(place::text) <= 4096),
  updated_at timestamptz,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);
create index pings_day_idx on public.pings (user_id, day);
create index pings_sync_idx on public.pings (user_id, server_updated_at);
create trigger touch before insert or update on public.pings for each row execute function public.touch_sync_row();

alter table public.pings enable row level security;
create policy "own rows" on public.pings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Never used: pings have their own table now.
alter table public.days drop column if exists pings;

-- Deletion marks of pings are purged with the rest (20261010000000_sync_cursor.sql).
create or replace function public.purge_sync_tombstones()
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  delete from public.pin_categories where deleted_at < now() - make_interval(days => 30);
  delete from public.pins where deleted_at < now() - make_interval(days => 30);
  delete from public.route_folders where deleted_at < now() - make_interval(days => 30);
  delete from public.courses where deleted_at < now() - make_interval(days => 30);
  delete from public.days where deleted_at < now() - make_interval(days => 30);
  delete from public.pings where deleted_at < now() - make_interval(days => 30);
$$;
revoke execute on function public.purge_sync_tombstones() from public, anon, authenticated;

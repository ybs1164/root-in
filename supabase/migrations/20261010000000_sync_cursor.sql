-- root-in: sync pulls only what changed, and the server bounds row sizes.
--
-- Every synced row gets server_updated_at (stamped by the server on each
-- write, never by a phone's clock) and deleted_at (a deletion only marks the
-- row). A pull asks for rows with server_updated_at at or after its cursor and
-- so hears about edits and deletions without reading the whole account.
-- Deploy this before the client that reads these columns.

-- No quotes inside the $$ bodies (see 20261009000000_shares.sql).
create function public.touch_sync_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.server_updated_at := now();
  return new;
end
$$;

alter table public.pin_categories add column server_updated_at timestamptz not null default now(), add column deleted_at timestamptz;
create index pin_categories_sync_idx on public.pin_categories (user_id, server_updated_at);
create trigger touch before insert or update on public.pin_categories for each row execute function public.touch_sync_row();

alter table public.pins add column server_updated_at timestamptz not null default now(), add column deleted_at timestamptz;
create index pins_sync_idx on public.pins (user_id, server_updated_at);
create trigger touch before insert or update on public.pins for each row execute function public.touch_sync_row();

alter table public.route_folders add column server_updated_at timestamptz not null default now(), add column deleted_at timestamptz;
create index route_folders_sync_idx on public.route_folders (user_id, server_updated_at);
create trigger touch before insert or update on public.route_folders for each row execute function public.touch_sync_row();

alter table public.courses add column server_updated_at timestamptz not null default now(), add column deleted_at timestamptz;
create index courses_sync_idx on public.courses (user_id, server_updated_at);
create trigger touch before insert or update on public.courses for each row execute function public.touch_sync_row();

alter table public.days add column server_updated_at timestamptz not null default now(), add column deleted_at timestamptz;
create index days_sync_idx on public.days (user_id, server_updated_at);
create trigger touch before insert or update on public.days for each row execute function public.touch_sync_row();

-- pins.geom comes from place.center ([lng, lat]) on the server, so it can't
-- drift from the place. A trigger rather than a generated column: a client
-- that still sends geom keeps working (its value is just replaced).
create function public.fill_pin_geom()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.geom := extensions.st_setsrid(
    extensions.st_makepoint((new.place -> 'center' ->> 0)::float8, (new.place -> 'center' ->> 1)::float8),
    4326
  )::extensions.geography;
  return new;
end
$$;
create trigger fill_geom before insert or update of place on public.pins for each row execute function public.fill_pin_geom();

-- Size bounds, well above what the client keeps (a day's decorations can't
-- outgrow localStorage's ~5MB). NOT VALID: checked on every new write, but
-- existing rows aren't scanned.
alter table public.days add constraint days_decor_size check (octet_length(decor::text) <= 5242880) not valid;
alter table public.days add constraint days_looks_size check (octet_length(looks::text) <= 65536) not valid;
alter table public.courses add constraint courses_stops_size check (octet_length(stops::text) <= 65536) not valid;
alter table public.courses add constraint courses_looks_size
  check (octet_length(coalesce(stop_shapes::text, '')) + octet_length(coalesce(edge_styles::text, '')) <= 8192) not valid;
alter table public.courses add constraint courses_text_size check (char_length(title) <= 80 and char_length(coalesce(note, '')) <= 2000) not valid;
alter table public.pins add constraint pins_place_size check (octet_length(place::text) <= 4096) not valid;
alter table public.pins add constraint pins_memo_size check (char_length(coalesce(memo, '')) <= 2000) not valid;
alter table public.pin_categories add constraint pin_categories_size check (char_length(name) <= 200 and char_length(icon) <= 64 and char_length(color) <= 16) not valid;
alter table public.route_folders add constraint route_folders_size check (char_length(name) <= 200 and char_length(icon) <= 64) not valid;
alter table public.profiles add constraint profiles_settings_size check (octet_length(settings::text) <= 16384) not valid;

-- Deletion marks keep the row's content until purged. Clients re-read
-- everything when their cursor is older than 21 days, so 30 days is safe.
-- Run daily (Supabase → Integrations → Cron, or pg_cron):
--   select public.purge_sync_tombstones();
create function public.purge_sync_tombstones()
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
$$;
revoke execute on function public.purge_sync_tombstones() from public, anon, authenticated;

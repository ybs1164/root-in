-- root-in: what cloud sync (step 2) needs on top of the first schema.

-- "order" is awkward in PostgREST queries; every list position is `position`.
alter table public.pin_categories rename column "order" to position;
alter table public.route_folders rename column "order" to position;
alter table public.courses rename column "order" to position;

-- A folder's tab icon (kept for old folders; new ones get the default).
alter table public.route_folders add column if not exists icon text not null default '📁';

-- Per day: the ping shapes and line styles picked on the 날짜 화면
-- ({ shapes: { pingKey: shape }, edges: { edgeKey: style } }). `pings` stays
-- for the pings themselves once they're stored.
alter table public.days add column if not exists looks jsonb not null default '{}'::jsonb;

-- Names are clamped by the client; a stray long one must not block a whole
-- sync batch, so the length checks move to the client side.
alter table public.pin_categories drop constraint if exists pin_categories_name_check;
alter table public.route_folders drop constraint if exists route_folders_name_check;
alter table public.pins drop constraint if exists pins_memo_check;

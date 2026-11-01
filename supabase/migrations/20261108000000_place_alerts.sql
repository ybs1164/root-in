-- root-in: 그룹 알림 · 새로운 루트, sent. When a member pings a new place (a
-- TODAY ping, or a camera photo sent to a group) every other member of the
-- groups that see it gets a line in their inbox (group_news) — unless they
-- switched 새로운 루트 off for those groups in 알림 설정 (profiles.settings
-- .groupAlertsOff), or the last place they heard of from that member, lately,
-- is the same one (50m: a second photo there, or the TODAY ping that goes
-- with a camera photo). Each new line
--   · goes out as a note on the private channel user:<their id> (the open app
--     reads group_news() and says so), and
--   · is handed to the push-news Edge Function (pg_net), which pushes it to
--     their phones (FCM / APNs) — only once its URL and secret are in the
--     Vault (docs/supabase.md '장소 알림'); without them nothing is sent.
-- Needs 20261107000000_realtime_group_events.sql first. Pings at a 제외 주소
-- never reach the server, so they never make news either.

create extension if not exists pg_net;

create table public.group_news (
  id uuid primary key default gen_random_uuid(),
  to_user uuid not null references auth.users (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  -- The group it's told in (one per person, however many they share).
  group_id uuid not null references public.groups (id) on delete cascade,
  -- 새로운 루트 only for now; 하트 · 댓글 · 채팅 can come the same way.
  kind text not null default 'route' check (kind in ('route')),
  -- As it was sent: the sender as the group shows them, the group, the place.
  name text not null check (char_length(name) between 1 and 20),
  group_name text not null check (char_length(group_name) between 1 and 12),
  place text not null check (char_length(place) between 1 and 80),
  -- [lng, lat], only to tell "the same place" next time; never read by the app.
  center jsonb not null,
  created_at timestamptz not null default now(),
  -- When the app showed it (null: not yet).
  seen_at timestamptz
);
create index group_news_to_idx on public.group_news (to_user, seen_at, created_at);
create index group_news_pair_idx on public.group_news (to_user, from_user, created_at desc);

alter table public.group_news enable row level security;
-- No policies: read through group_news(), written by the triggers below.

-- The devices a person gets pushes on. A token moves with whoever signed in last on that phone.
create table public.push_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- No policies: written through save_push_token() / drop_push_token(), read by the Edge Function (service role).

-- Metres between two [lng, lat] points; close enough at 50m.
create function public.meters_apart(a jsonb, b jsonb) returns float8
language sql immutable set search_path = pg_catalog as $$
  select 6371000 * sqrt(
    power(radians((b ->> 1)::float8 - (a ->> 1)::float8), 2)
    + power(radians((b ->> 0)::float8 - (a ->> 0)::float8) * cos(radians(((a ->> 1)::float8 + (b ->> 1)::float8) / 2)), 2))
$$;

-- Hands new lines to the push-news Edge Function. Quiet without its Vault secrets.
create function public.push_news(ids uuid[]) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare url text; secret text;
begin
  if ids is null or cardinality(ids) = 0 then return; end if;
  select decrypted_secret into url from vault.decrypted_secrets where name = 'push_news_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_news_secret';
  if url is null or secret is null then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('ids', to_jsonb(ids)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 5000);
end $$;

-- `sender` pinged `place_name` at `spot`: news for everyone who sees it —
-- every group of the sender's (a TODAY ping) or just `only_group` (a photo).
create function public.place_news(sender uuid, only_group uuid, place_name text, spot jsonb) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare ids uuid[]; users uuid[]; i integer;
begin
  if btrim(coalesce(place_name, '')) = '' or jsonb_typeof(spot) is distinct from 'array' or jsonb_array_length(spot) <> 2
     or jsonb_typeof(spot -> 0) <> 'number' or jsonb_typeof(spot -> 1) <> 'number' then
    return;
  end if;
  with heard as (
    -- One group per person (the oldest they share with the sender where 새로운 루트 is on).
    -- An old-style off value (just the group id) means every kind off.
    select distinct on (them.user_id)
           them.user_id as to_user, g.id as group_id, g.name as group_name,
           coalesce(case when me.own_profile then nullif(btrim(me.alias), '') end, nullif(btrim(p.nickname), ''), '누군가') as name
      from public.group_members me
      join public.groups g on g.id = me.group_id
      join public.group_members them on them.group_id = me.group_id and them.user_id <> sender
      left join public.profiles p on p.id = sender
      left join public.profiles tp on tp.id = them.user_id
     where me.user_id = sender
       and (only_group is null or me.group_id = only_group)
       and not (case when jsonb_typeof(tp.settings -> 'groupAlertsOff') = 'array'
                     then (tp.settings -> 'groupAlertsOff') ?| array[g.id::text, g.id::text || ':route']
                     else false end)
     order by them.user_id, g.created_at
  ), fresh as (
    select h.* from heard h
     where not exists (
       select 1 from (select n.center from public.group_news n
                       where n.to_user = h.to_user and n.from_user = sender and n.created_at > now() - interval '12 hours'
                       order by n.created_at desc limit 1) last
        where public.meters_apart(last.center, spot) <= 50)
  ), made as (
    insert into public.group_news (to_user, from_user, group_id, name, group_name, place, center)
    select f.to_user, sender, f.group_id, left(f.name, 20), f.group_name, left(btrim(place_name), 80), spot from fresh f
    returning id, to_user
  )
  select array_agg(id), array_agg(to_user) into ids, users from made;
  if ids is null then return; end if;
  for i in 1 .. cardinality(ids) loop
    perform realtime.send(jsonb_build_object('kind', 'news', 'id', ids[i], 'by', sender),
                          'feed', 'user:' || users[i]::text, true);
  end loop;
  perform public.push_news(ids);
end $$;

-- A new ping row: a TODAY ping as it syncs up, or a camera photo sent to a
-- group. Only fresh ones (a phone catching up on old pings tells nobody).
-- Never stops the insert.
create function public.ping_news() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  begin
    if tg_table_name = 'pings' then
      if new.deleted_at is null and new.at > now() - interval '1 hour' and new.at < now() + interval '10 minutes' then
        perform public.place_news(new.user_id, null, new.place ->> 'name', new.place -> 'center');
      end if;
    elsif tg_table_name = 'group_photos' then
      if new.at > now() - interval '1 hour' and new.at < now() + interval '10 minutes' then
        perform public.place_news(new.user_id, new.group_id, new.name, new.center);
      end if;
    end if;
  exception when others then
    raise warning 'ping_news: %', sqlerrm;
  end;
  return null;
end $$;

create trigger pings_news after insert on public.pings
  for each row execute function public.ping_news();
create trigger group_photos_place_news after insert on public.group_photos
  for each row execute function public.ping_news();

-- My news the app hasn't shown yet, newest first (groups I've left drop out).
create function public.group_news() returns table (id uuid, from_user uuid, group_id uuid, kind text, name text, group_name text, place text, at timestamptz)
language sql stable security definer set search_path = pg_catalog as $$
  select n.id, n.from_user, n.group_id, n.kind, n.name, n.group_name, n.place, n.created_at
    from public.group_news n
   where n.to_user = auth.uid() and n.seen_at is null and public.is_group_member(n.group_id)
   order by n.created_at desc
   limit 50
$$;

-- Shown: my news up to `upto` stops coming back; month-old lines go.
create function public.group_news_seen(upto timestamptz) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null then return false; end if;
  update public.group_news set seen_at = now()
   where to_user = auth.uid() and seen_at is null and created_at <= upto;
  delete from public.group_news where to_user = auth.uid() and created_at < now() - interval '30 days';
  return true;
end $$;

-- This phone gets my pushes (taken over from whoever had it); ten phones a person.
create function public.save_push_token(push_token text, push_platform text) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or push_platform not in ('android', 'ios')
     or char_length(coalesce(push_token, '')) not between 20 and 4096 then
    return false;
  end if;
  insert into public.push_tokens (token, user_id, platform) values (push_token, auth.uid(), push_platform)
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  delete from public.push_tokens
   where user_id = auth.uid()
     and token not in (select t.token from public.push_tokens t where t.user_id = auth.uid() order by t.updated_at desc limit 10);
  return true;
end $$;

-- Signing out: this phone stops getting my pushes.
create function public.drop_push_token(push_token text) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with done as (delete from public.push_tokens where token = push_token and user_id = auth.uid() returning 1)
  select true
$$;

revoke execute on function public.meters_apart(jsonb, jsonb), public.push_news(uuid[]),
  public.place_news(uuid, uuid, text, jsonb), public.ping_news() from public, anon, authenticated;
revoke execute on function public.group_news(), public.group_news_seen(timestamptz),
  public.save_push_token(text, text), public.drop_push_token(text) from public, anon;
grant execute on function public.group_news(), public.group_news_seen(timestamptz),
  public.save_push_token(text, text), public.drop_push_token(text) to authenticated;

-- My own news channel (user:<my id>), next to the group: / photo: ones.
create policy "own news channel" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() = 'user:' || auth.uid()::text);

notify pgrst, 'reload schema';

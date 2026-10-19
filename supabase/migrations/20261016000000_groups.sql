-- root-in: We Now groups. Members see each other's TODAY pings on one map.
-- Rows are only read and written through the functions below (security
-- definer, each checks auth.uid()); members can select their own groups.
-- A ping leaves only its time and place centre — never the name or address —
-- and 제외 주소 pings never reach the server in the first place.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 12),
  -- The tile's cover pattern (domain/groups.ts GROUP_COVERS).
  cover smallint not null default 0 check (cover between 0 and 3),
  owner_id uuid references auth.users (id) on delete set null,
  invite_slug text not null unique check (invite_slug ~ '^[A-Za-z0-9_-]{6,16}$'),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The member's colour slot in the group, kept while they stay.
  slot smallint not null check (slot between 0 and 19),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (group_id, slot)
);
create index group_members_user_idx on public.group_members (user_id);

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid())
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy "members read" on public.groups for select using (public.is_group_member(id));
create policy "members read" on public.group_members for select using (public.is_group_member(group_id));

-- Joins the caller with the lowest free colour slot. 20 members a group, 30 groups a person.
create function public.add_group_member(gid uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare free smallint;
begin
  if auth.uid() is null then return false; end if;
  if public.is_group_member(gid) then return true; end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 30 then return false; end if;
  select s into free from generate_series(0, 19) s
   where s not in (select slot from public.group_members where group_id = gid) order by s limit 1;
  if free is null then return false; end if;
  insert into public.group_members (group_id, user_id, slot) values (gid, auth.uid(), free);
  return true;
end $$;
revoke execute on function public.add_group_member(uuid) from public, anon, authenticated;

create function public.create_group(group_name text, group_cover smallint, slug text) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare gid uuid;
begin
  if auth.uid() is null then return null; end if;
  insert into public.groups (name, cover, owner_id, invite_slug)
       values (btrim(group_name), group_cover, auth.uid(), slug) returning id into gid;
  if not public.add_group_member(gid) then raise exception 'too many groups'; end if;
  return gid;
end $$;

-- An invite link (#g=<slug>): null when there's no such group or it's full.
create function public.join_group(slug text) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare gid uuid;
begin
  select id into gid from public.groups where invite_slug = slug;
  if gid is null or not public.add_group_member(gid) then return null; end if;
  return gid;
end $$;

create function public.rename_group(gid uuid, group_name text) returns boolean
language sql security definer set search_path = pg_catalog as $$
  with done as (update public.groups set name = btrim(group_name)
                 where id = gid and owner_id = auth.uid() returning 1)
  select exists (select 1 from done)
$$;

-- Leaving the last member's place takes the group with it.
create function public.leave_group(gid uuid) returns void
language sql security definer set search_path = pg_catalog as $$
  delete from public.group_members where group_id = gid and user_id = auth.uid();
  delete from public.groups g where g.id = gid
     and not exists (select 1 from public.group_members m where m.group_id = gid);
$$;

-- Every group of mine with its members and their pings on `on_day`.
create function public.my_groups(on_day date) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'cover', g.cover, 'invite_slug', g.invite_slug,
    'mine', g.owner_id = auth.uid(), 'created_at', g.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'slot', m.slot, 'nickname', p.nickname, 'avatar_path', p.avatar_path,
        'pings', (select coalesce(jsonb_agg(jsonb_build_object('at', k.at, 'center', k.place -> 'center') order by k.at), '[]'::jsonb)
                    from public.pings k where k.user_id = m.user_id and k.day = on_day and k.deleted_at is null)
      ) order by m.slot), '[]'::jsonb)
      from public.group_members m left join public.profiles p on p.id = m.user_id where m.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.groups g where public.is_group_member(g.id)
$$;

revoke execute on function public.create_group(text, smallint, text), public.join_group(text),
  public.rename_group(uuid, text), public.leave_group(uuid), public.my_groups(date) from public, anon;
grant execute on function public.create_group(text, smallint, text), public.join_group(text),
  public.rename_group(uuid, text), public.leave_group(uuid), public.my_groups(date) to authenticated;

-- root-in: a group's day as a whiteboard. On a group's map each member can
-- doodle (pen, stickers, text, in their colour in that group) over that
-- day's map; everyone in the group sees every layer. Like photo_decor: one
-- layer per member per group per day, each edits only their own. The layer
-- is the app's DayDecor JSON (places as fractions of the board), checked by
-- the app when read.

create table public.group_day_decor (
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  decor jsonb not null check (jsonb_typeof(decor) = 'object' and octet_length(decor::text) <= 300000),
  updated_at timestamptz not null default now(),
  primary key (group_id, day, user_id)
);

alter table public.group_day_decor enable row level security;
-- Read through group_day_decors(); written through set_group_day_decor().
-- The members read their groups' rows so Realtime can tell them of changes.
create policy "members read" on public.group_day_decor for select to authenticated
  using (public.is_group_member(group_id));

-- My layer on a day of a group of mine: replaced, or gone when `decor` is
-- null. False when the group isn't mine.
create function public.set_group_day_decor(gid uuid, on_day date, decor jsonb) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not public.is_group_member(gid) then return false; end if;
  if decor is null then
    delete from public.group_day_decor where group_id = gid and day = on_day and user_id = auth.uid();
    return true;
  end if;
  if jsonb_typeof(decor) <> 'object' or octet_length(decor::text) > 300000 then return false; end if;
  insert into public.group_day_decor (group_id, day, user_id, decor) values (gid, on_day, auth.uid(), decor)
    on conflict (group_id, day, user_id) do update set decor = excluded.decor, updated_at = now();
  return true;
end $$;

-- Every layer on a day of a group of mine, oldest change first (drawn in
-- that order), and whether it's mine. Members who left are left out.
create function public.group_day_decors(gid uuid, on_day date)
returns table (user_id uuid, decor jsonb, mine boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select d.user_id, d.decor, d.user_id = auth.uid()
    from public.group_day_decor d
    join public.group_members m on m.group_id = d.group_id and m.user_id = d.user_id
   where d.group_id = gid and d.day = on_day and public.is_group_member(gid)
   order by d.updated_at
   limit 20
$$;

revoke execute on function public.set_group_day_decor(uuid, date, jsonb), public.group_day_decors(uuid, date) from public, anon;
grant execute on function public.set_group_day_decor(uuid, date, jsonb), public.group_day_decors(uuid, date) to authenticated;

-- Live: only the key goes out (a layer can be big); the app reads again.
alter publication supabase_realtime add table public.group_day_decor (group_id, day, user_id, updated_at);

notify pgrst, 'reload schema';

-- ─── Maison Productize V1 — initial schema ──────────────────────────
-- One transaction. If any statement fails, the whole migration rolls back.

begin;

-- ─── profiles ───────────────────────────────────────────────────────
create table public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  created_at               timestamptz not null default now(),
  greeting_name            text,
  subscription_status      text not null default 'trialing'
                           check (subscription_status in (
                             'trialing','trial_expired','active','cancelled',
                             'hardship_granted','hardship_pending'
                           )),
  trial_ends_at            timestamptz,
  is_founding_member       boolean not null default false,
  hardship_granted_until   timestamptz,
  encryption_salt          text not null,
  calendar_url             text,
  sitter_notes             text,
  last_daily_reset_date    text,
  last_weekly_reset_date   text
);

alter table public.profiles enable row level security;

create policy "profiles_own_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_own_insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id);

-- ─── kids ───────────────────────────────────────────────────────────
create table public.kids (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  position      int  not null default 0,
  name          text,
  birthday      date,
  clothes_size  text,
  shoe_size     text,
  diaper_size   text,
  allergies     text,
  created_at    timestamptz not null default now()
);
create index kids_user_position_idx on public.kids(user_id, position);
alter table public.kids enable row level security;
create policy "kids_own_all" on public.kids for all using (auth.uid() = user_id);

-- ─── household_items ────────────────────────────────────────────────
create table public.household_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  position  int  not null default 0,
  label     text,
  value     text
);
create index household_user_position_idx on public.household_items(user_id, position);
alter table public.household_items enable row level security;
create policy "household_own_all" on public.household_items for all using (auth.uid() = user_id);

-- ─── daily_tasks ────────────────────────────────────────────────────
create table public.daily_tasks (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  slot      text not null check (slot in ('day','night')),
  position  int  not null default 0,
  label     text not null default '',
  done      boolean not null default false
);
create index daily_user_slot_position_idx on public.daily_tasks(user_id, slot, position);
alter table public.daily_tasks enable row level security;
create policy "daily_own_all" on public.daily_tasks for all using (auth.uid() = user_id);

-- ─── weekly_tasks ───────────────────────────────────────────────────
create table public.weekly_tasks (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  position  int  not null default 0,
  label     text not null default '',
  done      boolean not null default false
);
create index weekly_user_position_idx on public.weekly_tasks(user_id, position);
alter table public.weekly_tasks enable row level security;
create policy "weekly_own_all" on public.weekly_tasks for all using (auth.uid() = user_id);

-- ─── meals ──────────────────────────────────────────────────────────
create table public.meals (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      text not null check (day in ('Sun','Mon','Tue','Wed','Thu','Fri','Sat')),
  slot     text not null check (slot in ('L','D')),
  text     text not null default '',
  unique (user_id, day, slot)
);
alter table public.meals enable row level security;
create policy "meals_own_all" on public.meals for all using (auth.uid() = user_id);

-- ─── list_items (grocery + tobuy combined) ──────────────────────────
create table public.list_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  list      text not null check (list in ('grocery','tobuy')),
  position  int  not null default 0,
  item      text not null default '',
  got       boolean not null default false
);
create index list_items_user_list_position_idx on public.list_items(user_id, list, position);
alter table public.list_items enable row level security;
create policy "list_items_own_all" on public.list_items for all using (auth.uid() = user_id);

-- ─── notes (E2E encrypted text) ─────────────────────────────────────
create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  position        int  not null default 0,
  text_encrypted  text not null,
  done            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index notes_user_position_idx on public.notes(user_id, position);
alter table public.notes enable row level security;
create policy "notes_own_all" on public.notes for all using (auth.uid() = user_id);

-- ─── moments (E2E encrypted caption + photo) ────────────────────────
create table public.moments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  date_label           text not null default '',
  caption_encrypted    text,
  photo_storage_path   text,
  created_at           timestamptz not null default now()
);
create index moments_user_created_idx on public.moments(user_id, created_at desc);
alter table public.moments enable row level security;
create policy "moments_own_all" on public.moments for all using (auth.uid() = user_id);

-- ─── hardship_requests ──────────────────────────────────────────────
create table public.hardship_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  email           text not null,
  reason          text,
  requested_at    timestamptz not null default now(),
  approved        boolean not null default false,
  reviewed_at     timestamptz,
  granted_until   date,
  notes           text
);
alter table public.hardship_requests enable row level security;
-- User can insert their own request, read their own, but not update.
create policy "hardship_own_insert" on public.hardship_requests
  for insert with check (auth.uid() = user_id);
create policy "hardship_own_select" on public.hardship_requests
  for select using (auth.uid() = user_id);
-- Admin operations (UPDATE for approval) happen via service-role; no policy needed.

-- ─── seed_new_user — populate defaults on first signup ──────────────
create or replace function public.seed_new_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Daily tasks: day slot (5 items)
  insert into public.daily_tasks (user_id, slot, position, label) values
    (target_user, 'day', 0, 'Wipe down counters'),
    (target_user, 'day', 1, 'Toy basket reset'),
    (target_user, 'day', 2, 'Switch laundry'),
    (target_user, 'day', 3, 'Make the beds'),
    (target_user, 'day', 4, 'Quick toilet swipe');

  -- Daily tasks: night slot (4 items)
  insert into public.daily_tasks (user_id, slot, position, label) values
    (target_user, 'night', 0, 'Run dishwasher'),
    (target_user, 'night', 1, 'Sweep main floor'),
    (target_user, 'night', 2, 'Tidy living room'),
    (target_user, 'night', 3, 'Reset counters for morning');

  -- Weekly tasks (7 items)
  insert into public.weekly_tasks (user_id, position, label) values
    (target_user, 0, 'Mop kitchen floor'),
    (target_user, 1, 'Deep clean bathrooms'),
    (target_user, 2, 'Vacuum the rugs'),
    (target_user, 3, 'Change bed sheets'),
    (target_user, 4, 'Dust surfaces'),
    (target_user, 5, 'Wipe baseboards'),
    (target_user, 6, 'Clean out fridge');

  -- Meals: empty placeholders for the week
  insert into public.meals (user_id, day, slot, text) values
    (target_user, 'Sun', 'L', ''),(target_user, 'Sun', 'D', ''),
    (target_user, 'Mon', 'L', ''),(target_user, 'Mon', 'D', ''),
    (target_user, 'Tue', 'L', ''),(target_user, 'Tue', 'D', ''),
    (target_user, 'Wed', 'L', ''),(target_user, 'Wed', 'D', ''),
    (target_user, 'Thu', 'L', ''),(target_user, 'Thu', 'D', ''),
    (target_user, 'Fri', 'L', ''),(target_user, 'Fri', 'D', ''),
    (target_user, 'Sat', 'L', ''),(target_user, 'Sat', 'D', '');

  -- Household items: three labeled placeholders
  insert into public.household_items (user_id, position, label, value) values
    (target_user, 0, 'Pediatrician', ''),
    (target_user, 1, 'Emergency', ''),
    (target_user, 2, 'Wi-Fi', '');
end;
$$;

grant execute on function public.seed_new_user(uuid) to authenticated;

-- ─── delete_user_account — full cascade delete ──────────────────────
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'must be authenticated';
  end if;
  -- FK on profiles.id has on delete cascade; deleting auth.users row also deletes profile.
  -- Storage objects are removed by a separate API call from the client (Supabase Storage SDK
  -- does not have a server-side cascade). We delete the auth user here; client must clean Storage.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_user_account() to authenticated;

-- ─── Storage bucket: moments ────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('moments', 'moments', false)
on conflict (id) do nothing;

create policy "moments_own_select" on storage.objects
  for select using (
    bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "moments_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "moments_own_update" on storage.objects
  for update using (
    bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "moments_own_delete" on storage.objects
  for delete using (
    bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;

-- ─── thought_lists / thought_items ──────────────────────────────────
-- Named lists with checkable items. Replaces the Moments photo journal
-- as the freeform-capture surface in Maison.

create table public.thought_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null default '',
  archived     boolean not null default false,
  archived_at  timestamptz,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index thought_lists_user_idx
  on public.thought_lists(user_id, archived, position);
alter table public.thought_lists enable row level security;
create policy "thought_lists_own_all" on public.thought_lists
  for all using (auth.uid() = user_id);

create table public.thought_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.thought_lists(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null default '',
  done       boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index thought_items_list_position_idx
  on public.thought_items(list_id, position);
alter table public.thought_items enable row level security;
create policy "thought_items_own_all" on public.thought_items
  for all using (auth.uid() = user_id);

-- ─── drop moments ───────────────────────────────────────────────────
-- Photo journal removed in favor of Thoughts. The matching Storage
-- bucket (`moments`) is deleted separately via the dashboard.

drop table if exists public.moments;

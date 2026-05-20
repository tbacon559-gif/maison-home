-- ─── share_links ────────────────────────────────────────────────────
-- Magic-link sharing surface. Token-keyed rows that grant a public,
-- read-only, time-limited view of an owner's data via the
-- /api/share/sitter/[token] serverless route. The sitter never reads
-- this table directly — only the service-role API route does.

create table public.share_links (
  token        text primary key,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind = 'sitter'),
  tonight_plan text not null default '',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);

create index share_links_owner_idx
  on public.share_links (owner_id, created_at desc);

alter table public.share_links enable row level security;

create policy "share_links owner select"
  on public.share_links for select
  using (owner_id = auth.uid());

create policy "share_links owner insert"
  on public.share_links for insert
  with check (owner_id = auth.uid());

create policy "share_links owner update"
  on public.share_links for update
  using (owner_id = auth.uid());

create policy "share_links owner delete"
  on public.share_links for delete
  using (owner_id = auth.uid());

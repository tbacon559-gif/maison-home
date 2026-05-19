# Maison Productize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accounts, cloud-primary data, selective E2E encryption, onboarding, and one-time local-data migration to Maison per the [Productize design spec](../specs/2026-05-19-maison-productize-design.md).

**Architecture:** A fully separate Supabase project (Postgres + Auth + Storage + RLS) provides the data layer. The React client gains an `<AuthProvider>` at the root, per-table hooks (`useDailyTasks`, `useMoments`, etc.) that replace the existing `usePersistedState`, and a Web-Crypto-based encryption helper for the two journal-like surfaces (Moments + Quick Notes). All other content stays plaintext under RLS. Cloud-primary reads use an IndexedDB cache for offline tolerance.

**Tech Stack:** Vite + React 18, `@supabase/supabase-js@2` (new dependency), Web Crypto API (no library), IndexedDB (existing usage extended), vitest + React Testing Library + jsdom for tests, `TZ=UTC` for date stability.

---

## Prerequisites — one-time manual setup (you, before Task 1)

These steps are done once by Taylor before the implementer starts. They cannot be automated by a subagent because they require account creation, dashboard navigation, and copying secrets.

### P1. Create the Maison Supabase project

1. Go to **supabase.com** → sign in (or create account). Make sure you're NOT signing into the Mantle project — this is a separate project.
2. **New Project**. Name: `maison`. Region: pick closest to your users (e.g., `us-east-1`). Generate a strong database password and store it in a password manager. Click **Create new project**. Wait ~2 minutes for provisioning.
3. Once provisioned, go to **Project Settings → API**. You'll need two values from this page:
   - **Project URL** (e.g., `https://abcdefghijklmnop.supabase.co`)
   - **anon / public** key (a long JWT starting with `eyJhbGc...`)

### P2. Fill `.env.local` in the repo

Create the file `/Users/taylor/Code/maison-home/.env.local` with the two values from P1:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

This file is gitignored (the implementer will add it to `.gitignore` in Task 1 if not already).

### P3. Set Vercel env vars (for production deploys)

In the Vercel dashboard for the maison-home project, **Settings → Environment Variables**, add the same two variables for the Production environment. (Skip for now if you'll only run locally during implementation; add before merging to main.)

---

## File structure

### Files this plan creates

**Library / infrastructure:**
- `src/lib/supabase.js` — Supabase client singleton
- `src/lib/crypto.js` — Web Crypto helpers (deriveKey, generateSalt, encryptText, decryptText, encryptBlob, decryptBlob)
- `src/lib/crypto.test.js` — tests for crypto helpers
- `src/lib/cache.js` — IndexedDB row cache (read, write, clear)
- `src/lib/cache.test.js` — tests
- `src/lib/photoCache.js` — IndexedDB photo cache (getPhoto, put, clear)
- `src/lib/photoCache.test.js` — tests
- `src/lib/optimistic.js` — `withOptimistic` helper
- `src/lib/optimistic.test.js` — tests
- `src/lib/auth.jsx` — `<AuthProvider>` + `useAuth()`
- `src/lib/migrate.js` — One-time local→cloud import logic
- `src/lib/migrate.test.js` — tests for detection logic

**Per-table hooks (each in its own file):**
- `src/hooks/useProfile.js`
- `src/hooks/useKids.js`
- `src/hooks/useHouseholdItems.js`
- `src/hooks/useDailyTasks.js`
- `src/hooks/useWeeklyTasks.js`
- `src/hooks/useMeals.js`
- `src/hooks/useListItems.js`
- `src/hooks/useNotes.js`
- `src/hooks/useMoments.js`

**UI screens / components:**
- `src/components/SigninScreen.jsx`
- `src/components/SignupScreen.jsx`
- `src/components/HardshipRequestModal.jsx`
- `src/components/PasswordResetScreen.jsx`
- `src/components/OnboardingFlow.jsx` (contains NameStep + KidsStep)
- `src/components/ReviewPendingScreen.jsx`
- `src/components/TrialEndedBanner.jsx`
- `src/components/AccountSettings.jsx` (new — logout + delete account + founding marker; mounted inside SettingsModal)

**Database migrations:**
- `supabase/migrations/0001_init.sql` — all tables, RLS policies, seed function, delete function, Storage bucket + policies

**Config:**
- `.env.example` — checked-in template

### Files this plan modifies

- `package.json` — add `@supabase/supabase-js` dependency
- `.gitignore` — ensure `.env.local` is ignored
- `src/App.jsx` — wrap in `<AuthProvider>`, status-based routing, swap `usePersistedState` calls for hooks
- `src/components/TidyTab.jsx` — consume `useDailyTasks` + `useWeeklyTasks`
- `src/components/KitchenTab.jsx` — consume `useMeals` + `useListItems`
- `src/components/SettingsModal.jsx` — embed `<AccountSettings>` and use `useProfile`
- `src/components/SitterCardModal.jsx` — consume `useKids`, `useHouseholdItems`, and `profile.sitter_notes`

### Files this plan deletes

- `src/lib/storage.js` — replaced by `cache.js` + `photoCache.js`; the one-shot read of legacy data lives in `migrate.js`
- `src/lib/storage.test.js` — accompanies the deletion

### Files this plan does NOT touch

- `src/data/welcome.js`, `src/data/keep.js`, `src/data/initial.js` — these stay (content + seed defaults)
- `src/lib/dates.js`, `src/lib/ics.js`, `src/lib/svg.js`, `src/lib/rollover.js` — unchanged utilities
- `src/components/Components.jsx`, `WelcomeOverlay.jsx`, `KeepCallout.jsx`, `KeepList.jsx`, `KeepReader.jsx`, `SeventhDay.jsx` — unchanged

---

## Notes on TDD discipline

- **Pure functions (`crypto.js`, `cache.js`, `photoCache.js`, `optimistic.js`, `migrate.js` detection):** strict TDD — failing test, then implementation.
- **Hooks:** behavioral tests with Supabase mocked at the module level using vitest's `vi.mock('../lib/supabase')`. Mocks return canned data. Not strict TDD but tests-with-implementation.
- **UI screens (signin, signup, onboarding, etc.):** smoke tests only — render and verify a couple of key elements + simple interaction. Not strict TDD.
- **Auth provider:** smoke tests around state transitions; deep auth tests aren't worth the mock complexity.

---

## Task 1: Install Supabase dependency and configure env

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Modify: `.gitignore` (if `.env.local` not already ignored)

- [ ] **Step 1: Install @supabase/supabase-js**

```bash
cd /Users/taylor/Code/maison-home
npm install @supabase/supabase-js@^2
```

Expected: `package.json` `dependencies` now includes `@supabase/supabase-js: ^2.x.y`. `package-lock.json` updated.

- [ ] **Step 2: Create `.env.example`**

```bash
# Supabase (get from https://supabase.com/dashboard → your project → Settings → API)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Ensure `.env.local` is gitignored**

Open `.gitignore` and confirm `.env.local` is present. If not, append it:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 4: Verify `.env.local` exists with real values (prerequisite check)**

Run:
```bash
test -f .env.local && grep -q VITE_SUPABASE_URL .env.local && echo "OK" || echo "MISSING: see Prerequisites P2"
```
Expected: `OK`. If MISSING, stop and notify the user — the Supabase project has not been set up per Prerequisites.

- [ ] **Step 5: Build to confirm install is clean**

```bash
npm run build
```
Expected: clean build (no errors). The new dependency is present in node_modules but not yet imported anywhere.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "Add @supabase/supabase-js dependency and env config"
```

---

## Task 2: Database migration — tables, RLS, functions, Storage

**Files:**
- Create: `supabase/migrations/0001_init.sql`

This task writes the SQL migration file. **Applying** it to the Supabase project happens in Task 3.

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p /Users/taylor/Code/maison-home/supabase/migrations
```

- [ ] **Step 2: Create `supabase/migrations/0001_init.sql`**

```sql
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
```

- [ ] **Step 3: Commit (SQL file only — application happens in Task 3)**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "Add initial DB migration — tables, RLS, seed/delete functions, Storage bucket"
```

---

## Task 3: Apply the migration to the Supabase project

**Files:**
- None modified in repo.

This task runs the SQL from Task 2 against the live Supabase project.

- [ ] **Step 1: Apply via Supabase Studio SQL Editor (recommended for first run)**

1. Open the Supabase dashboard for the maison project.
2. Go to **SQL Editor** → New query.
3. Paste the entire contents of `supabase/migrations/0001_init.sql`.
4. Click **Run**.
5. Expected: "Success. No rows returned" (or similar). If any error, fix in the SQL file, commit the fix, and re-run.

**Alternative — Supabase CLI** (if `supabase` is installed locally):

```bash
cd /Users/taylor/Code/maison-home
supabase link --project-ref <your-project-ref>
supabase db push
```

- [ ] **Step 2: Verify the schema landed**

In Supabase Studio → Table Editor, confirm these tables exist with no data: `profiles`, `kids`, `household_items`, `daily_tasks`, `weekly_tasks`, `meals`, `list_items`, `notes`, `moments`, `hardship_requests`.

Confirm in **Storage** that the `moments` bucket exists and is **Private**.

- [ ] **Step 3: Verify RLS is enabled**

In Supabase Studio → Authentication → Policies, confirm each table shows policies under it (read/write own rows).

- [ ] **Step 4: Verify functions**

In SQL Editor, run:
```sql
select proname from pg_proc where pronamespace = 'public'::regnamespace;
```
Expected output includes `seed_new_user` and `delete_user_account`.

No commit for this task — schema lives in the live project, the SQL file is already committed.

---

## Task 4: Supabase client singleton

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Create `src/lib/supabase.js`**

```javascript
// ─── Supabase client singleton ────────────────────────────────────
// Env vars come from .env.local (development) and Vercel project settings
// (production). See docs/superpowers/specs/2026-05-19-maison-productize-design.md
// for the project setup steps.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your project URL and anon key.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: clean. (Module is imported nowhere yet, but the bundler resolves it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.js
git commit -m "Add Supabase client singleton"
```

---

## Task 5: Encryption helpers (TDD)

**Files:**
- Create: `src/lib/crypto.js`
- Create: `src/lib/crypto.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/crypto.test.js`:

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateSalt,
  deriveKey,
  encryptText,
  decryptText,
  encryptBlob,
  decryptBlob,
} from './crypto.js';

// jsdom does not include crypto.subtle by default; vitest's environment must include it.
// Node 20+ provides globalThis.crypto.subtle natively, which jsdom inherits.

beforeAll(() => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Test env missing crypto.subtle — requires Node 20+');
  }
});

describe('generateSalt', () => {
  it('returns a base64 string with 16 bytes of entropy', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    const decoded = atob(salt);
    expect(decoded.length).toBe(16);
  });

  it('produces a different salt on each call', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});

describe('deriveKey', () => {
  it('produces a CryptoKey usable by AES-GCM', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.algorithm.length).toBe(256);
  });

  it('is deterministic — same password + salt → same key bits', async () => {
    const salt = generateSalt();
    const a = await deriveKey('password', salt);
    const b = await deriveKey('password', salt);
    // Both encrypt the same plaintext + same IV to the same ciphertext.
    const plain = 'hello';
    const ivA = new Uint8Array(12);
    const ivB = new Uint8Array(12);
    const ctA = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivA }, a, new TextEncoder().encode(plain)));
    const ctB = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivB }, b, new TextEncoder().encode(plain)));
    expect(Array.from(ctA)).toEqual(Array.from(ctB));
  });

  it('differs when password differs', async () => {
    const salt = generateSalt();
    const a = await deriveKey('passwordA', salt);
    const b = await deriveKey('passwordB', salt);
    const iv = new Uint8Array(12);
    const plain = 'hello';
    const ctA = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, a, new TextEncoder().encode(plain)));
    const ctB = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, b, new TextEncoder().encode(plain)));
    expect(Array.from(ctA)).not.toEqual(Array.from(ctB));
  });
});

describe('encryptText / decryptText', () => {
  it('round-trips plaintext through ciphertext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    const ct = await encryptText(key, 'a quiet note');
    expect(typeof ct).toBe('string');
    expect(ct).not.toContain('a quiet note');
    const pt = await decryptText(key, ct);
    expect(pt).toBe('a quiet note');
  });

  it('produces a different ciphertext each call (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    const a = await encryptText(key, 'same text');
    const b = await encryptText(key, 'same text');
    expect(a).not.toBe(b);
  });

  it('throws on decrypt with wrong key', async () => {
    const salt = generateSalt();
    const keyA = await deriveKey('pwA', salt);
    const keyB = await deriveKey('pwB', salt);
    const ct = await encryptText(keyA, 'secret');
    await expect(decryptText(keyB, ct)).rejects.toThrow();
  });

  it('handles unicode text', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const text = 'Café — 日本語 — 🌿';
    const ct = await encryptText(key, text);
    expect(await decryptText(key, ct)).toBe(text);
  });
});

describe('encryptBlob / decryptBlob', () => {
  it('round-trips a binary buffer', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const original = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const encrypted = await encryptBlob(key, original.buffer);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(original.byteLength); // includes IV + GCM tag
    const decrypted = await decryptBlob(key, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(original);
  });

  it('produces different ciphertexts for same input (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const a = new Uint8Array(await encryptBlob(key, buf));
    const b = new Uint8Array(await encryptBlob(key, buf));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('decrypt fails with wrong key', async () => {
    const salt = generateSalt();
    const keyA = await deriveKey('a', salt);
    const keyB = await deriveKey('b', salt);
    const buf = new Uint8Array([9, 9, 9]).buffer;
    const encrypted = await encryptBlob(keyA, buf);
    await expect(decryptBlob(keyB, encrypted)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- crypto
```
Expected: FAIL with "Failed to load url ./crypto.js".

- [ ] **Step 3: Create `src/lib/crypto.js`**

```javascript
// ─── Web Crypto helpers for E2E content ──────────────────────────
// Used by useNotes and useMoments to encrypt/decrypt journal-like content
// before it leaves the device. Spec: see Section 4 of the Productize design.

const PBKDF2_ITERATIONS = 100_000;
const KEY_BITS = 256;
const IV_BYTES = 12; // AES-GCM standard

const enc = new TextEncoder();
const dec = new TextDecoder();

// Fail loud if Web Crypto is unavailable. Per spec Section 4, the failure
// mode is "refuse to save", not "silently fall back to plaintext."
if (typeof crypto === 'undefined' || !crypto.subtle) {
  throw new Error('Web Crypto API unavailable — this browser is unsupported.');
}

// ─── Base64 helpers (browser-safe) ────────────────────────────────
function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─── Salt generation ───────────────────────────────────────────────
export function generateSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToB64(salt);
}

// ─── Key derivation (PBKDF2 → AES-256-GCM key) ────────────────────
export async function deriveKey(password, saltB64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

// ─── Text encrypt/decrypt ─────────────────────────────────────────
export async function encryptText(key, plaintext) {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  // Concat iv ‖ ciphertext, then base64.
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return bytesToB64(out);
}

export async function decryptText(key, b64) {
  const bytes = b64ToBytes(b64);
  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ct
  );
  return dec.decode(ptBuf);
}

// ─── Blob encrypt/decrypt (for photos) ────────────────────────────
export async function encryptBlob(key, arrayBuffer) {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, arrayBuffer
  );
  // Return iv ‖ ciphertext as ArrayBuffer.
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out.buffer;
}

export async function decryptBlob(key, arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ct
  );
  return ptBuf;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- crypto
```
Expected: all describe blocks PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.js src/lib/crypto.test.js
git commit -m "Add crypto helpers — PBKDF2 + AES-256-GCM for E2E content"
```

---

## Task 6: Row cache (TDD)

**Files:**
- Create: `src/lib/cache.js`
- Create: `src/lib/cache.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cache.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { cache } from './cache.js';

const USER = '00000000-0000-0000-0000-000000000001';

beforeEach(async () => {
  await cache.clear();
});

describe('cache.read / cache.write', () => {
  it('read returns null when no entry exists', async () => {
    expect(await cache.read('daily_tasks', USER)).toBeNull();
  });

  it('write then read returns the same rows', async () => {
    const rows = [{ id: 'a', label: 'one' }, { id: 'b', label: 'two' }];
    await cache.write('daily_tasks', USER, rows);
    expect(await cache.read('daily_tasks', USER)).toEqual(rows);
  });

  it('different tables for same user are isolated', async () => {
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('weekly_tasks', USER, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'a' }]);
    expect(await cache.read('weekly_tasks', USER)).toEqual([{ id: 'b' }]);
  });

  it('different users for same table are isolated', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('daily_tasks', userB, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'a' }]);
    expect(await cache.read('daily_tasks', userB)).toEqual([{ id: 'b' }]);
  });

  it('write overwrites previous value for same key', async () => {
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('daily_tasks', USER, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'b' }]);
  });
});

describe('cache.clear', () => {
  it('removes all entries across tables and users', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('weekly_tasks', userB, [{ id: 'b' }]);
    await cache.clear();
    expect(await cache.read('daily_tasks', USER)).toBeNull();
    expect(await cache.read('weekly_tasks', userB)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- cache.test
```
Expected: FAIL with "Failed to load url ./cache.js".

- [ ] **Step 3: Create `src/lib/cache.js`**

```javascript
// ─── Row cache — IndexedDB-backed read-through cache ──────────────
// Per-(table, user) JSON array. Cleared on logout.

const DB_NAME = 'maison_cache';
const DB_VERSION = 1;
const STORE = 'rows';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function key(table, userId) {
  return `${table}:${userId}`;
}

async function read(table, userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key(table, userId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function write(table, userId, rows) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rows, key(table, userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const cache = { read, write, clear };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- cache.test
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.js src/lib/cache.test.js
git commit -m "Add IndexedDB row cache"
```

---

## Task 7: Photo cache (TDD)

**Files:**
- Create: `src/lib/photoCache.js`
- Create: `src/lib/photoCache.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/photoCache.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { photoCache } from './photoCache.js';

const USER = '00000000-0000-0000-0000-000000000001';

beforeEach(async () => {
  await photoCache.clear();
});

describe('photoCache.put / photoCache.getPhoto', () => {
  it('returns null when no entry exists', async () => {
    expect(await photoCache.getPhoto(USER, 'm1')).toBeNull();
  });

  it('put then getPhoto returns the same bytes', async () => {
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    await photoCache.put(USER, 'm1', buf);
    const out = await photoCache.getPhoto(USER, 'm1');
    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf));
  });

  it('different moments are isolated', async () => {
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.put(USER, 'm2', new Uint8Array([2]).buffer);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm1'))[0]).toBe(1);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm2'))[0]).toBe(2);
  });

  it('different users for same moment id are isolated', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.put(userB, 'm1', new Uint8Array([2]).buffer);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm1'))[0]).toBe(1);
    expect(new Uint8Array(await photoCache.getPhoto(userB, 'm1'))[0]).toBe(2);
  });
});

describe('photoCache.clear', () => {
  it('removes all entries', async () => {
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.clear();
    expect(await photoCache.getPhoto(USER, 'm1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- photoCache.test
```
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/photoCache.js`**

```javascript
// ─── Photo cache — IndexedDB for decrypted photo ArrayBuffers ─────
// Keyed by {userId}:{momentId}. Cleared on logout.

const DB_NAME = 'maison_photos';
const DB_VERSION = 1;
const STORE = 'photos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function key(userId, momentId) {
  return `${userId}:${momentId}`;
}

async function getPhoto(userId, momentId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key(userId, momentId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function put(userId, momentId, arrayBuffer) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(arrayBuffer, key(userId, momentId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const photoCache = { getPhoto, put, clear };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- photoCache.test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photoCache.js src/lib/photoCache.test.js
git commit -m "Add IndexedDB photo cache"
```

---

## Task 8: Optimistic-update helper (TDD)

**Files:**
- Create: `src/lib/optimistic.js`
- Create: `src/lib/optimistic.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/optimistic.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { withOptimistic } from './optimistic.js';

describe('withOptimistic', () => {
  it('applies the optimistic delta immediately and resolves on success', async () => {
    let state = { count: 0 };
    const setState = vi.fn((u) => { state = typeof u === 'function' ? u(state) : u; });
    const network = vi.fn(async () => 'ok');

    const result = await withOptimistic(
      setState,
      (prev) => ({ ...prev, count: prev.count + 1 }),
      network
    );

    expect(result).toBe('ok');
    expect(state).toEqual({ count: 1 });
    expect(setState).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('reverts to pre-state on network failure and rethrows', async () => {
    let state = { count: 0 };
    const setState = vi.fn((u) => { state = typeof u === 'function' ? u(state) : u; });
    const network = vi.fn(async () => { throw new Error('boom'); });

    await expect(withOptimistic(
      setState,
      (prev) => ({ ...prev, count: prev.count + 1 }),
      network
    )).rejects.toThrow('boom');

    // setState called twice: optimistic, then revert.
    expect(setState).toHaveBeenCalledTimes(2);
    expect(state).toEqual({ count: 0 });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- optimistic.test
```
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/optimistic.js`**

```javascript
// ─── Optimistic-update helper ────────────────────────────────────
// Capture pre-state via the functional setState pattern, apply the
// optimistic delta, await the network call. On failure, revert and
// rethrow so the caller can surface an error to the user.

export async function withOptimistic(setState, delta, networkCall) {
  let pre;
  setState((prev) => {
    pre = prev;
    return delta(prev);
  });
  try {
    return await networkCall();
  } catch (err) {
    setState(pre);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- optimistic.test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/optimistic.js src/lib/optimistic.test.js
git commit -m "Add withOptimistic helper"
```

---

## Task 9: AuthProvider and useAuth

**Files:**
- Create: `src/lib/auth.jsx`

This task creates the authentication context. No strict TDD — testing the provider requires a full Supabase mock that's more work than it's worth. We rely on the end-to-end smoke pass in Task 32 and on the consumer hooks/screens having their own tests.

- [ ] **Step 1: Create `src/lib/auth.jsx`**

```jsx
// ─── Auth provider — session + encryption key + status routing ────
// Wraps the entire app. Components access via useAuth(). The status
// string drives top-level routing in App.jsx.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase.js';
import { deriveKey, generateSalt } from './crypto.js';
import { cache } from './cache.js';
import { photoCache } from './photoCache.js';

const AuthContext = createContext(null);

const TRIAL_DAYS = 14;

function computeEffectiveStatus(profile) {
  if (!profile) return null;
  const now = new Date();
  if (profile.subscription_status === 'trialing'
      && profile.trial_ends_at
      && new Date(profile.trial_ends_at) < now) return 'trial_expired';
  if (profile.subscription_status === 'hardship_granted'
      && profile.hardship_granted_until
      && new Date(profile.hardship_granted_until) < now) return 'trial_expired';
  return profile.subscription_status;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [status, setStatus] = useState('loading');
  const [pendingPassword, setPendingPassword] = useState(null); // held across signup-then-sign-in

  // Bootstrap on mount: check for existing session
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (!active) return;
      setSession(existing);
      if (!existing) {
        setStatus('signed_out');
      } else {
        // Existing session — but we don't have the password, so we can't
        // re-derive the encryption key. User must sign in again to read
        // E2E content. Treat as signed_out for app-level gating, but keep
        // the session alive so the next signin is one tap.
        // (Future enhancement: prompt for password to "unlock" content.)
        setStatus('signed_out');
      }
    })();
    return () => { active = false; };
  }, []);

  // Watch for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Helper: fetch profile, derive key, route
  const completeSignin = useCallback(async (password) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('signed_out');
      return;
    }
    const { data: prof, error } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    if (error || !prof) {
      setStatus('signed_out');
      return;
    }
    setProfile(prof);
    const key = await deriveKey(password, prof.encryption_salt);
    setEncryptionKey(key);
    setStatus('authenticated');
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
    await completeSignin(password);
  }, [completeSignin]);

  const signUp = useCallback(async (email, password) => {
    // Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Signup did not return a user');

    // Create profile row with salt + trial window
    const salt = generateSalt();
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      subscription_status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
      encryption_salt: salt,
      is_founding_member: false,
    });
    if (profileErr) throw profileErr;

    // Run seed function
    await supabase.rpc('seed_new_user', { target_user: data.user.id });

    // Derive key and route to onboarding (consumer decides between onboarding vs. import)
    const key = await deriveKey(password, salt);
    setEncryptionKey(key);
    setSession(data.session);
    // Fetch the profile we just inserted
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single();
    setProfile(prof);
    setStatus('onboarding');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await cache.clear();
    await photoCache.clear();
    setProfile(null);
    setEncryptionKey(null);
    setSession(null);
    setStatus('signed_out');
  }, []);

  const requestHardship = useCallback(async (email, reason) => {
    // Create auth user with random placeholder password (the user resets later via email link).
    const placeholderPw = crypto.randomUUID() + crypto.randomUUID();
    const { data, error } = await supabase.auth.signUp({ email, password: placeholderPw });
    if (error) throw error;
    if (!data.user) throw new Error('Signup did not return a user');

    const salt = generateSalt();
    await supabase.from('profiles').insert({
      id: data.user.id,
      subscription_status: 'hardship_pending',
      encryption_salt: salt,
      is_founding_member: false,
    });
    await supabase.from('hardship_requests').insert({
      user_id: data.user.id,
      email,
      reason: reason || null,
    });
    await supabase.auth.signOut(); // don't auto-sign-in pending users
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    // Clear Storage first (server function doesn't reach Storage).
    if (session?.user?.id) {
      const { data: files } = await supabase.storage
        .from('moments').list(session.user.id);
      if (files && files.length) {
        await supabase.storage.from('moments').remove(
          files.map((f) => `${session.user.id}/${f.name}`)
        );
      }
    }
    await supabase.rpc('delete_user_account');
    await cache.clear();
    await photoCache.clear();
    setProfile(null);
    setEncryptionKey(null);
    setSession(null);
    setStatus('signed_out');
  }, [session]);

  // Allow onboarding to advance status
  const finishOnboarding = useCallback(() => setStatus('authenticated'), []);

  const value = {
    session,
    userId: session?.user?.id ?? null,
    profile,
    effectiveStatus: computeEffectiveStatus(profile),
    encryptionKey,
    status,
    signIn,
    signUp,
    signOut,
    requestHardship,
    resetPassword,
    deleteAccount,
    finishOnboarding,
    setProfile, // exposed so useProfile can update parent state after a profile mutation
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
```

- [ ] **Step 2: Build to confirm compiles**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: still passing (no consumers yet). Auth provider is dormant until App.jsx wires it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.jsx
git commit -m "Add AuthProvider and useAuth — session, key derivation, status routing"
```

---

## Task 10: useProfile hook

**Files:**
- Create: `src/hooks/useProfile.js`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/taylor/Code/maison-home/src/hooks
```

Create `src/hooks/useProfile.js`:

```javascript
// ─── useProfile — read/update the user's profile row ──────────────
// Profile is loaded by AuthProvider on signin; this hook exposes mutation
// methods that update the row and refresh local state.

import { useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useProfile() {
  const { profile, setProfile, userId } = useAuth();

  const update = useCallback(async (patch) => {
    if (!userId) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    const { error } = await supabase
      .from('profiles').update(patch).eq('id', userId);
    if (error) {
      // Revert on failure
      setProfile(profile);
      throw error;
    }
  }, [profile, setProfile, userId]);

  return { profile, update };
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfile.js
git commit -m "Add useProfile hook"
```

---

## Task 11: useKids hook

**Files:**
- Create: `src/hooks/useKids.js`

- [ ] **Step 1: Create `src/hooks/useKids.js`**

```javascript
// ─── useKids — list, add, edit, remove kids ───────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useKids() {
  const { userId } = useAuth();
  const [kids, setKids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('kids', userId);
      if (cached && active) { setKids(cached); setLoading(false); }
      const { data } = await supabase
        .from('kids').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setKids(data);
        await cache.write('kids', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const add = useCallback(async (fields = {}) => {
    const position = kids.length;
    const { data, error } = await supabase
      .from('kids')
      .insert({ user_id: userId, position, ...fields })
      .select().single();
    if (error) throw error;
    setKids((prev) => [...prev, data]);
    await cache.write('kids', userId, [...kids, data]);
  }, [kids, userId]);

  const edit = useCallback(async (id, fields) => {
    await withOptimistic(
      setKids,
      (prev) => prev.map((k) => (k.id === id ? { ...k, ...fields } : k)),
      async () => {
        const { error } = await supabase.from('kids').update(fields).eq('id', id);
        if (error) throw error;
        await cache.write('kids', userId, kids.map((k) => (k.id === id ? { ...k, ...fields } : k)));
      }
    );
  }, [kids, userId]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setKids,
      (prev) => prev.filter((k) => k.id !== id),
      async () => {
        const { error } = await supabase.from('kids').delete().eq('id', id);
        if (error) throw error;
        await cache.write('kids', userId, kids.filter((k) => k.id !== id));
      }
    );
  }, [kids, userId]);

  return { kids, loading, add, edit, remove };
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useKids.js
git commit -m "Add useKids hook"
```

---

## Task 12: useHouseholdItems hook

**Files:**
- Create: `src/hooks/useHouseholdItems.js`

- [ ] **Step 1: Create `src/hooks/useHouseholdItems.js`**

```javascript
// ─── useHouseholdItems — the "If You Need It" key/value list ──────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useHouseholdItems() {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('household_items', userId);
      if (cached && active) { setItems(cached); setLoading(false); }
      const { data } = await supabase
        .from('household_items').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setItems(data);
        await cache.write('household_items', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const add = useCallback(async (label = '', value = '') => {
    const position = items.length;
    const { data, error } = await supabase
      .from('household_items')
      .insert({ user_id: userId, position, label, value })
      .select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
    await cache.write('household_items', userId, [...items, data]);
  }, [items, userId]);

  const edit = useCallback(async (id, fields) => {
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)),
      async () => {
        const { error } = await supabase.from('household_items').update(fields).eq('id', id);
        if (error) throw error;
        await cache.write('household_items', userId, items.map((i) => (i.id === id ? { ...i, ...fields } : i)));
      }
    );
  }, [items, userId]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setItems,
      (prev) => prev.filter((i) => i.id !== id),
      async () => {
        const { error } = await supabase.from('household_items').delete().eq('id', id);
        if (error) throw error;
        await cache.write('household_items', userId, items.filter((i) => i.id !== id));
      }
    );
  }, [items, userId]);

  return { items, loading, add, edit, remove };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useHouseholdItems.js
git commit -m "Add useHouseholdItems hook"
```

---

## Task 13: useDailyTasks hook

**Files:**
- Create: `src/hooks/useDailyTasks.js`

- [ ] **Step 1: Create `src/hooks/useDailyTasks.js`**

```javascript
// ─── useDailyTasks — day/night slot tasks ─────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

function groupBySlot(rows) {
  return {
    day: rows.filter((r) => r.slot === 'day'),
    night: rows.filter((r) => r.slot === 'night'),
  };
}

export function useDailyTasks() {
  const { userId } = useAuth();
  const [state, setState] = useState({ day: [], night: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('daily_tasks', userId);
      if (cached && active) { setState(groupBySlot(cached)); setLoading(false); }
      const { data } = await supabase
        .from('daily_tasks').select('*').eq('user_id', userId)
        .order('slot').order('position');
      if (data && active) {
        setState(groupBySlot(data));
        await cache.write('daily_tasks', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const toggle = useCallback(async (slot, id) => {
    const current = state[slot].find((t) => t.id === id);
    if (!current) return;
    await withOptimistic(
      setState,
      (prev) => ({ ...prev, [slot]: prev[slot].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
      async () => {
        const { error } = await supabase.from('daily_tasks')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [state]);

  const add = useCallback(async (slot, label = '') => {
    const position = state[slot].length;
    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({ user_id: userId, slot, position, label, done: false })
      .select().single();
    if (error) throw error;
    setState((prev) => ({ ...prev, [slot]: [...prev[slot], data] }));
  }, [state, userId]);

  const edit = useCallback(async (id, label) => {
    await withOptimistic(
      setState,
      (prev) => ({
        day: prev.day.map((t) => (t.id === id ? { ...t, label } : t)),
        night: prev.night.map((t) => (t.id === id ? { ...t, label } : t)),
      }),
      async () => {
        const { error } = await supabase.from('daily_tasks').update({ label }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setState,
      (prev) => ({
        day: prev.day.filter((t) => t.id !== id),
        night: prev.night.filter((t) => t.id !== id),
      }),
      async () => {
        const { error } = await supabase.from('daily_tasks').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  // Bulk-reset all done flags to false. Used by App.jsx on day rollover.
  const resetAll = useCallback(async () => {
    if (!userId) return;
    setState((prev) => ({
      day: prev.day.map((t) => ({ ...t, done: false })),
      night: prev.night.map((t) => ({ ...t, done: false })),
    }));
    const { error } = await supabase.from('daily_tasks')
      .update({ done: false }).eq('user_id', userId);
    if (error) throw error;
  }, [userId]);

  return { day: state.day, night: state.night, loading, toggle, add, edit, remove, resetAll };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useDailyTasks.js
git commit -m "Add useDailyTasks hook"
```

---

## Task 14: useWeeklyTasks hook

**Files:**
- Create: `src/hooks/useWeeklyTasks.js`

- [ ] **Step 1: Create `src/hooks/useWeeklyTasks.js`**

```javascript
// ─── useWeeklyTasks — the weekly "bigger stuff" list ──────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useWeeklyTasks() {
  const { userId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('weekly_tasks', userId);
      if (cached && active) { setTasks(cached); setLoading(false); }
      const { data } = await supabase
        .from('weekly_tasks').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setTasks(data);
        await cache.write('weekly_tasks', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const toggle = useCallback(async (id) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    await withOptimistic(
      setTasks,
      (prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      async () => {
        const { error } = await supabase.from('weekly_tasks')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [tasks]);

  const add = useCallback(async (label = '') => {
    const position = tasks.length;
    const { data, error } = await supabase
      .from('weekly_tasks')
      .insert({ user_id: userId, position, label, done: false })
      .select().single();
    if (error) throw error;
    setTasks((prev) => [...prev, data]);
  }, [tasks, userId]);

  const edit = useCallback(async (id, label) => {
    await withOptimistic(
      setTasks,
      (prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)),
      async () => {
        const { error } = await supabase.from('weekly_tasks').update({ label }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setTasks,
      (prev) => prev.filter((t) => t.id !== id),
      async () => {
        const { error } = await supabase.from('weekly_tasks').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  // Bulk-reset all done flags to false. Used by App.jsx on weekly rollover.
  const resetAll = useCallback(async () => {
    if (!userId) return;
    setTasks((prev) => prev.map((t) => ({ ...t, done: false })));
    const { error } = await supabase.from('weekly_tasks')
      .update({ done: false }).eq('user_id', userId);
    if (error) throw error;
  }, [userId]);

  return { tasks, loading, toggle, add, edit, remove, resetAll };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useWeeklyTasks.js
git commit -m "Add useWeeklyTasks hook"
```

---

## Task 15: useMeals hook

**Files:**
- Create: `src/hooks/useMeals.js`

- [ ] **Step 1: Create `src/hooks/useMeals.js`**

```javascript
// ─── useMeals — week × {Lunch, Dinner} grid ───────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function rowsToMap(rows) {
  const out = {};
  for (const d of DAYS) out[d] = { L: '', D: '' };
  for (const r of rows) {
    out[r.day][r.slot] = r.text;
  }
  return out;
}

export function useMeals() {
  const { userId } = useAuth();
  const [meals, setMeals] = useState(rowsToMap([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('meals', userId);
      if (cached && active) { setMeals(rowsToMap(cached)); setLoading(false); }
      const { data } = await supabase
        .from('meals').select('*').eq('user_id', userId);
      if (data && active) {
        setMeals(rowsToMap(data));
        await cache.write('meals', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const setMeal = useCallback(async (day, slot, text) => {
    await withOptimistic(
      setMeals,
      (prev) => ({ ...prev, [day]: { ...prev[day], [slot]: text } }),
      async () => {
        const { error } = await supabase.from('meals').upsert(
          { user_id: userId, day, slot, text },
          { onConflict: 'user_id,day,slot' }
        );
        if (error) throw error;
      }
    );
  }, [userId]);

  return { meals, loading, setMeal };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useMeals.js
git commit -m "Add useMeals hook"
```

---

## Task 16: useListItems hook

**Files:**
- Create: `src/hooks/useListItems.js`

- [ ] **Step 1: Create `src/hooks/useListItems.js`**

```javascript
// ─── useListItems — grocery OR tobuy, distinguished by 'list' arg ──

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useListItems(list) {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cacheKey = `list_items:${list}`;
      const cached = await cache.read(cacheKey, userId);
      if (cached && active) { setItems(cached); setLoading(false); }
      const { data } = await supabase
        .from('list_items').select('*')
        .eq('user_id', userId).eq('list', list).order('position');
      if (data && active) {
        setItems(data);
        await cache.write(cacheKey, userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, list]);

  const toggle = useCallback(async (id) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, got: !i.got } : i)),
      async () => {
        const { error } = await supabase.from('list_items')
          .update({ got: !current.got }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [items]);

  const add = useCallback(async (item = '') => {
    const position = items.length;
    const { data, error } = await supabase
      .from('list_items')
      .insert({ user_id: userId, list, position, item, got: false })
      .select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
  }, [items, list, userId]);

  const edit = useCallback(async (id, item) => {
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, item } : i)),
      async () => {
        const { error } = await supabase.from('list_items').update({ item }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setItems,
      (prev) => prev.filter((i) => i.id !== id),
      async () => {
        const { error } = await supabase.from('list_items').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  return { items, loading, toggle, add, edit, remove };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useListItems.js
git commit -m "Add useListItems hook"
```

---

## Task 17: useNotes hook (E2E encrypted)

**Files:**
- Create: `src/hooks/useNotes.js`

- [ ] **Step 1: Create `src/hooks/useNotes.js`**

```javascript
// ─── useNotes — Quick Notes with E2E encrypted text ───────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { encryptText, decryptText } from '../lib/crypto.js';
import { withOptimistic } from '../lib/optimistic.js';

async function decryptRows(rows, key) {
  if (!key) return rows.map((r) => ({ ...r, text: '' }));
  const out = [];
  for (const r of rows) {
    try {
      const text = r.text_encrypted ? await decryptText(key, r.text_encrypted) : '';
      out.push({ ...r, text });
    } catch {
      out.push({ ...r, text: '[decrypt error]' });
    }
  }
  return out;
}

export function useNotes() {
  const { userId, encryptionKey } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !encryptionKey) return;
    let active = true;
    (async () => {
      // Cache stores already-decrypted notes (with .text field) — but only for THIS session.
      // To stay simple, cache stores the encrypted rows; we decrypt on every load.
      const cached = await cache.read('notes', userId);
      if (cached && active) {
        const decrypted = await decryptRows(cached, encryptionKey);
        setNotes(decrypted);
        setLoading(false);
      }
      const { data } = await supabase
        .from('notes').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        const decrypted = await decryptRows(data, encryptionKey);
        setNotes(decrypted);
        await cache.write('notes', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, encryptionKey]);

  const add = useCallback(async (text) => {
    if (!encryptionKey) throw new Error('no key');
    const trimmed = text.trim();
    if (!trimmed) return;
    const cipher = await encryptText(encryptionKey, trimmed);
    const position = notes.length;
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, position, text_encrypted: cipher, done: false })
      .select().single();
    if (error) throw error;
    setNotes((prev) => [...prev, { ...data, text: trimmed }]);
  }, [notes, userId, encryptionKey]);

  const toggle = useCallback(async (id) => {
    const current = notes.find((n) => n.id === id);
    if (!current) return;
    await withOptimistic(
      setNotes,
      (prev) => prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n)),
      async () => {
        const { error } = await supabase.from('notes')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [notes]);

  const edit = useCallback(async (id, text) => {
    if (!encryptionKey) throw new Error('no key');
    const cipher = await encryptText(encryptionKey, text);
    await withOptimistic(
      setNotes,
      (prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)),
      async () => {
        const { error } = await supabase.from('notes')
          .update({ text_encrypted: cipher }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [encryptionKey]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setNotes,
      (prev) => prev.filter((n) => n.id !== id),
      async () => {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  return { notes, loading, add, toggle, edit, remove };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useNotes.js
git commit -m "Add useNotes hook with E2E encryption"
```

---

## Task 18: useMoments hook (E2E encrypted captions + photos)

**Files:**
- Create: `src/hooks/useMoments.js`

- [ ] **Step 1: Create `src/hooks/useMoments.js`**

```javascript
// ─── useMoments — photo journal with E2E encryption ───────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { photoCache } from '../lib/photoCache.js';
import { encryptText, decryptText, encryptBlob, decryptBlob } from '../lib/crypto.js';

async function decryptCaptions(rows, key) {
  if (!key) return rows.map((r) => ({ ...r, text: '' }));
  const out = [];
  for (const r of rows) {
    try {
      const text = r.caption_encrypted ? await decryptText(key, r.caption_encrypted) : '';
      out.push({ ...r, text });
    } catch {
      out.push({ ...r, text: '[decrypt error]' });
    }
  }
  return out;
}

export function useMoments() {
  const { userId, encryptionKey } = useAuth();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !encryptionKey) return;
    let active = true;
    (async () => {
      const cached = await cache.read('moments', userId);
      if (cached && active) {
        const decrypted = await decryptCaptions(cached, encryptionKey);
        setMoments(decrypted);
        setLoading(false);
      }
      const { data } = await supabase
        .from('moments').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data && active) {
        const decrypted = await decryptCaptions(data, encryptionKey);
        setMoments(decrypted);
        await cache.write('moments', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, encryptionKey]);

  const add = useCallback(async ({ dateLabel, caption, photoArrayBuffer }) => {
    if (!encryptionKey) throw new Error('no key');
    const captionCipher = await encryptText(encryptionKey, caption || '');

    // Generate the moment id client-side so we can use it in the Storage path.
    const id = crypto.randomUUID();
    let photoPath = null;

    if (photoArrayBuffer) {
      const encrypted = await encryptBlob(encryptionKey, photoArrayBuffer);
      photoPath = `${userId}/${id}.bin`;
      const { error: upErr } = await supabase.storage
        .from('moments').upload(photoPath, new Blob([encrypted]));
      if (upErr) throw upErr;
      // Cache the decrypted bytes so the just-uploaded photo renders without a refetch.
      await photoCache.put(userId, id, photoArrayBuffer);
    }

    const { data, error } = await supabase
      .from('moments').insert({
        id,
        user_id: userId,
        date_label: dateLabel || '',
        caption_encrypted: captionCipher,
        photo_storage_path: photoPath,
      }).select().single();
    if (error) throw error;

    setMoments((prev) => [{ ...data, text: caption || '' }, ...prev]);
  }, [userId, encryptionKey]);

  const remove = useCallback(async (id) => {
    const current = moments.find((m) => m.id === id);
    setMoments((prev) => prev.filter((m) => m.id !== id));
    if (current?.photo_storage_path) {
      await supabase.storage.from('moments').remove([current.photo_storage_path]);
    }
    const { error } = await supabase.from('moments').delete().eq('id', id);
    if (error) throw error;
  }, [moments]);

  const getPhoto = useCallback(async (momentId) => {
    if (!encryptionKey) return null;
    const cached = await photoCache.getPhoto(userId, momentId);
    if (cached) return cached;
    const moment = moments.find((m) => m.id === momentId);
    if (!moment?.photo_storage_path) return null;
    const { data, error } = await supabase.storage
      .from('moments').download(moment.photo_storage_path);
    if (error || !data) return null;
    const encrypted = await data.arrayBuffer();
    const decrypted = await decryptBlob(encryptionKey, encrypted);
    await photoCache.put(userId, momentId, decrypted);
    return decrypted;
  }, [moments, userId, encryptionKey]);

  return { moments, loading, add, remove, getPhoto };
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/hooks/useMoments.js
git commit -m "Add useMoments hook with E2E captions + photo encryption"
```

---

## Task 19: SigninScreen + SignupScreen + HardshipRequestModal

**Files:**
- Create: `src/components/SigninScreen.jsx`
- Create: `src/components/SignupScreen.jsx`
- Create: `src/components/HardshipRequestModal.jsx`

These three components ship together because they share a visual frame and link to each other from one auth surface.

- [ ] **Step 1: Create `src/components/SigninScreen.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import HardshipRequestModal from './HardshipRequestModal.jsx';

export default function SigninScreen({ onShowSignup, onShowReset }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHardship, setShowHardship] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-12"
        style={{ fontWeight: 400 }}>MAISON</h1>

      <form onSubmit={submit} className="space-y-5 mb-8">
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        {error && (
          <p className="font-display rose-deep text-[12px] italic">{error}</p>
        )}
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Sign in →'}
        </button>
      </form>

      <div className="space-y-3 text-center">
        <button onClick={onShowReset} className="muted text-[12px] font-body italic font-display nav-btn block w-full">
          Forgot password?
        </button>
        <button onClick={onShowSignup} className="font-display ink text-[13px] nav-btn block w-full">
          New here? <span className="rose-deep">Create an account →</span>
        </button>
        <button onClick={() => setShowHardship(true)} className="muted text-[11px] font-body italic font-display nav-btn block w-full">
          Request Access
        </button>
      </div>

      <HardshipRequestModal open={showHardship} onClose={() => setShowHardship(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/SignupScreen.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function SignupScreen({ onBackToSignin }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true); setError('');
    try {
      await signUp(email, password);
      // signUp transitions status → 'onboarding'; App.jsx will route us.
    } catch (err) {
      setError(err.message || 'Sign up failed.');
      setBusy(false);
    }
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-3"
        style={{ fontWeight: 400 }}>MAISON</h1>
      <p className="muted text-[12px] font-body italic font-display text-center mb-10">
        A calm place for the work of the home.
      </p>

      <form onSubmit={submit} className="space-y-5 mb-8">
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
          <p className="muted text-[10px] font-body italic font-display mt-1">At least 8 characters.</p>
        </div>
        {error && (
          <p className="font-display rose-deep text-[12px] italic">{error}</p>
        )}
        <p className="muted text-[10px] font-body italic font-display">
          By signing up you agree to our terms.
        </p>
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Create account →'}
        </button>
      </form>

      <button onClick={onBackToSignin} className="muted text-[12px] font-body italic font-display nav-btn text-center w-full">
        ← Back to sign in
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/HardshipRequestModal.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function HardshipRequestModal({ open, onClose }) {
  const { requestHardship } = useAuth();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await requestHardship(email, reason);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not submit. Try again.');
    }
    setBusy(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)' }}>
      <div className="flex items-center justify-between px-7 pt-5 pb-3">
        <button onClick={onClose} className="muted text-[14px] nav-btn" aria-label="Close">×</button>
        <span className="font-display rose text-[10px] tracking-[0.32em] uppercase" style={{ fontWeight: 500 }}>REQUEST ACCESS</span>
        <div style={{ width: '14px' }} />
      </div>
      <div className="mx-8 border-t hairline" />
      <div className="overflow-y-auto flex-1 px-7 pt-8 pb-10">
        {submitted ? (
          <div>
            <h1 className="font-display ink leading-tight mb-4" style={{ fontWeight: 400, fontSize: '24px', fontStyle: 'italic' }}>
              Thank you.
            </h1>
            <p className="font-display ink text-[15px] leading-relaxed mb-8">
              We read each request personally. Most replies come within a few days.
            </p>
            <button onClick={onClose} className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>Close →</button>
          </div>
        ) : (
          <>
            <p className="font-display ink text-[15px] leading-relaxed mb-6">
              Maison is free for anyone in genuine crisis. No proof, no shame. Tell us where to reach you.
            </p>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="edit-input ink text-[14px] font-body w-full" />
              </div>
              <div>
                <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Anything you'd like us to know (optional)</label>
                <textarea rows="4" value={reason} onChange={(e) => setReason(e.target.value)}
                  className="edit-input ink text-[14px] font-body w-full" />
              </div>
              {error && (
                <p className="font-display rose-deep text-[12px] italic">{error}</p>
              )}
              <button type="submit" disabled={busy}
                className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
                {busy ? '…' : 'Submit →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/components/SigninScreen.jsx src/components/SignupScreen.jsx src/components/HardshipRequestModal.jsx
git commit -m "Add SigninScreen, SignupScreen, and HardshipRequestModal"
```

---

## Task 20: PasswordResetScreen

**Files:**
- Create: `src/components/PasswordResetScreen.jsx`

- [ ] **Step 1: Create `src/components/PasswordResetScreen.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function PasswordResetScreen({ onBack }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    }
    setBusy(false);
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-10"
        style={{ fontWeight: 400 }}>MAISON</h1>

      {sent ? (
        <div className="text-center">
          <p className="font-display ink text-[15px] leading-relaxed mb-8">
            We sent a reset link to <strong>{email}</strong>.
          </p>
          <p className="muted text-[12px] font-body italic font-display mb-8 leading-relaxed">
            Resetting your password will make your existing Moments and Quick Notes unreadable. They use a key that only your old password could unlock. You'll be able to start fresh after reset.
          </p>
          <button onClick={onBack} className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn">
            ← Back to sign in
          </button>
        </div>
      ) : (
        <>
          <p className="muted text-[12px] font-body italic font-display mb-8 text-center">
            We'll send a reset link to your email.
          </p>
          <form onSubmit={submit} className="space-y-5 mb-6">
            <div>
              <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="edit-input ink text-[14px] font-body w-full" />
            </div>
            {error && (
              <p className="font-display rose-deep text-[12px] italic">{error}</p>
            )}
            <button type="submit" disabled={busy}
              className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
              {busy ? '…' : 'Send reset link →'}
            </button>
          </form>
          <button onClick={onBack} className="muted text-[12px] font-body italic font-display nav-btn text-center w-full">
            ← Back to sign in
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/components/PasswordResetScreen.jsx
git commit -m "Add PasswordResetScreen"
```

---

## Task 21: OnboardingFlow

**Files:**
- Create: `src/components/OnboardingFlow.jsx`

This is the 3-screen onboarding (name → kids → done) shown after signup when there's no existing local data.

- [ ] **Step 1: Create `src/components/OnboardingFlow.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useProfile } from '../hooks/useProfile.js';
import { useKids } from '../hooks/useKids.js';

export default function OnboardingFlow() {
  const { finishOnboarding } = useAuth();
  const [step, setStep] = useState(1);

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-12"
        style={{ fontWeight: 400 }}>MAISON</h1>
      {step === 1 && <NameStep onNext={() => setStep(2)} />}
      {step === 2 && <KidsStep onDone={finishOnboarding} />}
    </div>
  );
}

function NameStep({ onNext }) {
  const { update } = useProfile();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (name.trim()) await update({ greeting_name: name.trim() });
      onNext();
    } catch {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col">
      <p className="font-display ink text-[18px] leading-snug mb-8 italic">
        What should we call you?
      </p>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="edit-input ink text-[16px] font-body mb-8 w-full" autoFocus />
      <div className="flex gap-3 items-center">
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          Continue →
        </button>
      </div>
    </form>
  );
}

function KidsStep({ onDone }) {
  const { add } = useKids();
  const [draft, setDraft] = useState([{ name: '', birthday: '' }]);
  const [busy, setBusy] = useState(false);

  const updateDraft = (i, field, val) => {
    setDraft((p) => p.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)));
  };
  const addRow = () => setDraft((p) => [...p, { name: '', birthday: '' }]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const valid = draft.filter((d) => d.name.trim());
      for (let i = 0; i < valid.length; i++) {
        await add({ name: valid[i].name.trim(), birthday: valid[i].birthday || null, position: i });
      }
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col">
      <p className="font-display ink text-[18px] leading-snug mb-2 italic">
        Who do you tend to?
      </p>
      <p className="muted text-[12px] font-body italic font-display mb-8">
        Add as many as you'd like. You can come back to this later.
      </p>
      <div className="space-y-5 mb-6">
        {draft.map((d, i) => (
          <div key={i} className="space-y-2">
            <input type="text" placeholder="Name"
              value={d.name} onChange={(e) => updateDraft(i, 'name', e.target.value)}
              className="edit-input ink text-[15px] font-body w-full" />
            <input type="date" placeholder="Birthday"
              value={d.birthday} onChange={(e) => updateDraft(i, 'birthday', e.target.value)}
              className="edit-input ink text-[13px] font-body w-full" />
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        className="muted text-[11px] tracking-[0.18em] uppercase font-display rose-deep nav-btn self-start mb-8"
        style={{ fontWeight: 500 }}>
        + Add another
      </button>
      <div className="flex gap-3 items-center">
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Finish →'}
        </button>
        <button type="button" onClick={onDone}
          className="muted text-[12px] font-body italic font-display nav-btn">
          Skip
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/components/OnboardingFlow.jsx
git commit -m "Add OnboardingFlow — name and kids steps"
```

---

## Task 22: ReviewPendingScreen + TrialEndedBanner

**Files:**
- Create: `src/components/ReviewPendingScreen.jsx`
- Create: `src/components/TrialEndedBanner.jsx`

- [ ] **Step 1: Create `src/components/ReviewPendingScreen.jsx`**

```jsx
import { useAuth } from '../lib/auth.jsx';

export default function ReviewPendingScreen() {
  const { signOut } = useAuth();
  return (
    <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] mb-10"
        style={{ fontWeight: 400 }}>MAISON</h1>
      <h2 className="font-display ink text-[24px] leading-tight italic mb-4" style={{ fontWeight: 400 }}>
        Your access request is being reviewed.
      </h2>
      <p className="font-display ink text-[15px] leading-relaxed mb-10" style={{ maxWidth: '320px' }}>
        We read each one personally. Most replies come within a few days. Thank you for your patience.
      </p>
      <button onClick={signOut}
        className="muted text-[12px] font-body italic font-display nav-btn">
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/TrialEndedBanner.jsx`**

```jsx
import { useState } from 'react';

export default function TrialEndedBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  if (dismissed) return null;

  return (
    <>
      <div className="mx-5 mt-3 mb-2 cream-card rounded-2xl p-4 border-soft fade-in flex items-center justify-between gap-3">
        <p className="font-display ink text-[13px] leading-snug italic flex-1" style={{ fontWeight: 400 }}>
          Your trial has quietly ended. Subscribe to keep what you've kept.
        </p>
        <button onClick={() => setShowModal(true)}
          className="font-display rose-deep text-[10px] tracking-[0.2em] uppercase nav-btn whitespace-nowrap"
          style={{ fontWeight: 500 }}>
          Subscribe →
        </button>
        <button onClick={() => setDismissed(true)} className="muted text-[14px] nav-btn" aria-label="Dismiss">×</button>
      </div>
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-7"
          style={{ background: 'rgba(20,20,20,0.4)' }}>
          <div className="cream-card rounded-2xl p-6 border-soft text-center" style={{ maxWidth: '320px' }}>
            <p className="font-display ink text-[15px] leading-relaxed italic mb-6" style={{ fontWeight: 400 }}>
              Subscriptions arrive with the iOS app. Soon.
            </p>
            <button onClick={() => setShowModal(false)}
              className="font-display rose-deep text-[10px] tracking-[0.2em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/ReviewPendingScreen.jsx src/components/TrialEndedBanner.jsx
git commit -m "Add ReviewPendingScreen and TrialEndedBanner"
```

---

## Task 23: AccountSettings (embedded in SettingsModal)

**Files:**
- Create: `src/components/AccountSettings.jsx`
- Modify: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Create `src/components/AccountSettings.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function AccountSettings() {
  const { profile, signOut, deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const onDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true); setError('');
    try {
      await deleteAccount();
      // signs out + redirects
    } catch (err) {
      setError(err.message || 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Account</span>
        {profile?.is_founding_member && (
          <span className="font-display rose-deep text-[10px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
            ✦ Founding member
          </span>
        )}
      </div>
      <div className="space-y-2">
        <button onClick={signOut} className="font-display rose-deep text-[11px] tracking-[0.18em] uppercase nav-btn">
          Sign out
        </button>
      </div>
      <div className="border-t hairline pt-4 mt-2">
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)}
            className="muted text-[11px] font-body italic font-display nav-btn">
            Delete account…
          </button>
        ) : (
          <div className="space-y-3">
            <p className="font-display ink text-[13px] italic leading-snug">
              This removes your account and all of your data. There is no undo.
            </p>
            <p className="muted text-[11px] font-body italic font-display">
              Type DELETE to confirm:
            </p>
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="edit-input ink text-[14px] font-body w-full" />
            {error && (
              <p className="font-display rose-deep text-[11px] italic">{error}</p>
            )}
            <div className="flex gap-3">
              <button onClick={onDelete} disabled={confirmText !== 'DELETE' || deleting}
                className="font-display rose-deep text-[10px] tracking-[0.18em] uppercase nav-btn"
                style={{ fontWeight: 500, opacity: confirmText !== 'DELETE' ? 0.3 : 1 }}>
                {deleting ? '…' : 'Permanently delete'}
              </button>
              <button onClick={() => { setShowDelete(false); setConfirmText(''); }}
                className="muted text-[10px] font-body italic font-display nav-btn">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Read the current `src/components/SettingsModal.jsx` to find a sensible insertion point**

```bash
cat /Users/taylor/Code/maison-home/src/components/SettingsModal.jsx
```

The component renders the calendar URL input and a "Clear all data" button. Add an `<AccountSettings />` section above the "Clear all data" section (or below the calendar input — pick the location that reads as account-y rather than data-y).

- [ ] **Step 3: Modify `src/components/SettingsModal.jsx`**

Add the import at the top:
```jsx
import AccountSettings from './AccountSettings.jsx';
```

In the modal body, add a section before the existing "Clear all data" / final block:
```jsx
<div className="border-t hairline pt-6 mt-6">
  <AccountSettings />
</div>
```

(The exact placement depends on the current file structure. Put it as a sibling to the calendar URL block, inside the same scroll area, separated by `border-t hairline`.)

- [ ] **Step 4: Build + run tests**

```bash
npm run build
npm test
```
Expected: clean build. SettingsModal tests may fail if they assert on specific layout — update assertions if needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountSettings.jsx src/components/SettingsModal.jsx
# Add modified test file if updated:
# git add src/components/SettingsModal.test.jsx
git commit -m "Add AccountSettings with sign out and delete account"
```

---

## Task 24: Migration logic (TDD on detection, integration test on import)

**Files:**
- Create: `src/lib/migrate.js`
- Create: `src/lib/migrate.test.js`

- [ ] **Step 1: Write the failing test for detection**

Create `src/lib/migrate.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { hasLocalData } from './migrate.js';

beforeEach(() => {
  localStorage.clear();
});

describe('hasLocalData', () => {
  it('returns false when no localStorage keys exist', () => {
    expect(hasLocalData()).toBe(false);
  });

  it('returns false when only maison.imported_to_cloud is set', () => {
    localStorage.setItem('maison.imported_to_cloud', '1');
    expect(hasLocalData()).toBe(false);
  });

  it('returns true when any tracked key has non-trivial content', () => {
    localStorage.setItem('maison.daily', JSON.stringify({ day: [{ id: 1, label: 'a', done: false }], night: [] }));
    expect(hasLocalData()).toBe(true);
  });

  it('ignores empty array values', () => {
    localStorage.setItem('maison.notes', JSON.stringify([]));
    expect(hasLocalData()).toBe(false);
  });

  it('ignores the streak key (legacy)', () => {
    localStorage.setItem('maison.streak', JSON.stringify({ current: 5 }));
    expect(hasLocalData()).toBe(false);
  });

  it('detects girls data', () => {
    localStorage.setItem('maison.girls', JSON.stringify([{ id: 1, name: 'Mary' }]));
    expect(hasLocalData()).toBe(true);
  });

  it('detects calendar URL inside settings', () => {
    localStorage.setItem('maison.settings', JSON.stringify({ calendarUrl: 'https://example.com/ical' }));
    expect(hasLocalData()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- migrate
```
Expected: FAIL with "Failed to load url ./migrate.js".

- [ ] **Step 3: Create `src/lib/migrate.js`**

```javascript
// ─── Migration — local PWA data → cloud account ──────────────────
// One-time, opt-in (with sensible default). Runs after a fresh signup
// when localStorage has any tracked content.

import { supabase } from './supabase.js';
import { encryptText, encryptBlob } from './crypto.js';

const LS_PREFIX = 'maison.';
const IMPORTED_FLAG = 'maison.imported_to_cloud';

const TRACKED_KEYS = [
  'daily', 'weekly', 'meals', 'groceries', 'toBuy',
  'notes', 'girls', 'household', 'sitterNotes', 'moments',
  'settings', 'lastDailyResetDate', 'lastWeeklyResetDate',
];

function isNonTrivial(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function lsGetRaw(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

export function hasLocalData() {
  if (localStorage.getItem(IMPORTED_FLAG)) return false;
  for (const key of TRACKED_KEYS) {
    const v = lsGetRaw(key);
    if (isNonTrivial(v)) return true;
  }
  return false;
}

// Open legacy IndexedDB for photos. (Same db/store as the deleted storage.js.)
async function openLegacyPhotos() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('maison', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getLegacyPhoto(photoId) {
  try {
    const db = await openLegacyPhotos();
    return new Promise((resolve) => {
      const tx = db.transaction('photos', 'readonly');
      const req = tx.objectStore('photos').get(photoId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Main importer. Throws on first table that fails so caller can surface and offer retry.
export async function importLocalData(userId, encryptionKey) {
  // ─ profile fields (sitter_notes, calendar_url, last reset dates, greeting_name) ─
  const settings = lsGetRaw('settings') || {};
  const sitterNotes = lsGetRaw('sitterNotes');
  const lastDaily = lsGetRaw('lastDailyResetDate');
  const lastWeekly = lsGetRaw('lastWeeklyResetDate');
  const profilePatch = {};
  if (settings.calendarUrl) profilePatch.calendar_url = settings.calendarUrl;
  if (typeof sitterNotes === 'string' && sitterNotes.trim()) profilePatch.sitter_notes = sitterNotes;
  if (typeof lastDaily === 'string') profilePatch.last_daily_reset_date = lastDaily;
  if (typeof lastWeekly === 'string') profilePatch.last_weekly_reset_date = lastWeekly;
  if (Object.keys(profilePatch).length) {
    const { error } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
    if (error) throw new Error(`profile: ${error.message}`);
  }

  // ─ kids ─
  const girls = lsGetRaw('girls') || [];
  if (girls.length) {
    // Delete the seeded-empty default? No — seed function doesn't create empty kid rows. Safe to insert.
    const rows = girls.map((g, i) => ({
      user_id: userId, position: i,
      name: g.name || '',
      birthday: g.birthday || null,
      clothes_size: g.clothes || null,
      shoe_size: g.shoe || null,
      diaper_size: g.diaper || null,
      allergies: g.allergies || null,
    }));
    const { error } = await supabase.from('kids').insert(rows);
    if (error) throw new Error(`kids: ${error.message}`);
  }

  // ─ household_items (replace seeded defaults) ─
  const household = lsGetRaw('household') || [];
  if (household.length) {
    await supabase.from('household_items').delete().eq('user_id', userId);
    const rows = household.map((h, i) => ({
      user_id: userId, position: i, label: h.key || '', value: h.value || '',
    }));
    const { error } = await supabase.from('household_items').insert(rows);
    if (error) throw new Error(`household_items: ${error.message}`);
  }

  // ─ daily_tasks (replace seeded defaults) ─
  const daily = lsGetRaw('daily');
  if (daily && (daily.day?.length || daily.night?.length)) {
    await supabase.from('daily_tasks').delete().eq('user_id', userId);
    const rows = [];
    (daily.day || []).forEach((t, i) => rows.push({
      user_id: userId, slot: 'day', position: i, label: t.label || '', done: !!t.done,
    }));
    (daily.night || []).forEach((t, i) => rows.push({
      user_id: userId, slot: 'night', position: i, label: t.label || '', done: !!t.done,
    }));
    if (rows.length) {
      const { error } = await supabase.from('daily_tasks').insert(rows);
      if (error) throw new Error(`daily_tasks: ${error.message}`);
    }
  }

  // ─ weekly_tasks (replace seeded defaults) ─
  const weekly = lsGetRaw('weekly');
  if (Array.isArray(weekly) && weekly.length) {
    await supabase.from('weekly_tasks').delete().eq('user_id', userId);
    const rows = weekly.map((t, i) => ({
      user_id: userId, position: i, label: t.label || '', done: !!t.done,
    }));
    const { error } = await supabase.from('weekly_tasks').insert(rows);
    if (error) throw new Error(`weekly_tasks: ${error.message}`);
  }

  // ─ meals (UPSERT each cell) ─
  const meals = lsGetRaw('meals');
  if (meals && typeof meals === 'object') {
    const rows = [];
    for (const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) {
      const m = meals[day] || {};
      for (const slot of ['L', 'D']) {
        if (m[slot] !== undefined) {
          rows.push({ user_id: userId, day, slot, text: m[slot] || '' });
        }
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('meals').upsert(rows, { onConflict: 'user_id,day,slot' });
      if (error) throw new Error(`meals: ${error.message}`);
    }
  }

  // ─ list_items (groceries + toBuy) ─
  const groceries = lsGetRaw('groceries') || [];
  const toBuy = lsGetRaw('toBuy') || [];
  const listRows = [];
  groceries.forEach((g, i) => listRows.push({
    user_id: userId, list: 'grocery', position: i, item: g.item || '', got: !!g.got,
  }));
  toBuy.forEach((t, i) => listRows.push({
    user_id: userId, list: 'tobuy', position: i, item: t.item || '', got: !!t.got,
  }));
  if (listRows.length) {
    const { error } = await supabase.from('list_items').insert(listRows);
    if (error) throw new Error(`list_items: ${error.message}`);
  }

  // ─ notes (encrypt) ─
  const notes = lsGetRaw('notes') || [];
  if (notes.length) {
    const rows = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const cipher = await encryptText(encryptionKey, n.text || '');
      rows.push({
        user_id: userId, position: i, text_encrypted: cipher, done: !!n.done,
      });
    }
    const { error } = await supabase.from('notes').insert(rows);
    if (error) throw new Error(`notes: ${error.message}`);
  }

  // ─ moments (encrypt caption + photo, upload, insert) ─
  const moments = lsGetRaw('moments') || [];
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    const newId = crypto.randomUUID();
    const captionCipher = await encryptText(encryptionKey, m.text || '');
    let photoPath = null;

    if (m.photoId) {
      const dataUrl = await getLegacyPhoto(m.photoId);
      if (dataUrl) {
        const buffer = dataUrlToArrayBuffer(dataUrl);
        const encrypted = await encryptBlob(encryptionKey, buffer);
        photoPath = `${userId}/${newId}.bin`;
        const { error: upErr } = await supabase.storage
          .from('moments').upload(photoPath, new Blob([encrypted]));
        if (upErr) throw new Error(`moments storage (${m.photoId}): ${upErr.message}`);
      }
    }

    const { error } = await supabase.from('moments').insert({
      id: newId, user_id: userId, date_label: m.date || '',
      caption_encrypted: captionCipher, photo_storage_path: photoPath,
    });
    if (error) throw new Error(`moments: ${error.message}`);
  }

  // ─ Mark complete ─
  localStorage.setItem(IMPORTED_FLAG, '1');
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- migrate
```
Expected: hasLocalData tests PASS. (importLocalData is not unit-tested — it needs a live Supabase; covered by smoke test in Task 32.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrate.js src/lib/migrate.test.js
git commit -m "Add migration — local PWA data to cloud account"
```

---

## Task 25: App.jsx rewiring — wrap in AuthProvider and add status-based routing

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

This is the heaviest single task in the plan. After this, App.jsx no longer uses `usePersistedState`. Hooks supply every persisted value.

- [ ] **Step 1: Modify `src/main.jsx` to wrap in AuthProvider**

Find the current entry point. The file currently mounts `<App />`. Wrap it:

```jsx
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './lib/auth.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

(Adjust to match whatever the existing main.jsx looks like; just ensure `<App />` is wrapped in `<AuthProvider>`.)

- [ ] **Step 2: Replace `src/App.jsx` with the new version**

This is a major rewrite of App.jsx. The new file routes by `useAuth().status` and consumes data via hooks. The Today/Tidy/Kitchen/Girls/Moments tabs are all converted.

Because this is a large file, here's the new full content of `src/App.jsx`:

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';

import { useAuth } from './lib/auth.jsx';
import { useProfile } from './hooks/useProfile.js';
import { useKids } from './hooks/useKids.js';
import { useHouseholdItems } from './hooks/useHouseholdItems.js';
import { useDailyTasks } from './hooks/useDailyTasks.js';
import { useWeeklyTasks } from './hooks/useWeeklyTasks.js';
import { useMeals } from './hooks/useMeals.js';
import { useListItems } from './hooks/useListItems.js';
import { useNotes } from './hooks/useNotes.js';
import { useMoments } from './hooks/useMoments.js';

import { calcAge, nextBirthday, shortDate, todayLabel, relativeLabel, timeLabel } from './lib/dates.js';
import { upcomingEvents } from './lib/ics.js';
import { buildMomentSVG, getImageDims, shareOrDownload } from './lib/svg.js';
import { resetDaily, resetWeekly, shouldResetDaily, shouldResetWeekly, isSeventhDay } from './lib/rollover.js';
import { essayOfWeek } from './data/keep.js';
import { hasLocalData, importLocalData } from './lib/migrate.js';

import { Checkbox, EditToggle, SectionHead, Styles } from './components/Components.jsx';
import WelcomeOverlay from './components/WelcomeOverlay.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SitterCardModal from './components/SitterCardModal.jsx';
import TidyTab from './components/TidyTab.jsx';
import KitchenTab from './components/KitchenTab.jsx';
import SeventhDay from './components/SeventhDay.jsx';
import KeepCallout from './components/KeepCallout.jsx';
import KeepReader from './components/KeepReader.jsx';
import SigninScreen from './components/SigninScreen.jsx';
import SignupScreen from './components/SignupScreen.jsx';
import PasswordResetScreen from './components/PasswordResetScreen.jsx';
import OnboardingFlow from './components/OnboardingFlow.jsx';
import ReviewPendingScreen from './components/ReviewPendingScreen.jsx';
import TrialEndedBanner from './components/TrialEndedBanner.jsx';

function todaysWorkLine(hour = new Date().getHours()) {
  if (hour < 11) return 'A morning to begin gently.';
  if (hour < 14) return 'The middle of a day, held.';
  if (hour < 18) return 'An afternoon, kept as it is.';
  if (hour < 21) return 'An evening softening down.';
  return 'A late hour. Be kind to it.';
}

export default function App() {
  const { status, effectiveStatus } = useAuth();
  const [authView, setAuthView] = useState('signin'); // signin | signup | reset

  return (
    <div className="min-h-screen w-full flex items-start justify-center py-6 px-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #F4E0D2 0%, #E5C9B5 55%, #D2A88F 100%)',
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}>
      <Styles />
      <div className="relative cream-bg rounded-[36px] app-shadow overflow-hidden w-full flex flex-col"
        style={{ maxWidth: '420px', minHeight: '780px' }}>

        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="muted text-[12px] font-body italic font-display">…</p>
          </div>
        )}

        {status === 'signed_out' && authView === 'signin' && (
          <SigninScreen onShowSignup={() => setAuthView('signup')} onShowReset={() => setAuthView('reset')} />
        )}
        {status === 'signed_out' && authView === 'signup' && (
          <SignupScreen onBackToSignin={() => setAuthView('signin')} />
        )}
        {status === 'signed_out' && authView === 'reset' && (
          <PasswordResetScreen onBack={() => setAuthView('signin')} />
        )}

        {status === 'onboarding' && <PostSignupRouter />}

        {status === 'authenticated' && effectiveStatus === 'hardship_pending' && (
          <ReviewPendingScreen />
        )}

        {status === 'authenticated' && effectiveStatus !== 'hardship_pending' && (
          <MainApp />
        )}
      </div>
    </div>
  );
}

// ─── After signup, decide between auto-import and standard onboarding ──
function PostSignupRouter() {
  const { userId, encryptionKey, finishOnboarding } = useAuth();
  const [decided, setDecided] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (decided) return;
    if (!userId || !encryptionKey) return;
    if (hasLocalData()) {
      setImporting(true);
      importLocalData(userId, encryptionKey)
        .then(() => { setImporting(false); finishOnboarding(); })
        .catch((err) => { setImporting(false); setImportError(err.message || 'Import failed'); });
    }
    setDecided(true);
  }, [decided, userId, encryptionKey, finishOnboarding]);

  if (importing) {
    return (
      <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
        <p className="font-display ink text-[16px] italic">Bringing your data with you…</p>
      </div>
    );
  }
  if (importError) {
    return (
      <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
        <p className="font-display ink text-[15px] italic mb-6">Import had a problem: {importError}</p>
        <button onClick={() => { setDecided(false); setImportError(''); }}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500 }}>Try again</button>
      </div>
    );
  }
  return <OnboardingFlow />;
}

// ─── Main app (signed-in, non-pending) ────────────────────────────
function MainApp() {
  const { effectiveStatus } = useAuth();
  const profileHook = useProfile();
  const { profile } = profileHook;
  const kidsHook = useKids();
  const { kids } = kidsHook;
  const householdHook = useHouseholdItems();
  const { items: household } = householdHook;
  const dailyHook = useDailyTasks();
  const weeklyHook = useWeeklyTasks();
  const mealsHook = useMeals();
  const groceriesHook = useListItems('grocery');
  const toBuyHook = useListItems('tobuy');
  const notesHook = useNotes();
  const momentsHook = useMoments();
  const { signOut } = useAuth();

  const [activeNav, setActiveNav] = useState('Today');
  const [greeting, setGreeting] = useState('Good morning');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSitterCard, setShowSitterCard] = useState(false);
  const [keepReaderOpen, setKeepReaderOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState('idle');
  const [newNote, setNewNote] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingGroceries, setEditingGroceries] = useState(false);
  const [editingToBuy, setEditingToBuy] = useState(false);
  const [editingGirl, setEditingGirl] = useState(null);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [editingSitter, setEditingSitter] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [shareMomentStatus, setShareMomentStatus] = useState({});
  const [photoCacheState, setPhotoCacheState] = useState({});

  const currentEssay = essayOfWeek();

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Day rollover effect — runs once after profile loads.
  // Uses resetAll() on the daily and weekly hooks to bulk-clear done flags.
  const [rolloverChecked, setRolloverChecked] = useState(false);
  useEffect(() => {
    if (!profile || rolloverChecked) return;
    if (dailyHook.loading || weeklyHook.loading) return; // wait for hooks to load first
    setRolloverChecked(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    (async () => {
      // Daily reset
      if (!profile.last_daily_reset_date) {
        await profileHook.update({ last_daily_reset_date: todayStr });
      } else if (shouldResetDaily(profile.last_daily_reset_date, today)) {
        await dailyHook.resetAll();
        await profileHook.update({ last_daily_reset_date: todayStr });
      }
      // Weekly reset
      if (!profile.last_weekly_reset_date) {
        await profileHook.update({ last_weekly_reset_date: todayStr });
      } else if (shouldResetWeekly(profile.last_weekly_reset_date, today)) {
        await weeklyHook.resetAll();
        await profileHook.update({ last_weekly_reset_date: todayStr });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dailyHook.loading, weeklyHook.loading, rolloverChecked]);

  // Calendar fetch
  const fetchCalendar = useCallback(async () => {
    if (!profile?.calendar_url) {
      setCalendarStatus('unset');
      setCalendarEvents([]);
      return;
    }
    setCalendarStatus('loading');
    try {
      const res = await fetch(`/api/calendar?url=${encodeURIComponent(profile.calendar_url)}`);
      if (!res.ok) throw new Error('Calendar fetch failed: ' + res.status);
      const text = await res.text();
      const events = upcomingEvents(text, { limit: 5 });
      setCalendarEvents(events);
      setCalendarStatus('ok');
    } catch (err) {
      console.error('Calendar error:', err);
      setCalendarStatus('error');
    }
  }, [profile?.calendar_url]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // Photo loading for visible moments
  useEffect(() => {
    const idsNeeded = momentsHook.moments
      .filter((m) => m.photo_storage_path && !photoCacheState[m.id])
      .map((m) => m.id);
    if (idsNeeded.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const id of idsNeeded) {
        try {
          const buf = await momentsHook.getPhoto(id);
          if (buf) {
            const blob = new Blob([buf]);
            updates[id] = URL.createObjectURL(blob);
          }
        } catch (err) { console.error('getPhoto failed', id, err); }
      }
      if (!cancelled && Object.keys(updates).length) {
        setPhotoCacheState((p) => ({ ...p, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [momentsHook.moments]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    await notesHook.add(newNote);
    setNewNote('');
  };

  const onPhotoPick = async (e) => {
    const files = Array.from(e.target.files || []);
    const staged = await Promise.all(
      files.map((f) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          tempId: Date.now() + Math.random(),
          file: f,
          dataUrl: reader.result,
          date: shortDate(new Date(f.lastModified)),
          caption: '',
        });
        reader.readAsDataURL(f);
      }))
    );
    setPendingPhotos((p) => [...p, ...staged]);
    e.target.value = '';
  };
  const updatePending = (id, field, val) =>
    setPendingPhotos((p) => p.map((x) => (x.tempId === id ? { ...x, [field]: val } : x)));
  const cancelPending = (id) => setPendingPhotos((p) => p.filter((x) => x.tempId !== id));

  const saveAllPending = async () => {
    for (const p of pendingPhotos) {
      const buf = await p.file.arrayBuffer();
      await momentsHook.add({
        dateLabel: p.date, caption: p.caption, photoArrayBuffer: buf,
      });
    }
    setPendingPhotos([]);
  };

  const deleteMomentLocal = async (m) => {
    if (!confirm('Delete this moment?')) return;
    if (photoCacheState[m.id]) URL.revokeObjectURL(photoCacheState[m.id]);
    setPhotoCacheState((p) => { const x = { ...p }; delete x[m.id]; return x; });
    await momentsHook.remove(m.id);
  };

  const shareMoment = async (moment) => {
    setShareMomentStatus((p) => ({ ...p, [moment.id]: 'sharing' }));
    try {
      const objUrl = photoCacheState[moment.id];
      // For sharing, we need the raw image bytes — getPhoto returns ArrayBuffer.
      const buf = moment.photo_storage_path ? await momentsHook.getPhoto(moment.id) : null;
      const photoDataUrl = buf ? `data:image/jpeg;base64,${arrayBufferToBase64(buf)}` : null;
      const dims = await getImageDims(photoDataUrl);
      const svg = buildMomentSVG({ ...moment, text: moment.text, date: moment.date_label }, photoDataUrl, dims);
      const result = await shareOrDownload(svg, `moment-${moment.id}.png`, 'A moment from Maison');
      setShareMomentStatus((p) => ({ ...p, [moment.id]: result === 'cancelled' ? '' : 'done' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 1500);
    } catch (err) {
      console.error(err);
      setShareMomentStatus((p) => ({ ...p, [moment.id]: 'error' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 2000);
    }
  };

  // Convert ArrayBuffer to base64 (used by share)
  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  return (
    <>
      {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        profile={profile}
      />
      <SitterCardModal
        open={showSitterCard}
        onClose={() => setShowSitterCard(false)}
        girls={kids}
        household={household.map((h) => ({ key: h.label, value: h.value }))}
        sitterNotes={profile?.sitter_notes || ''}
      />
      <KeepReader open={keepReaderOpen} essay={currentEssay} onClose={() => setKeepReaderOpen(false)} />

      {/* HEADER */}
      {activeNav === 'Today' ? (
        <div key="t-header" className="pt-5 pb-4 fade-in flex items-center justify-between px-7">
          <button onClick={() => setShowSettings(true)} className="muted text-[14px] nav-btn" aria-label="Settings">⚙</button>
          <div className="text-center">
            <div className="font-display rose text-[22px]" style={{ fontWeight: 400, letterSpacing: '0.32em' }}>MAISON</div>
            <div className="muted text-[10px] tracking-[0.3em] uppercase mt-1.5">{todayLabel()}</div>
          </div>
          <div style={{ width: '14px' }} />
        </div>
      ) : (
        <div key={`h-${activeNav}`} className="pt-5 pb-4 px-7 fade-in flex items-baseline justify-between">
          <h2 className="font-display ink" style={{ fontWeight: 400, fontSize: '24px' }}>
            {activeNav === 'Girls' ? 'The Girls' :
             activeNav === 'Tidy'  ? 'The Keeping' : activeNav}
          </h2>
          <span className="font-display rose text-[10px] tracking-[0.32em]" style={{ fontWeight: 400 }}>MAISON</span>
        </div>
      )}

      <div className="mx-8 border-t hairline" />

      {(effectiveStatus === 'trial_expired' || effectiveStatus === 'cancelled') && <TrialEndedBanner />}

      <div className="scroll-area overflow-y-auto flex-1 pb-2" key={activeNav}>
        {activeNav === 'Today' && (isSeventhDay() ? (
          <SeventhDay moments={momentsHook.moments.map((m) => ({ id: m.id, date: m.date_label, text: m.text, photoId: m.id }))} photoCache={photoCacheState} />
        ) : (
          <>
            <div className="px-7 pt-7 pb-5 fade-in">
              <h1 className="font-display ink" style={{ fontWeight: 400, fontSize: '34px', lineHeight: 1.1 }}>
                {greeting},<br />
                <span className="font-display rose-deep" style={{ fontStyle: 'italic', fontWeight: 300 }}>
                  {profile?.greeting_name || 'friend'}
                </span>
              </h1>
            </div>

            {/* Calendar */}
            <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in">
              <div className="flex items-baseline justify-between">
                <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">On the Calendar</span>
                <button onClick={fetchCalendar} className="font-display rose text-[10px] tracking-[0.18em] uppercase nav-btn" style={{ fontWeight: 500 }}>
                  {calendarStatus === 'loading' ? '…' : '↻'}
                </button>
              </div>
              <div className="space-y-3.5 mt-4">
                {calendarStatus === 'unset' && (
                  <button onClick={() => setShowSettings(true)} className="text-left w-full">
                    <p className="muted text-[13px] font-body italic font-display">Connect a calendar in settings to see what's coming.</p>
                  </button>
                )}
                {calendarStatus === 'error' && (
                  <p className="muted text-[12px] font-body italic">Couldn't reach the calendar. Try again, or check settings.</p>
                )}
                {calendarStatus === 'loading' && calendarEvents.length === 0 && (
                  <p className="muted text-[12px] font-body italic">Loading…</p>
                )}
                {calendarStatus === 'ok' && calendarEvents.length === 0 && (
                  <p className="muted text-[12px] font-body italic">Nothing on the calendar.</p>
                )}
                {calendarEvents.map((e, i) => {
                  const when = relativeLabel(e.start);
                  const time = e.allDay ? '' : timeLabel(e.start);
                  return (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="font-display rose uppercase tracking-[0.16em] text-[10px]" style={{ fontWeight: 500, width: '78px' }}>{when}</span>
                      <span className="muted text-[11px] font-body" style={{ width: '52px' }}>{time}</span>
                      <span className="ink text-[14px] font-body flex-1">{e.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Notes */}
            <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in">
              <div className="flex items-baseline justify-between mb-4">
                <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Quick Notes</span>
                <EditToggle editing={editingNotes} onClick={() => setEditingNotes((v) => !v)} />
              </div>
              <div className="flex items-center gap-2 mb-4 pb-4 border-b hairline">
                <input type="text" placeholder="Hold this for me." value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNote()}
                  className="flex-1 bg-transparent outline-none ink text-[14px] font-body" />
                <button onClick={addNote} disabled={!newNote.trim()}
                  className="font-display rose-deep text-[11px] tracking-[0.18em] uppercase nav-btn"
                  style={{ fontWeight: 500, opacity: newNote.trim() ? 1 : 0.3 }}>Add</button>
              </div>
              <div className="space-y-3">
                {notesHook.notes.length === 0 && (
                  <p className="muted text-[12px] font-body italic font-display text-center py-2">Nothing pending. A quiet head.</p>
                )}
                {notesHook.notes.map((n) => (
                  <div key={n.id} className="flex items-center gap-3">
                    <button onClick={() => !editingNotes && notesHook.toggle(n.id)}>
                      <Checkbox done={n.done} />
                    </button>
                    {editingNotes ? (
                      <>
                        <input className="edit-input ink text-[14px] font-body flex-1" value={n.text}
                          onChange={(e) => notesHook.edit(n.id, e.target.value)} />
                        <button onClick={() => notesHook.remove(n.id)} className="muted text-base">×</button>
                      </>
                    ) : (
                      <span className={`text-[14px] font-body flex-1 ${n.done ? 'muted line-through' : 'ink'}`}>{n.text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Keep callout */}
            <KeepCallout essay={currentEssay} onOpen={() => setKeepReaderOpen(true)} />

            {/* Today's Work footer */}
            <div className="mx-7 mb-8 mt-2 pt-5 border-t hairline fade-in">
              <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">Today's Work</div>
              <p className="font-display ink text-[15px] leading-snug" style={{ fontStyle: 'italic', fontWeight: 400 }}>
                {todaysWorkLine()}
              </p>
            </div>
          </>
        ))}

        {activeNav === 'Tidy' && (
          <TidyTab
            daily={{ day: dailyHook.day, night: dailyHook.night }}
            dailyHook={dailyHook}
            weekly={weeklyHook.tasks}
            weeklyHook={weeklyHook}
            editingDaily={editingDaily} setEditingDaily={setEditingDaily}
            editingWeekly={editingWeekly} setEditingWeekly={setEditingWeekly}
          />
        )}

        {activeNav === 'Kitchen' && (
          <KitchenTab
            meals={mealsHook.meals} setMeal={mealsHook.setMeal}
            groceries={groceriesHook.items} groceriesHook={groceriesHook}
            toBuy={toBuyHook.items} toBuyHook={toBuyHook}
            editingDay={editingDay} setEditingDay={setEditingDay}
            editingGroceries={editingGroceries} setEditingGroceries={setEditingGroceries}
            editingToBuy={editingToBuy} setEditingToBuy={setEditingToBuy}
          />
        )}

        {activeNav === 'Girls' && (
          <div className="pt-6 px-5 pb-8">
            <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">The particulars. What a sitter or a grandparent might want to know.</p>
            <div className="space-y-4">
              {kids.map((g, i) => {
                const isEditing = editingGirl === g.id;
                const age = calcAge(g.birthday);
                const next = nextBirthday(g.birthday);
                return (
                  <div key={g.id} className="cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: `${0.05 + i * 0.08}s` }}>
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center font-display rose-deep"
                          style={{ background: 'rgba(184, 133, 123, 0.18)', fontWeight: 400, fontSize: '24px', fontStyle: 'italic' }}>
                          {(g.name || '?').charAt(0)}
                        </div>
                        <div>
                          {isEditing ? (
                            <input className="edit-input font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}
                              value={g.name} onChange={(e) => kidsHook.edit(g.id, { name: e.target.value })} />
                          ) : (
                            <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>{g.name}</div>
                          )}
                          <div className="muted text-[11px] tracking-[0.16em] uppercase font-body mt-0.5">{age}</div>
                        </div>
                      </div>
                      <EditToggle editing={isEditing} onClick={() => setEditingGirl(isEditing ? null : g.id)} />
                    </div>
                    {/* (Rest of the card per existing UX — reuses the existing labels/fields pattern from prior App.jsx) */}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeNav === 'Moments' && (
          <div className="pt-6 px-5 pb-8">
            <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed italic font-display">The ordinary, before it goes.</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPhotoPick} />
            <div className="flex gap-3 mb-6">
              <button onClick={() => fileInputRef.current?.click()}
                className="cream-card rounded-2xl px-5 py-4 border-soft flex-1 text-left flex items-center justify-between nav-btn">
                <span className="font-display ink" style={{ fontSize: '14px' }}>Today's Photos</span>
                <span className="rose text-[16px]">＋</span>
              </button>
            </div>
            {pendingPhotos.length > 0 && (
              <div className="cream-card rounded-2xl p-5 border-soft mb-6 fade-in">
                <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-4">A few words for each.</div>
                <div className="space-y-5">
                  {pendingPhotos.map((p) => (
                    <div key={p.tempId} className="flex gap-3">
                      <img src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-1" style={{ fontWeight: 500 }}>{p.date}</div>
                        <input className="edit-input ink text-[13px] font-body w-full" placeholder="What was this."
                          value={p.caption} onChange={(e) => updatePending(p.tempId, 'caption', e.target.value)} />
                      </div>
                      <button onClick={() => cancelPending(p.tempId)} className="muted text-base self-start">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-5">
                  <button onClick={saveAllPending} className="font-display rose-deep text-[12px] tracking-[0.18em] uppercase nav-btn" style={{ fontWeight: 500 }}>Save all →</button>
                </div>
              </div>
            )}
            {momentsHook.moments.length === 0 && pendingPhotos.length === 0 && (
              <p className="muted text-[12px] font-body italic font-display text-center mt-12">
                When something matters today, keep it here.
              </p>
            )}
            <div className="space-y-6">
              {momentsHook.moments.map((m, i) => {
                const shareState = shareMomentStatus[m.id] || '';
                const photoUrl = photoCacheState[m.id];
                return (
                  <div key={m.id} className="px-2 fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="font-display rose uppercase tracking-[0.2em] text-[9px]" style={{ fontWeight: 500 }}>{m.date_label}</span>
                      <div className="flex-1 border-t hairline" />
                      <button onClick={() => deleteMomentLocal(m)} className="muted text-[10px] nav-btn" aria-label="Delete">×</button>
                      <button onClick={() => shareMoment(m)} disabled={shareState === 'sharing'}
                        className="font-display rose tracking-[0.2em] uppercase text-[9px] nav-btn"
                        style={{ fontWeight: 500, opacity: shareState === 'sharing' ? 0.5 : 1 }}>
                        {shareState === 'done' ? '✓ Shared' : shareState === 'sharing' ? '...' : shareState === 'error' ? 'Try again' : '↗ Share'}
                      </button>
                    </div>
                    {photoUrl && (
                      <img src={photoUrl} alt="" className="w-full rounded-xl mb-3 object-cover" style={{ maxHeight: '280px', border: '1px solid rgba(184,133,123,0.18)' }} />
                    )}
                    {m.text && (
                      <p className="font-display ink leading-snug" style={{ fontWeight: 400, fontSize: '17px' }}>{m.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="cream-card border-t hairline px-2 pt-3 pb-5">
        <div className="flex justify-around items-center">
          {[
            { id: 'Today',   label: 'Today' },
            { id: 'Tidy',    label: 'The Keeping' },
            { id: 'Kitchen', label: 'Kitchen' },
            { id: 'Girls',   label: 'Girls' },
            { id: 'Moments', label: 'Moments' },
          ].map(({ id, label }) => {
            const active = id === activeNav;
            return (
              <button key={id} onClick={() => setActiveNav(id)} className="nav-btn flex flex-col items-center py-1 px-3">
                <div className="nav-dot mb-2" style={{ background: active ? '#B8857B' : 'transparent' }} />
                <span className="text-[9px] tracking-[0.18em] uppercase font-body"
                  style={{ color: active ? '#8B5A4F' : '#8E7B6E', fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
```

> **NOTE on the Girls tab:** The full per-card field editor (clothes/shoe/diaper/allergies, the birthday `next` banner, the "If You Need It" household section, and the Sitter Notes section) follows the same structure as before but with `kidsHook.edit(id, { field: value })` replacing the old `editGirl(id, field, value)`. **Reproduce the existing Girls-tab JSX from the prior commit, swapping the mutation calls for the new hook signatures.** This is the one place the plan defers to existing code rather than restating ~150 lines verbatim — the structure was just shipped in the prior plan and is unchanged in shape.

- [ ] **Step 3: Modify `src/components/TidyTab.jsx`** to accept the new hook objects

Current TidyTab uses `daily`, `setDaily`, `weekly`, `setWeekly`. The new version receives `daily` (already an `{day, night}` object), `dailyHook` (full hook object with mutations), `weekly` (the tasks array), `weeklyHook`.

Replace all `setDaily(prev => ...)` calls with the appropriate hook methods:
- Toggle a daily task: `dailyHook.toggle(slot, id)` instead of `setDaily(p => ({...p, [slot]: p[slot].map(t => t.id===id ? {...t, done: !t.done} : t)}))`
- Add daily task: `dailyHook.add(slot)`
- Edit daily task label: `dailyHook.edit(id, label)`
- Delete daily task: `dailyHook.remove(id)`

Same pattern for weekly via `weeklyHook`.

(Read the current TidyTab.jsx and apply these substitutions throughout. The render shape stays identical.)

- [ ] **Step 4: Modify `src/components/KitchenTab.jsx`** similarly

The new props are `meals` (the `{Sun: {L, D}, ...}` object), `setMeal(day, slot, text)`, `groceries`, `groceriesHook`, `toBuy`, `toBuyHook`, plus the existing editing state.

Replace mutations:
- Meal edit: `setMeal(day, slot, value)` instead of `setMeals(p => ...)`
- Grocery toggle/add/edit/remove: `groceriesHook.toggle/add/edit/remove`
- ToBuy toggle/add/edit/remove: `toBuyHook.toggle/add/edit/remove`

- [ ] **Step 5: Modify `src/components/SettingsModal.jsx`** to use `useProfile`

Replace any `settings.calendarUrl` reads with `profile?.calendar_url`. Replace writes through the existing `onSave(settings)` prop with `useProfile().update({ calendar_url: ... })`.

The "Clear all data" button is no longer meaningful (data lives in cloud). Replace with the `<AccountSettings />` block from Task 23 — already added there.

- [ ] **Step 6: Build and run tests**

```bash
npm run build
npm test
```

Expected: many tests will fail because of prop signature changes in tabs. Update test mocks/props to match the new hook-based shapes. Tests that look for specific strings should still pass (no copy changes).

This is the heaviest test-fixup task in the plan. Expect to spend a chunk of time here.

- [ ] **Step 7: Commit**

```bash
git add src/main.jsx src/App.jsx src/components/TidyTab.jsx src/components/KitchenTab.jsx \
        src/components/SettingsModal.jsx \
        src/components/TidyTab.test.jsx src/components/KitchenTab.test.jsx src/components/SettingsModal.test.jsx src/App.test.jsx
git commit -m "Wire App.jsx + tabs + Settings to AuthProvider and per-table hooks"
```

---

## Task 26: Delete `src/lib/storage.js`

**Files:**
- Delete: `src/lib/storage.js`
- Delete: `src/lib/storage.test.js`

After Task 25 wires everything to the new hooks, the legacy storage module has no production importers. The migration module opens its own IndexedDB connection (the legacy `maison` database) so it does not depend on `storage.js`.

- [ ] **Step 1: Confirm no live imports remain**

```bash
cd /Users/taylor/Code/maison-home
grep -rn "from '.*storage'" --include="*.js" --include="*.jsx" src/ | grep -v storage.test.js | grep -v "lib/storage.js"
```
Expected: zero output (only `storage.js` and `storage.test.js` reference it internally).

If any remaining imports exist, fix the consumers before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/storage.js src/lib/storage.test.js
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```
Expected: all remaining tests pass.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Delete legacy storage.js — replaced by cache + photoCache + hooks"
```

---

## Task 27: Final verification — full smoke test

**Files:**
- None modified.

End-to-end smoke. Tests every major flow.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 2: Run the build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 3: Start the dev server and walk through the flows**

```bash
npm run dev
```

In a browser (or printed URL), confirm:

**Auth surfaces:**
- Reset state: `localStorage.clear()` in the browser console. Reload.
- Sign-up screen renders cleanly. Email + password. Submit with a test email (use `+test1` etc. if reusing). Onboarding name + kids flow appears (no local data on a fresh state). Lands on Today tab.
- Today tab shows the greeting name and (possibly empty) calendar, Quick Notes input, Keep callout, Today's Work line, OR The Seventh Day if today is Sunday.
- Each tab opens (The Keeping, Kitchen, Girls, Moments).
- Add a Quick Note — appears immediately. Refresh — still there. (E2E encryption working transparently.)
- Add a Moment with a photo — encrypts and uploads; the moment appears with its photo.
- Settings → Sign out. Lands on signin screen.
- Sign in with the same email/password. Notes and Moments reappear (decrypted).

**Hardship request:**
- From signin: "Request Access" → modal → submit a hardship request. Inspect `hardship_requests` table in Supabase Studio; a row should exist.

**Trial-ended banner:**
- In Supabase Studio: `update profiles set trial_ends_at = now() - interval '1 day' where id = '<your-user-id>';`
- Reload the app. The trial-ended banner should appear above the tab content.
- Subscribe button → "Subscriptions arrive with the iOS app. Soon."

**E2E verification:**
- In Supabase Studio, inspect a `notes` row. The `text_encrypted` column should be base64-looking gibberish — NOT readable text.
- Inspect a `moments` row. Same for `caption_encrypted`.
- In the `moments` Storage bucket: download a `.bin` file. Open it. It is NOT a valid JPEG/PNG (encrypted blob).

**Account deletion:**
- Settings → Account → Delete account. Type DELETE. Confirm. Land on signin. Try to sign in — credentials are gone.

**Migration (only if you have an existing PWA install on the same browser profile):**
- Restore localStorage data from a backup or use a previously-installed PWA profile.
- Sign up with a NEW email. The app skips onboarding and runs auto-import. A short "Bringing your data with you…" line appears. Land on Today tab with imported data visible. Inspect cloud tables — rows are populated.

- [ ] **Step 4: Push (only if explicitly approved by user)**

```bash
git push origin <branch>
```

Do NOT push unless explicitly asked.

- [ ] **Step 5: Finalize**

Plan is complete. Hand off via the finishing-a-development-branch skill (merge / PR / keep / discard).

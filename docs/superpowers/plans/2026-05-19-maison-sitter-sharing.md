# Maison Sitter Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Send a live link" flow that lets the owner share a 12h, read-only, magic-link sitter view of their girls/household/notes/tonight-plan.

**Architecture:** New `share_links` table with owner-only RLS. Public Vercel serverless route `GET /api/share/sitter/[token]` reads via the Supabase service-role key. A standalone frontend page at `/share/sitter/:token` is mounted in `main.jsx` outside `<AuthProvider>` so visitors don't get stray anonymous accounts. The page is `fetch`-only; it never touches Supabase directly.

**Tech Stack:** Vite + React, Supabase (Postgres + RLS), Vercel Functions, vitest (+ jsdom for components), `@testing-library/react`, `@supabase/supabase-js` v2.

**Spec:** `docs/superpowers/specs/2026-05-19-maison-sitter-sharing-design.md` (commit `d7311ed`)

---

## File Map

**Create**
- `supabase/migrations/0002_share_links.sql` — DDL + RLS policies
- `supabase/checks/share_links_rls.sql` — hand-runnable RLS verification
- `api/_supabase.js` — service-role client helper
- `api/share/sitter/[token].js` — public read endpoint
- `api/share/sitter/[token].test.js` — endpoint test
- `src/lib/shareToken.js` — 256-bit token generator
- `src/lib/shareToken.test.js`
- `src/lib/route.js` — pathname → mode parser (shared by main.jsx + tests)
- `src/lib/route.test.js`
- `src/hooks/useShareLinks.js` — owner-side hook
- `src/hooks/useShareLinks.test.js`
- `src/components/SitterShareModal.jsx` — owner modal (create/edit/revoke flows)
- `src/components/SitterShareModal.test.jsx`
- `src/pages/SitterShareView.jsx` — public sitter page
- `src/pages/SitterShareView.test.jsx`

**Modify**
- `src/main.jsx` — branch on `route.parse(window.location.pathname)`: render `SitterShareView` without `<AuthProvider>` for share paths, existing tree otherwise
- `src/App.jsx` — Girls tab Sitter Card section gains "Send a live link →" button, active-link panel below it

**External setup (no commit)**
- Apply migration to remote Supabase project (`hgkvxogtehyjdhjfexow`)
- Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars (Production + Preview) and `.env.local` for local dev

---

## Task 1: Migration — `share_links` table and RLS

**Files:**
- Create: `supabase/migrations/0002_share_links.sql`

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/0002_share_links.sql`:

```sql
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
```

- [ ] **Step 2: Apply migration to remote Supabase**

Use the Supabase MCP tool `apply_migration` with project ref `hgkvxogtehyjdhjfexow` and the SQL above. Name the migration `share_links`.

Verify via the MCP `list_tables` tool that `public.share_links` exists with the expected columns.

- [ ] **Step 3: Sanity check the policies**

Via the Supabase SQL editor (or `execute_sql`), run:

```sql
select polname, polcmd from pg_policy where polrelid = 'public.share_links'::regclass;
```

Expected: four rows — `share_links owner select` (r), `share_links owner insert` (a), `share_links owner update` (w), `share_links owner delete` (d).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_share_links.sql
git commit -m "Add share_links migration — owner-only RLS"
```

---

## Task 2: RLS verification SQL snippet

**Files:**
- Create: `supabase/checks/share_links_rls.sql`

- [ ] **Step 1: Write the snippet**

Create `supabase/checks/share_links_rls.sql`:

```sql
-- Hand-runnable RLS check for share_links. Two assertions:
--   1. Anon role sees zero rows in share_links.
--   2. Authenticated user A sees zero of user B's rows.
--
-- Run in the Supabase SQL editor. Substitute REAL_USER_A_UUID /
-- REAL_USER_B_UUID with two real account IDs from the project.

-- ── Assertion 1 ──────────────────────────────────────────────────
-- Anon sees nothing
set local role anon;
select count(*) as anon_visible_rows from public.share_links;
-- expected: 0

reset role;

-- ── Assertion 2 ──────────────────────────────────────────────────
-- User A cannot see User B's rows
set local role authenticated;
set local request.jwt.claims = '{"sub":"REAL_USER_A_UUID","role":"authenticated"}';
select count(*) as user_a_visible_b_rows
from public.share_links
where owner_id = 'REAL_USER_B_UUID';
-- expected: 0

reset role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/checks/share_links_rls.sql
git commit -m "Add RLS verification snippet for share_links"
```

---

## Task 3: Token generation utility (TDD)

**Files:**
- Create: `src/lib/shareToken.js`
- Test: `src/lib/shareToken.test.js`

The token must be 256 bits of cryptographic randomness, base64url-encoded, URL-safe (`A-Z a-z 0-9 - _`), no padding, ~43 characters.

- [ ] **Step 1: Write failing test**

Create `src/lib/shareToken.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateShareToken } from './shareToken.js';

describe('generateShareToken', () => {
  it('produces a URL-safe string roughly 43 chars long', () => {
    const t = generateShareToken();
    expect(typeof t).toBe('string');
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(42);
    expect(t.length).toBeLessThanOrEqual(44);
  });

  it('produces distinct tokens across calls', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(generateShareToken());
    expect(seen.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd /Users/taylor/Code/maison-home
npx vitest run src/lib/shareToken.test.js
```

Expected: FAIL — "Cannot find module './shareToken.js'" or similar.

- [ ] **Step 3: Implement the utility**

Create `src/lib/shareToken.js`:

```js
// 256-bit cryptographic random token, base64url-encoded (no padding).
// Used to identify a share_links row in the URL. Generated client-side;
// the row is owner-inserted via Supabase with RLS enforcing owner_id.

export function generateShareToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url: standard base64 with + → -, / → _, and no = padding
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run src/lib/shareToken.test.js
```

Expected: PASS — both `it` blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareToken.js src/lib/shareToken.test.js
git commit -m "Add shareToken — 256-bit URL-safe token generator"
```

---

## Task 4: Service-role Supabase helper

**Files:**
- Create: `api/_supabase.js`

This is a small lazy-init wrapper so the API route file stays focused. The service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` and the URL from `VITE_SUPABASE_URL` (already in Vercel env from Productize V1).

- [ ] **Step 1: Implement**

Create `api/_supabase.js`:

```js
// Service-role Supabase client for Vercel serverless functions.
// Singleton across cold-start invocations. The service-role key
// bypasses RLS — never expose it to the browser or log it.

import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getServiceClient() {
  if (cached) return cached;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/_supabase.js
git commit -m "Add service-role Supabase helper for serverless functions"
```

(No test file — this is a trivial wrapper. It's exercised end-to-end by the route test in Task 5.)

---

## Task 5: API route `GET /api/share/sitter/[token]` (TDD)

**Files:**
- Create: `api/share/sitter/[token].js`
- Test: `api/share/sitter/[token].test.js`

Behavior recap from spec:
- Missing/unknown token → `404` with `{ status: 'ended' }`
- Revoked (`revoked_at IS NOT NULL`) or expired (`now() >= expires_at`) → `404` with `{ status: 'ended' }`
- Valid → `200` with `{ tonight_plan, sitter_notes, owner_name, kids[], household[], created_at, expires_at }`
- Unexpected failure → `500` with `{ status: 'error' }`
- `Cache-Control: no-store` on all responses

- [ ] **Step 1: Write failing test**

Create `api/share/sitter/[token].test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../_supabase.js', () => ({ getServiceClient: vi.fn() }));

import handler from './[token].js';
import { getServiceClient } from '../../_supabase.js';

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
  return res;
}

// Tiny fluent mock of the Supabase query builder for the calls this
// route makes: .from(table).select('...').eq(...).maybeSingle() and
// .from(table).select('...').eq(...).order(...).
function makeClient({ shareLinkRow, profile, kids, household }) {
  return {
    from(table) {
      if (table === 'share_links') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: shareLinkRow ?? null, error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: profile ?? null, error: null }),
        };
      }
      if (table === 'kids') {
        return {
          select() { return this; },
          eq() { return this; },
          order: async () => ({ data: kids ?? [], error: null }),
        };
      }
      if (table === 'household_items') {
        return {
          select() { return this; },
          eq() { return this; },
          order: async () => ({ data: household ?? [], error: null }),
        };
      }
      throw new Error('unexpected table: ' + table);
    },
  };
}

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/share/sitter/[token]', () => {
  it('returns 404 when token query param is missing', async () => {
    getServiceClient.mockReturnValue(makeClient({}));
    const req = { query: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 404 when token is unknown', async () => {
    getServiceClient.mockReturnValue(makeClient({ shareLinkRow: null }));
    const req = { query: { token: 'nope' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 404 when the token has been revoked', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: new Date().toISOString(),
      },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 404 when the token has expired', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: PAST,
        revoked_at: null,
      },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 200 with the full shape for a valid token', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1',
        tonight_plan: 'Bath at 7. Books, then lights.',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: null,
      },
      profile: { greeting_name: 'Tiff', sitter_notes: 'Mary naps at 1.' },
      kids: [
        { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
          shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
      ],
      household: [{ label: 'Pediatrician', value: 'Dr. Smith — 555-0100' }],
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      tonight_plan: 'Bath at 7. Books, then lights.',
      sitter_notes: 'Mary naps at 1.',
      owner_name: 'Tiff',
      kids: [
        { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
          shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
      ],
      household: [{ label: 'Pediatrician', value: 'Dr. Smith — 555-0100' }],
    });
    expect(res.body.created_at).toBeTruthy();
    expect(res.body.expires_at).toBeTruthy();
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 500 when the service client throws', async () => {
    getServiceClient.mockImplementation(() => {
      throw new Error('boom');
    });
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error' });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run api/share/sitter/\[token\].test.js
```

Expected: FAIL — cannot resolve `./[token].js`.

- [ ] **Step 3: Implement the route**

Create `api/share/sitter/[token].js`:

```js
// GET /api/share/sitter/[token]
// Public read-only sitter view. Validates the token, then fetches
// the owner's profile/kids/household_items with a service-role
// client and returns the shape the SitterShareView page expects.
//
// Token unknown / revoked / expired → 404 { status: 'ended' } (same
// shape for all three — no enumeration).

import { getServiceClient } from '../../_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = req.query?.token;
  if (!token || typeof token !== 'string') {
    return res.status(404).json({ status: 'ended' });
  }

  try {
    const supabase = getServiceClient();

    const { data: link } = await supabase
      .from('share_links')
      .select('token, owner_id, tonight_plan, created_at, expires_at, revoked_at')
      .eq('token', token)
      .eq('kind', 'sitter')
      .maybeSingle();

    if (!link) return res.status(404).json({ status: 'ended' });
    if (link.revoked_at) return res.status(404).json({ status: 'ended' });
    if (new Date(link.expires_at).getTime() <= Date.now()) {
      return res.status(404).json({ status: 'ended' });
    }

    const ownerId = link.owner_id;

    const [profileRes, kidsRes, householdRes] = await Promise.all([
      supabase.from('profiles')
        .select('greeting_name, sitter_notes')
        .eq('id', ownerId)
        .maybeSingle(),
      supabase.from('kids')
        .select('name, birthday, clothes_size, shoe_size, diaper_size, allergies')
        .eq('user_id', ownerId)
        .order('position'),
      supabase.from('household_items')
        .select('label, value')
        .eq('user_id', ownerId)
        .order('position'),
    ]);

    return res.status(200).json({
      tonight_plan: link.tonight_plan || '',
      sitter_notes: profileRes.data?.sitter_notes || '',
      owner_name: profileRes.data?.greeting_name || '',
      kids: kidsRes.data || [],
      household: householdRes.data || [],
      created_at: link.created_at,
      expires_at: link.expires_at,
    });
  } catch (err) {
    console.error('share/sitter/[token]', err);
    return res.status(500).json({ status: 'error' });
  }
}
```

Note the relative import path: `../../_supabase.js`. The file lives at `api/share/sitter/[token].js`; `_supabase.js` lives at `api/_supabase.js`.

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run api/share/sitter/\[token\].test.js
```

Expected: PASS — six green tests.

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.js api/share/sitter/\[token\].js api/share/sitter/\[token\].test.js
git commit -m "Add /api/share/sitter/[token] — token-validated public read"
```

(Note: `api/_supabase.js` was committed in Task 4 — re-adding it here is a no-op. Safe.)

---

## Task 6: `useShareLinks` hook (TDD)

**Files:**
- Create: `src/hooks/useShareLinks.js`
- Test: `src/hooks/useShareLinks.test.js`

API surface:
- `links` — all share_links for current user, ordered `created_at desc`
- `active` — `links` filtered to `revoked_at IS NULL && expires_at > now()`
- `create(tonightPlan)` — mints token, inserts row with `kind='sitter'`, `expires_at = now + 12h`, returns inserted row
- `updatePlan(token, tonightPlan)` — patches `tonight_plan`
- `revoke(token)` — sets `revoked_at = now()`

- [ ] **Step 1: Write failing test**

Create `src/hooks/useShareLinks.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('../lib/shareToken.js', () => ({ generateShareToken: () => 'TOKEN_X' }));

import { useShareLinks } from './useShareLinks.js';
import { supabase } from '../lib/supabase.js';

// Mutable in-memory rows the mock reads/writes against
let rows;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'share_links') throw new Error('unexpected table');
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          let out = rows.filter((r) => {
            return Object.entries(this._filter).every(([k, v]) => r[k] === v);
          });
          out = [...out].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { ...row };
          rows.push(inserted);
          return {
            select() { return this; },
            single: () => Promise.resolve({ data: inserted, error: null }),
          };
        },
        update(patch) {
          return {
            _filter: {},
            eq(col, val) { this._filter[col] = val; return this; },
            then(resolve) {
              for (const r of rows) {
                if (Object.entries(this._filter).every(([k, v]) => r[k] === v)) {
                  Object.assign(r, patch);
                }
              }
              resolve({ data: null, error: null });
            },
          };
        },
      };
      return api;
    },
  };
}

beforeEach(() => { rows = []; });

describe('useShareLinks', () => {
  it('loads empty list initially', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.links).toEqual([]);
    expect(result.current.active).toEqual([]);
  });

  it('create() inserts a row with 12h expiry and returns it', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.create('Bath at 7');
    });

    expect(created.token).toBe('TOKEN_X');
    expect(created.owner_id).toBe('u1');
    expect(created.kind).toBe('sitter');
    expect(created.tonight_plan).toBe('Bath at 7');
    expect(created.revoked_at).toBeNull();
    const ms = new Date(created.expires_at).getTime() - new Date(created.created_at).getTime();
    expect(ms).toBeGreaterThanOrEqual(11 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(13 * 60 * 60 * 1000);

    expect(result.current.links).toHaveLength(1);
    expect(result.current.active).toHaveLength(1);
  });

  it('updatePlan() patches tonight_plan in-place', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('first'); });
    await act(async () => { await result.current.updatePlan('TOKEN_X', 'second'); });
    expect(result.current.links[0].tonight_plan).toBe('second');
  });

  it('revoke() sets revoked_at and removes the row from active', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('plan'); });
    expect(result.current.active).toHaveLength(1);

    await act(async () => { await result.current.revoke('TOKEN_X'); });
    expect(result.current.active).toHaveLength(0);
    expect(result.current.links[0].revoked_at).toBeTruthy();
  });

  it('active filters out expired rows', async () => {
    rows.push({
      token: 'EXPIRED', owner_id: 'u1', kind: 'sitter',
      tonight_plan: '', created_at: new Date(Date.now() - 1e7).toISOString(),
      expires_at: new Date(Date.now() - 1e6).toISOString(),
      revoked_at: null,
    });
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.links).toHaveLength(1);
    expect(result.current.active).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/hooks/useShareLinks.test.js
```

Expected: FAIL — cannot resolve `./useShareLinks.js`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useShareLinks.js`:

```js
// ─── useShareLinks ─────────────────────────────────────────────────
// Owner-side hook for the share_links table. Reads/writes go through
// the standard Supabase client + RLS (owner_id = auth.uid()).
//
// The sitter never touches this hook — they hit /api/share/sitter/[token].

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { generateShareToken } from '../lib/shareToken.js';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function useShareLinks() {
  const { userId } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('share_links')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at');
      if (active && data) setLinks(data);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const create = useCallback(async (tonightPlan) => {
    const now = new Date();
    const row = {
      token: generateShareToken(),
      owner_id: userId,
      kind: 'sitter',
      tonight_plan: tonightPlan || '',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + TWELVE_HOURS_MS).toISOString(),
      revoked_at: null,
    };
    const { data, error } = await supabase
      .from('share_links')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    setLinks((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const updatePlan = useCallback(async (token, tonightPlan) => {
    const { error } = await supabase
      .from('share_links')
      .update({ tonight_plan: tonightPlan })
      .eq('owner_id', userId)
      .eq('token', token);
    if (error) throw error;
    setLinks((prev) => prev.map((l) =>
      l.token === token ? { ...l, tonight_plan: tonightPlan } : l));
  }, [userId]);

  const revoke = useCallback(async (token) => {
    const revokedAt = new Date().toISOString();
    const { error } = await supabase
      .from('share_links')
      .update({ revoked_at: revokedAt })
      .eq('owner_id', userId)
      .eq('token', token);
    if (error) throw error;
    setLinks((prev) => prev.map((l) =>
      l.token === token ? { ...l, revoked_at: revokedAt } : l));
  }, [userId]);

  const active = useMemo(() => {
    const now = Date.now();
    return links.filter((l) =>
      !l.revoked_at && new Date(l.expires_at).getTime() > now
    );
  }, [links]);

  return { links, active, loading, create, updatePlan, revoke };
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/hooks/useShareLinks.test.js
```

Expected: PASS — five green tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShareLinks.js src/hooks/useShareLinks.test.js
git commit -m "Add useShareLinks hook — create, list, update, revoke"
```

---

## Task 7: `SitterShareModal` component (TDD)

**Files:**
- Create: `src/components/SitterShareModal.jsx`
- Test: `src/components/SitterShareModal.test.jsx`

States the modal can be in:
- `create` — empty tonight textarea, *Create link* button
- `ready` — URL + copy + share buttons, after a successful create
- `edit` — same shape as create but pre-filled, *Save* button (no transition to ready)

Each state is selected by the `mode` prop passed in by App.jsx:
- `mode === 'create'` (no `editing`) → starts on create, transitions to ready
- `mode === 'edit'` with `editing` prop set to the existing row → edit state

Callbacks are passed in (`onCreate`, `onSave`) so the component doesn't import the hook directly — easier to test.

- [ ] **Step 1: Write failing test**

Create `src/components/SitterShareModal.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SitterShareModal from './SitterShareModal.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup(props = {}) {
  const onCreate = vi.fn(async (plan) => ({
    token: 'TKN', tonight_plan: plan,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    revoked_at: null,
  }));
  const onSave = vi.fn(async () => {});
  const onClose = vi.fn();
  const utils = render(
    <SitterShareModal
      open={true}
      mode="create"
      editing={null}
      onCreate={onCreate}
      onSave={onSave}
      onClose={onClose}
      {...props}
    />
  );
  return { ...utils, onCreate, onSave, onClose };
}

describe('SitterShareModal', () => {
  it('renders create state with an empty Tonight textarea and Create link button', () => {
    setup();
    expect(screen.getByText(/A Live Link/i)).toBeTruthy();
    const textarea = screen.getByLabelText(/Tonight/i);
    expect(textarea.value).toBe('');
    expect(screen.getByRole('button', { name: /Create link/i })).toBeTruthy();
  });

  it('calls onCreate with the textarea value when Create link is tapped', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup();
    await user.type(screen.getByLabelText(/Tonight/i), 'Bath at 7');
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    expect(onCreate).toHaveBeenCalledWith('Bath at 7');
  });

  it('transitions to ready state after create — shows URL and Copy/Done buttons', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    expect(await screen.findByText(/Ready/i)).toBeTruthy();
    const url = screen.getByText(/\/share\/sitter\/TKN$/);
    expect(url).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy link/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Done/i })).toBeTruthy();
  });

  it('copies the URL to clipboard when Copy link is tapped', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    await user.click(await screen.findByRole('button', { name: /Copy link/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/share\/sitter\/TKN$/));
  });

  it('edit mode pre-fills the textarea and calls onSave', async () => {
    const user = userEvent.setup();
    const editing = {
      token: 'TKN', tonight_plan: 'existing plan',
      expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    };
    const onSave = vi.fn(async () => {});
    render(
      <SitterShareModal
        open={true}
        mode="edit"
        editing={editing}
        onCreate={async () => {}}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByLabelText(/Tonight/i);
    expect(textarea.value).toBe('existing plan');
    await user.clear(textarea);
    await user.type(textarea, 'updated plan');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSave).toHaveBeenCalledWith('TKN', 'updated plan');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/components/SitterShareModal.test.jsx
```

Expected: FAIL — cannot resolve `./SitterShareModal.jsx`.

- [ ] **Step 3: Implement the component**

Create `src/components/SitterShareModal.jsx`:

```jsx
import { useState } from 'react';

export default function SitterShareModal({
  open, mode, editing, onCreate, onSave, onClose,
}) {
  const initialPlan = editing?.tonight_plan ?? '';
  const [plan, setPlan] = useState(initialPlan);
  const [stage, setStage] = useState(mode === 'edit' ? 'edit' : 'create');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    setBusy(true);
    try {
      const row = await onCreate(plan);
      setCreated(row);
      setStage('ready');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(editing.token, plan);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const url = created
    ? `${window.location.origin}/share/sitter/${created.token}`
    : '';

  const handleCopy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'A Live Link', url });
      } catch { /* user cancelled — no-op */ }
    }
  };

  const expiresLabel = created
    ? new Date(created.expires_at).toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 fade-in"
      style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px]">
        <div className="cream-bg rounded-2xl overflow-hidden flex flex-col app-shadow">
          <div className="px-6 py-5 border-b hairline">
            <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>
              {stage === 'ready' ? 'Ready' : 'A Live Link'}
            </div>
            {stage !== 'ready' && (
              <p className="muted text-[12px] font-body mt-2 leading-relaxed">
                A page the sitter can pull up tonight. Closes itself in 12 hours.
              </p>
            )}
          </div>

          {stage !== 'ready' && (
            <div className="px-6 py-5">
              <label className="font-display rose-deep text-[10px] tracking-[0.28em] uppercase block mb-2">
                Tonight
              </label>
              <textarea
                aria-label="Tonight"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                rows={6}
                className="edit-input ink text-[14px] font-body w-full"
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  minHeight: '120px', resize: 'vertical',
                }}
                placeholder="Bath, books, lights. Anything they should know."
              />
            </div>
          )}

          {stage === 'ready' && (
            <div className="px-6 py-5 space-y-4">
              <div className="break-all text-[13px] font-body ink rounded-lg p-3 border-soft">
                {url}
              </div>
              <p className="muted text-[12px] font-body italic">
                Ends {expiresLabel}.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t hairline">
            {stage === 'create' && (
              <>
                <button onClick={onClose}
                  className="font-display muted text-[11px] tracking-[0.22em] uppercase">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={busy}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                    opacity: busy ? 0.5 : 1,
                  }}>
                  Create link →
                </button>
              </>
            )}
            {stage === 'edit' && (
              <>
                <button onClick={onClose}
                  className="font-display muted text-[11px] tracking-[0.22em] uppercase">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={busy}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                    opacity: busy ? 0.5 : 1,
                  }}>
                  Save
                </button>
              </>
            )}
            {stage === 'ready' && (
              <>
                <button onClick={handleCopy}
                  className="font-display ink text-[11px] tracking-[0.22em] uppercase">
                  Copy link
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={handleShare}
                    className="font-display ink text-[11px] tracking-[0.22em] uppercase">
                    Share
                  </button>
                )}
                <button onClick={onClose}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                  }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/components/SitterShareModal.test.jsx
```

Expected: PASS — five green tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/SitterShareModal.jsx src/components/SitterShareModal.test.jsx
git commit -m "Add SitterShareModal — create, ready, edit states"
```

---

## Task 8: Wire SitterShareModal into the Girls tab

**Files:**
- Modify: `src/App.jsx`

Goal: In the Girls tab "Sitter Card" section, add a "Send a live link →" button alongside the existing "Preview & Share →". Below the buttons, render an "Active link" panel showing each unrevoked unexpired row with *Live until [time] · Edit · End now* controls. Wire each control to `useShareLinks`.

- [ ] **Step 1: Read the current Sitter Card section in `src/App.jsx`**

The block lives around lines 620–650 of `src/App.jsx`. It contains:
- A `cream-card` with the heading "Sitter Notes" + textarea
- A second `cream-card` with the heading "Sitter Card" + the "Preview & Share →" button that calls `setShowSitterCard(true)`

You'll be modifying that second card and adding state + handlers above it.

- [ ] **Step 2: Add the import and hook usage**

In `src/App.jsx`, add an import near the existing component imports (next to `SitterCardModal`):

```jsx
import SitterShareModal from './components/SitterShareModal.jsx';
import { useShareLinks } from './hooks/useShareLinks.js';
```

Inside the main component (near other `useState` declarations around line 153), add:

```jsx
const shareLinks = useShareLinks();
const [shareModal, setShareModal] = useState({ open: false, mode: 'create', editing: null });
const [revokingToken, setRevokingToken] = useState(null);
```

- [ ] **Step 3: Modify the Sitter Card cream-card to add the new button + panel**

Replace the existing Sitter Card cream-card block (the one with the "Preview & Share →" button) with:

```jsx
<div className="cream-card rounded-2xl p-6 border-soft text-center">
  <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-2" style={{ fontWeight: 500 }}>✦ Sitter Card</div>
  <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '20px' }}>The Handoff</div>
  <p className="muted text-[12px] font-body mb-5 leading-relaxed">
    Share the particulars — as a screenshot, or as a live page for tonight.
  </p>

  <div className="flex flex-col gap-3 items-center">
    <button onClick={() => setShowSitterCard(true)}
      className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
      style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
      Share as image →
    </button>
    <button onClick={() => setShareModal({ open: true, mode: 'create', editing: null })}
      className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
      style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
      Send a live link →
    </button>
  </div>

  {shareLinks.active.length > 0 && (
    <div className="mt-5 pt-5 border-t hairline space-y-3">
      {shareLinks.active.map((link) => {
        const t = new Date(link.expires_at).toLocaleTimeString([], {
          hour: 'numeric', minute: '2-digit',
        });
        return (
          <div key={link.token}
            className="flex items-center justify-center gap-3 text-[12px] font-body muted italic">
            <span>Live until {t}</span>
            <span>·</span>
            <button
              onClick={() => setShareModal({ open: true, mode: 'edit', editing: link })}
              className="ink underline-offset-2 hover:underline not-italic font-display text-[11px] tracking-[0.22em] uppercase">
              Edit
            </button>
            <span>·</span>
            <button
              onClick={() => setRevokingToken(link.token)}
              className="ink underline-offset-2 hover:underline not-italic font-display text-[11px] tracking-[0.22em] uppercase">
              End now
            </button>
          </div>
        );
      })}
    </div>
  )}
</div>
```

- [ ] **Step 4: Mount the SitterShareModal and revoke-confirm dialog near the existing SitterCardModal**

After the existing `<SitterCardModal ... />` (around line 350), add:

```jsx
<SitterShareModal
  open={shareModal.open}
  mode={shareModal.mode}
  editing={shareModal.editing}
  onCreate={(plan) => shareLinks.create(plan)}
  onSave={(token, plan) => shareLinks.updatePlan(token, plan)}
  onClose={() => setShareModal({ open: false, mode: 'create', editing: null })}
/>
{revokingToken && (
  <div onClick={() => setRevokingToken(null)}
    className="absolute inset-0 z-50 flex items-center justify-center p-4 fade-in"
    style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}>
    <div onClick={(e) => e.stopPropagation()}
      className="cream-bg rounded-2xl p-6 max-w-[340px] app-shadow text-center">
      <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '18px' }}>
        End this link?
      </div>
      <p className="muted text-[12px] font-body mb-5 leading-relaxed">
        The sitter's page will say it's ended.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setRevokingToken(null)}
          className="font-display muted text-[11px] tracking-[0.22em] uppercase">
          Cancel
        </button>
        <button
          onClick={async () => {
            await shareLinks.revoke(revokingToken);
            setRevokingToken(null);
          }}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
          End now
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run the existing test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all existing tests still PASS (no test file targets the Sitter Card section directly — this is a UI wiring change, verified by the modal/hook tests already passing).

- [ ] **Step 6: Build the app to catch JSX/import errors**

```bash
npm run build
```

Expected: build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "Wire Send a live link into Girls tab Sitter Card section"
```

---

## Task 9: `SitterShareView` page (TDD)

**Files:**
- Create: `src/pages/SitterShareView.jsx`
- Test: `src/pages/SitterShareView.test.jsx`

The page reads a token from a prop (passed by `main.jsx` after parsing the URL). It fetches `/api/share/sitter/{token}` on mount. Four render states:
- `loading` — minimal placeholder
- `ok` — full content with conditional sections
- `ended` — calm full-page "This link has ended."
- `error` — "Something went wrong. Try refreshing."

- [ ] **Step 1: Write failing test**

Create `src/pages/SitterShareView.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import SitterShareView from './SitterShareView.jsx';

const FUTURE = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 3600 * 1000).toISOString();

const fullPayload = {
  tonight_plan: 'Bath at 7. Books, then lights.',
  sitter_notes: 'Mary naps at 1.',
  owner_name: 'Tiff',
  kids: [
    { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
      shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
    { name: 'Ruth', birthday: '2024-08-10', clothes_size: '12m',
      shoe_size: '3', diaper_size: 'Size 4', allergies: '' },
  ],
  household: [
    { label: 'Pediatrician', value: 'Dr. Smith — 555-0100' },
    { label: 'WiFi', value: 'house-wifi · honeysuckle' },
  ],
  created_at: PAST,
  expires_at: FUTURE,
};

function mockFetch(impl) {
  globalThis.fetch = vi.fn(impl);
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { cleanup(); delete globalThis.fetch; });

describe('SitterShareView', () => {
  it('renders all sections for a valid token', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => fullPayload }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/Tiff's home/i)).toBeTruthy();
    expect(screen.getByText(/Bath at 7/)).toBeTruthy();
    expect(screen.getByText('Mary')).toBeTruthy();
    expect(screen.getByText('Ruth')).toBeTruthy();
    expect(screen.getByText('Pediatrician')).toBeTruthy();
    expect(screen.getByText(/Mary naps at 1/)).toBeTruthy();
    expect(screen.getByText(/Live until/)).toBeTruthy();
  });

  it('falls back to "Tonight" header when owner_name is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, owner_name: '' }),
    }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/^Tonight$/)).toBeTruthy();
    expect(screen.queryByText(/'s home/)).toBeNull();
  });

  it('omits Tonight section when tonight_plan is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, tonight_plan: '' }),
    }));
    render(<SitterShareView token="abc" />);
    await screen.findByText(/Tiff's home/i);
    expect(screen.queryByText(/Bath at 7/)).toBeNull();
  });

  it('omits Notes section when sitter_notes is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, sitter_notes: '' }),
    }));
    render(<SitterShareView token="abc" />);
    await screen.findByText(/Tiff's home/i);
    expect(screen.queryByText(/Mary naps at 1/)).toBeNull();
  });

  it('renders ended state on 404', async () => {
    mockFetch(async () => ({
      ok: false, status: 404, json: async () => ({ status: 'ended' }),
    }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/This link has ended/i)).toBeTruthy();
    expect(screen.getByText(/Ask the parent for a new one/i)).toBeTruthy();
  });

  it('renders server-error state on 500', async () => {
    mockFetch(async () => ({
      ok: false, status: 500, json: async () => ({ status: 'error' }),
    }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/Something went wrong/i)).toBeTruthy();
  });

  it('renders error state on network failure', async () => {
    mockFetch(async () => { throw new Error('network'); });
    render(<SitterShareView token="abc" />);
    await waitFor(() =>
      expect(screen.getByText(/Something went wrong/i)).toBeTruthy()
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/pages/SitterShareView.test.jsx
```

Expected: FAIL — cannot resolve `./SitterShareView.jsx`.

- [ ] **Step 3: Implement the page**

Create `src/pages/SitterShareView.jsx`:

```jsx
import { useEffect, useState } from 'react';

function computeAge(birthdayISO) {
  if (!birthdayISO) return '';
  const b = new Date(birthdayISO);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years >= 2) return `${years} years`;
  if (years === 1) return months > 0 ? `1 year · ${months} mo` : '1 year';
  return `${Math.max(0, months + years * 12)} mo`;
}

export default function SitterShareView({ token }) {
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/share/sitter/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        if (!active) return;
        if (res.status === 404) {
          setState({ kind: 'ended' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'error' });
          return;
        }
        const data = await res.json();
        setState({ kind: 'ok', data });
      } catch {
        if (active) setState({ kind: 'error' });
      }
    })();
    return () => { active = false; };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <div className="cream-bg min-h-screen flex items-center justify-center">
        <div className="muted font-body italic text-[14px]">Loading…</div>
      </div>
    );
  }

  if (state.kind === 'ended') {
    return (
      <div className="cream-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="font-display ink mb-3" style={{ fontWeight: 400, fontSize: '24px' }}>
          This link has ended.
        </div>
        <p className="muted font-body italic">Ask the parent for a new one.</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="cream-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="font-display ink mb-3" style={{ fontWeight: 400, fontSize: '24px' }}>
          Something went wrong.
        </div>
        <p className="muted font-body italic">Try refreshing.</p>
      </div>
    );
  }

  const { data } = state;
  const header = data.owner_name
    ? `${data.owner_name}'s home — tonight`
    : 'Tonight';
  const endsAt = new Date(data.expires_at).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className="cream-bg min-h-screen px-4 py-8 max-w-[560px] mx-auto">
      <h1 className="font-display ink text-center mb-6"
        style={{ fontWeight: 400, fontSize: '24px' }}>
        {header}
      </h1>

      {data.tonight_plan && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            Tonight
          </div>
          <p className="ink text-[14px] leading-relaxed font-body"
            style={{ whiteSpace: 'pre-wrap' }}>
            {data.tonight_plan}
          </p>
        </section>
      )}

      {data.kids?.length > 0 && (
        <section className="mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3 text-center"
            style={{ fontWeight: 500 }}>
            The Girls
          </div>
          <div className="space-y-4">
            {data.kids.map((kid, idx) => {
              const age = computeAge(kid.birthday);
              const rows = [
                kid.clothes_size && ['Clothes', kid.clothes_size],
                kid.shoe_size && ['Shoes', kid.shoe_size],
                kid.diaper_size && ['Diapers', kid.diaper_size],
                kid.allergies && ['Allergies', kid.allergies],
              ].filter(Boolean);
              return (
                <div key={idx} className="cream-card rounded-2xl p-6 border-soft">
                  <div className="font-display ink mb-3"
                    style={{ fontWeight: 400, fontSize: '18px' }}>
                    {kid.name}{age && <span className="muted font-body text-[13px]"> · {age}</span>}
                  </div>
                  <dl className="space-y-1">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex justify-between text-[13px] font-body">
                        <dt className="muted">{label}</dt>
                        <dd className="ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.household?.length > 0 && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            The House
          </div>
          <dl className="space-y-2">
            {data.household.map((row, idx) => (
              <div key={idx} className="flex justify-between text-[13px] font-body">
                <dt className="muted">{row.label}</dt>
                <dd className="ink text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.sitter_notes && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            Notes
          </div>
          <p className="ink text-[14px] leading-relaxed font-display"
            style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            {data.sitter_notes}
          </p>
        </section>
      )}

      <p className="muted text-center text-[12px] font-body italic mt-6">
        Live until {endsAt}.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/pages/SitterShareView.test.jsx
```

Expected: PASS — seven green tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SitterShareView.jsx src/pages/SitterShareView.test.jsx
git commit -m "Add SitterShareView — public read-only sitter page"
```

---

## Task 10: Route parser + `main.jsx` branching

**Files:**
- Create: `src/lib/route.js`
- Create: `src/lib/route.test.js`
- Modify: `src/main.jsx`

A tiny parser that returns `{ mode: 'share-sitter', token }` for `/share/sitter/<token>` paths and `{ mode: 'app' }` otherwise. Keeping it as its own function lets us unit-test the branch decision.

- [ ] **Step 1: Write failing test**

Create `src/lib/route.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseRoute } from './route.js';

describe('parseRoute', () => {
  it('returns app mode for / and unknown paths', () => {
    expect(parseRoute('/')).toEqual({ mode: 'app' });
    expect(parseRoute('/anything-else')).toEqual({ mode: 'app' });
    expect(parseRoute('')).toEqual({ mode: 'app' });
  });

  it('returns share-sitter mode + token for /share/sitter/:token', () => {
    expect(parseRoute('/share/sitter/abc123')).toEqual({
      mode: 'share-sitter', token: 'abc123',
    });
    expect(parseRoute('/share/sitter/AB-CD_ef')).toEqual({
      mode: 'share-sitter', token: 'AB-CD_ef',
    });
  });

  it('returns app mode when token is missing', () => {
    expect(parseRoute('/share/sitter/')).toEqual({ mode: 'app' });
    expect(parseRoute('/share/sitter')).toEqual({ mode: 'app' });
  });

  it('returns app mode for share paths with extra segments', () => {
    expect(parseRoute('/share/sitter/abc/extra')).toEqual({ mode: 'app' });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/lib/route.test.js
```

Expected: FAIL — cannot resolve `./route.js`.

- [ ] **Step 3: Implement**

Create `src/lib/route.js`:

```js
// Parse window.location.pathname into an app mode. Returns either
// { mode: 'app' } (mount the normal app tree with AuthProvider)
// or { mode: 'share-sitter', token: '...' } (mount SitterShareView
// alone, no AuthProvider — visitors don't get stray anon accounts).

export function parseRoute(pathname) {
  if (typeof pathname !== 'string') return { mode: 'app' };
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'share' && parts[1] === 'sitter') {
    return { mode: 'share-sitter', token: parts[2] };
  }
  return { mode: 'app' };
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/lib/route.test.js
```

Expected: PASS — four green tests.

- [ ] **Step 5: Update `src/main.jsx` to branch on the route**

Replace the contents of `src/main.jsx` with:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './lib/auth.jsx';
import App from './App.jsx';
import SitterShareView from './pages/SitterShareView.jsx';
import { parseRoute } from './lib/route.js';

const route = parseRoute(window.location.pathname);
const root = ReactDOM.createRoot(document.getElementById('root'));

if (route.mode === 'share-sitter') {
  root.render(
    <React.StrictMode>
      <SitterShareView token={route.token} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}
```

- [ ] **Step 6: Run the full vitest suite + build**

```bash
npx vitest run
npm run build
```

Expected: all tests PASS, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/route.js src/lib/route.test.js src/main.jsx
git commit -m "Mount SitterShareView for /share/sitter/:token paths"
```

---

## Task 11: Vercel SPA rewrite for share URLs

**Files:**
- Modify: `vercel.json`

By default, Vercel serves `index.html` for unknown paths via its framework auto-detection, but Maison already has a `vercel.json` — confirm `/share/sitter/:token` resolves to `index.html` so the SPA can render it. (The `/api/share/sitter/[token]` route is matched by file convention and takes precedence over any SPA rewrite.)

- [ ] **Step 1: Read current `vercel.json`**

Use the Read tool on `vercel.json`. If it already has a rewrite to `index.html` covering all non-API non-asset paths (e.g., `{ "source": "/(.*)", "destination": "/index.html" }`), no change is needed.

- [ ] **Step 2: Add an SPA fallback rewrite if missing**

If no SPA fallback is present, add one. Example final `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

If `vercel.json` already has unrelated config (headers, redirects), preserve them and only add the rewrites array (or extend it). Do not strip existing settings.

- [ ] **Step 3: Verify by running `npm run build` then `npx serve dist` locally (optional)**

```bash
npm run build
npx serve dist -p 4173
```

Visit `http://localhost:4173/share/sitter/anything` — should serve `index.html`. The page will render the "ended" state because no real backend is running, which is fine; we're just verifying the rewrite.

- [ ] **Step 4: Commit (if `vercel.json` changed)**

```bash
git add vercel.json
git commit -m "Add SPA rewrite so /share/sitter/:token serves index.html"
```

If no change was needed, skip the commit.

---

## Task 12: Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel and `.env.local`

**No file changes in this task — environment setup only.**

- [ ] **Step 1: Fetch the service-role key from Supabase**

In the Supabase dashboard for project `hgkvxogtehyjdhjfexow` → *Project Settings → API*, copy the `service_role` key. Treat it as you would a database password — do not paste it into chat, do not check it into git.

- [ ] **Step 2: Add it to Vercel — Production and Preview**

Vercel dashboard → project `maison-home` → *Settings → Environment Variables*:
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: (the key from step 1)
- Environments: Production, Preview (not Development unless you also want it locally on Vercel CLI)

- [ ] **Step 3: Add it to local `.env.local`**

Append to `.env.local` (do not commit):

```
SUPABASE_SERVICE_ROLE_KEY=<key>
```

- [ ] **Step 4: Trigger a redeploy**

In Vercel, redeploy the latest production build so the new env var takes effect. (Pushing the next commit in Task 13 will also pick it up.)

- [ ] **Step 5: Confirm the env var is wired**

After redeploy, hit `https://maison-home-git-main-tbacon559-gifs-projects.vercel.app/api/share/sitter/anything`. Expected: HTTP 404 with body `{"status":"ended"}` — not a 500. A 500 means the env var didn't make it through.

(No commit — this is configuration, not code.)

---

## Task 13: Manual end-to-end smoke

**No file changes in this task.**

The full Vitest suite has already covered the unit cases. This is the brief manual sanity check called out in the spec's verification protocol.

- [ ] **Step 1: Sign into the production app on a phone or browser**

`https://maison-home-git-main-tbacon559-gifs-projects.vercel.app/`. Make sure you have at least one kid, at least one household item, and a non-empty `sitter_notes` (otherwise the share page is mostly empty — still valid, just less to look at).

- [ ] **Step 2: Create a share**

Girls tab → Sitter Card section → *Send a live link →*. Enter a tonight plan. Tap *Create link*.

- [ ] **Step 3: Open the link in a private/incognito window**

Copy the URL from the ready state. Open in a different browser session that's not logged in. Expected: full sitter view with all sections present, *Live until <time>* footer.

- [ ] **Step 4: Test edit-while-open**

Back in the owner session, tap *Edit* on the active link, change the tonight plan, save. Refresh the private window. Expected: updated plan shown.

- [ ] **Step 5: Test revoke**

Owner session → *End now* → confirm. Refresh the private window. Expected: calm "This link has ended" page.

- [ ] **Step 6: Test 404 on bogus token**

In the private window, visit `/share/sitter/bogus-token-that-does-not-exist`. Expected: "This link has ended" page (same as revoked, by design).

- [ ] **Step 7: Run the RLS check**

In the Supabase SQL editor, run the contents of `supabase/checks/share_links_rls.sql`, substituting two real user UUIDs (you can use yours twice — or any two profiles). Expected: both queries return zero rows.

- [ ] **Step 8: Update memory**

After confirming all of the above passes, add a project memory file at `/Users/taylor/.claude/projects/-Users-taylor-Code-Mantle/memory/project_maison_sitter_sharing_shipped.md` recording the ship date, scope (sitter-only), and what's deferred (spouse/family sharing). Add a one-line pointer to `MEMORY.md`.

---

## Spec coverage map

| Spec section | Covered by |
|---|---|
| 3 Architecture & data flow | Tasks 1, 4, 5, 8, 9, 10 |
| 3 Auth-context isolation | Task 10 |
| 4 share_links DDL + RLS | Task 1 |
| 4 Token format (256-bit base64url) | Task 3 |
| 4 12h expiry | Task 6 (`useShareLinks.create`) |
| 4 Migration filename | Task 1 |
| 5 API route logic | Task 5 |
| 5 Service-role helper | Task 4 |
| 5 Cache-Control no-store | Task 5 |
| 6 Owner where it lives + buttons | Task 8 |
| 6 Send-link modal (initial + ready states) | Task 7 |
| 6 Active link panel | Task 8 |
| 6 Edit + End now flows | Tasks 7, 8 |
| 6 useShareLinks hook | Task 6 |
| 7 Sitter view layout + states | Task 9 |
| 7 Ended/error pages | Task 9 |
| 8 Security & privacy | Tasks 1 (RLS), 4 (service-role isolation), 5 (no enumeration), 10 (anon isolation) |
| 9 Vitest component + API tests | Tasks 3, 5, 6, 7, 9, 10 |
| 9 RLS SQL snippet | Task 2 |
| 9 Verification protocol | Tasks 13 |

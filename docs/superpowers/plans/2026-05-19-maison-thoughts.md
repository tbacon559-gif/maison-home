# Maison Thoughts Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Moments tab with a Thoughts tab — named lists of checkable items, manual archive, inline "look back" view. Drop the Moments feature wholesale (table, Storage bucket, hook, photo flow, share-moment flow).

**Architecture:** Two new tables (`thought_lists`, `thought_items`) with owner-only RLS. Two hooks (`useThoughtLists`, `useThoughtItems(listId)`) following the established per-table pattern (cf. `useShareLinks`, `useKids`). One new component `ThoughtsTab.jsx` containing the tab body and a per-list `ThoughtListCard` subcomponent that instantiates `useThoughtItems` for its list.

**Tech Stack:** Vite + React, Supabase (Postgres + RLS), vitest (+ jsdom for components), `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-05-19-maison-thoughts-design.md` (commit `5b026a1`)

---

## File Map

**Create**
- `supabase/migrations/0003_thoughts_and_drop_moments.sql` — DDL for both new tables; drop `moments` table
- `src/hooks/useThoughtLists.js` — list CRUD + archive/restore
- `src/hooks/useThoughtLists.test.js`
- `src/hooks/useThoughtItems.js` — per-list item CRUD
- `src/hooks/useThoughtItems.test.js`
- `src/components/ThoughtsTab.jsx` — tab body + `ThoughtListCard` subcomponent
- `src/components/ThoughtsTab.test.jsx`

**Modify**
- `src/App.jsx` — remove Moments imports/state/handlers/JSX; mount `ThoughtsTab`; reorder bottom-nav to `[Today, Tidy, Nourish, Thoughts, Girls]`
- `src/components/SeventhDay.jsx` — drop `moments` and `photoCache` props; remove moment-rendering body; keep heading + empty-state subtitle

**Delete**
- `src/hooks/useMoments.js`
- `src/lib/photoCache.js`
- `src/lib/photoCache.test.js`

**External (no commit — user-driven)**
- Apply migration via Supabase SQL editor for project `hgkvxogtehyjdhjfexow`
- Delete `moments` Storage bucket via dashboard

---

## Task 1: Migration + drop Moments table

**Files:**
- Create: `supabase/migrations/0003_thoughts_and_drop_moments.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_thoughts_and_drop_moments.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration**

Paste the SQL above into the Supabase SQL editor for project `hgkvxogtehyjdhjfexow`. Run. Confirm three statements executed:
- `CREATE TABLE` (thought_lists)
- `CREATE TABLE` (thought_items)
- `DROP TABLE` (moments)

If the MCP `apply_migration` is bound to this project, use that instead and name the migration `thoughts_and_drop_moments`. Otherwise pasting in the SQL editor is the supported path (per the Task 1 escalation in the sitter-sharing plan).

- [ ] **Step 3: Verify table + policies**

In the SQL editor, run:

```sql
select polname, polcmd
from pg_policy
where polrelid in (
  'public.thought_lists'::regclass,
  'public.thought_items'::regclass
);
select 1 from pg_tables where tablename = 'moments' and schemaname = 'public';
```

Expected: two rows from the first query (one policy per table, polcmd `*`). The second query returns zero rows (moments table is gone).

- [ ] **Step 4: Delete the moments Storage bucket**

Supabase dashboard → Storage → `moments` bucket → Delete bucket (confirm). All photo objects go with it.

- [ ] **Step 5: Commit the migration file**

```bash
cd /Users/taylor/Code/maison-home
git add supabase/migrations/0003_thoughts_and_drop_moments.sql
git commit -m "Add thoughts migration — thought_lists + thought_items; drop moments"
```

---

## Task 2: Remove Moments code

**Files:**
- Delete: `src/hooks/useMoments.js`
- Delete: `src/lib/photoCache.js`
- Delete: `src/lib/photoCache.test.js`
- Modify: `src/App.jsx`
- Modify: `src/components/SeventhDay.jsx`

This task brings the codebase into a known-good state with no Moments references. The Thoughts tab does not yet exist — the bottom-nav drops the Moments entry, leaving four tabs (Today, Tidy, Nourish, Girls). Tasks 3-5 build Thoughts; Task 6 mounts it.

- [ ] **Step 1: Delete the three moments-related files**

```bash
cd /Users/taylor/Code/maison-home
rm src/hooks/useMoments.js
rm src/lib/photoCache.js
rm src/lib/photoCache.test.js
```

- [ ] **Step 2: Update `src/components/SeventhDay.jsx`**

Replace the file contents with:

```jsx
export default function SeventhDay() {
  return (
    <div className="px-7 pt-10 pb-10 fade-in">
      <h1 className="font-display ink leading-tight mb-3"
        style={{ fontWeight: 400, fontSize: '34px' }}>
        The seventh day.
      </h1>
      <p className="font-display ink text-[17px] leading-snug mb-10"
        style={{ fontStyle: 'italic', fontWeight: 400 }}>
        Nothing is asked of you today. What was the week?
      </p>
      <p className="muted text-[13px] font-body italic font-display">
        Rest is the work. Pick up tomorrow.
      </p>
    </div>
  );
}
```

The component loses its props and renders a single calm placeholder where the moment recap used to be. This preserves the Seventh-Day-mode shell so the existing Today-tab branch (`isSeventhDay() ? <SeventhDay ... /> : ...`) still has something to render.

- [ ] **Step 3: Strip Moments from `src/App.jsx`**

The edits below are surgical. Apply them in order; verify the file still compiles after each.

**3a. Remove `useMoments` import.** Find and delete the line:
```jsx
import { useMoments } from './hooks/useMoments.js';
```

**3b. Remove the `momentsHook` instantiation.** Find and delete (near other hook lines around line 147):
```jsx
const momentsHook = useMoments();
```

**3c. Remove these state lines** (near other useState calls):
```jsx
const [pendingPhotos, setPendingPhotos] = useState([]);
const fileInputRef = useRef(null);
const [photoUrls, setPhotoUrls] = useState({});
const [shareMomentStatus, setShareMomentStatus] = useState({});
```

If `useRef` is no longer used anywhere else in the file, also remove `useRef` from the `react` import; otherwise leave it.

**3d. Remove the photo-loading `useEffect`.** Find and delete the entire `useEffect` block that begins:
```jsx
// Photo loading — fetch + decrypt for any moment with a photo path not yet cached
useEffect(() => {
  const idsNeeded = momentsHook.moments
  ...
}, [momentsHook.moments]);
```

**3e. Remove these handlers** (the photo-flow functions, ~50 lines total):
- `onPhotoPick`
- `updatePending`
- `cancelPending`
- `saveAllPending`
- `deleteMomentLocal`
- `shareMoment`

**3f. Remove the `<SeventhDay ... />` props.** Find the line:
```jsx
<SeventhDay
  moments={momentsHook.moments.map(...)}
  photoCache={photoUrls}
/>
```
Replace with:
```jsx
<SeventhDay />
```

**3g. Remove the entire MOMENTS JSX block.** Find:
```jsx
{/* MOMENTS */}
{activeNav === 'Moments' && (
  <div className="pt-6 px-5 pb-8">
    ...
  </div>
)}
```
Delete the entire block (everything from the `{/* MOMENTS */}` comment through the closing `)}` of the `activeNav === 'Moments' &&` branch).

**3h. Remove `Moments` from the bottom nav.** Find:
```jsx
{ id: 'Tidy', label: 'Tidy' },
{ id: 'Nourish', label: 'Nourish' },
{ id: 'Girls', label: 'Girls' },
{ id: 'Moments', label: 'Moments' },
```
Replace with:
```jsx
{ id: 'Tidy', label: 'Tidy' },
{ id: 'Nourish', label: 'Nourish' },
{ id: 'Girls', label: 'Girls' },
```
(The Thoughts entry is added later in Task 6.)

**3i. Clean up unused imports.** After 3a-3h, several imports may have become unused — likely candidates: `buildMomentSVG`, `arrayBufferToBase64`, `getImageDims`, `shareOrDownload`, `shortDate`. Run a quick search to confirm each is unused elsewhere in `App.jsx`:

```bash
cd /Users/taylor/Code/maison-home
for sym in buildMomentSVG arrayBufferToBase64 getImageDims shareOrDownload shortDate; do
  echo "=== $sym ==="
  grep -n "$sym" src/App.jsx
done
```

For each symbol that no longer appears outside its import line, remove the import. Do **not** delete the lib source files (`src/lib/svg.js` etc.) — they may still be used by `SitterCardModal.jsx` or other components. Only remove the `App.jsx` import lines.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/taylor/Code/maison-home
TZ=UTC npx vitest run
```

Expected: all remaining tests pass. The photo-cache test file is gone; total test count drops by however many tests it had. No moments-related tests should remain.

If any test fails because of a dangling import or reference to moments, fix it inline.

- [ ] **Step 5: Build to confirm**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove Moments — drop hook, photo cache, App.jsx JSX, SeventhDay props"
```

(Use `-A` here because there are deletions plus modifications — but verify the staged set first with `git status` to make sure nothing unintended is included.)

---

## Task 3: `useThoughtLists` hook (TDD)

**Files:**
- Create: `src/hooks/useThoughtLists.js`
- Test: `src/hooks/useThoughtLists.test.js`

API surface (per spec):
- `active` — non-archived rows, ordered by `position` ascending
- `archived` — archived rows, ordered by `archived_at` descending
- `loading`
- `create(title)` — inserts a new list at the end of active position; returns the inserted row
- `rename(id, title)`
- `archive(id)` — sets `archived = true`, `archived_at = now()`
- `restore(id)` — clears `archived` and `archived_at`
- `removeList(id)` — hard delete

- [ ] **Step 1: Write failing test**

Create `src/hooks/useThoughtLists.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));

import { useThoughtLists } from './useThoughtLists.js';

let rows;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'thought_lists') throw new Error('unexpected table ' + table);
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          const out = rows
            .filter((r) => Object.entries(this._filter).every(([k, v]) => r[k] === v))
            .slice()
            .sort((a, b) => (a.position - b.position));
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { id: row.id ?? `id-${rows.length + 1}`, ...row };
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
        delete() {
          return {
            _filter: {},
            eq(col, val) { this._filter[col] = val; return this; },
            then(resolve) {
              rows = rows.filter(
                (r) => !Object.entries(this._filter).every(([k, v]) => r[k] === v)
              );
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

describe('useThoughtLists', () => {
  it('starts empty and not loading after the initial fetch', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.active).toEqual([]);
    expect(result.current.archived).toEqual([]);
  });

  it('create() appends a new list to active and returns it', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let row;
    await act(async () => { row = await result.current.create('Birthday party'); });

    expect(row.title).toBe('Birthday party');
    expect(row.user_id).toBe('u1');
    expect(row.archived).toBe(false);
    expect(row.position).toBe(0);

    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0].title).toBe('Birthday party');
    expect(result.current.archived).toHaveLength(0);
  });

  it('create() positions each subsequent list after the previous', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('A'); });
    await act(async () => { await result.current.create('B'); });
    await act(async () => { await result.current.create('C'); });
    expect(result.current.active.map((l) => l.title)).toEqual(['A', 'B', 'C']);
    expect(result.current.active.map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it('rename() patches title in-place', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Old'); });
    await act(async () => { await result.current.rename(row.id, 'New'); });
    expect(result.current.active[0].title).toBe('New');
  });

  it('archive() moves a list into archived with archived_at set', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Plan'); });
    await act(async () => { await result.current.archive(row.id); });
    expect(result.current.active).toHaveLength(0);
    expect(result.current.archived).toHaveLength(1);
    expect(result.current.archived[0].archived).toBe(true);
    expect(result.current.archived[0].archived_at).toBeTruthy();
  });

  it('restore() returns an archived list to active and clears archived_at', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Plan'); });
    await act(async () => { await result.current.archive(row.id); });
    await act(async () => { await result.current.restore(row.id); });
    expect(result.current.active).toHaveLength(1);
    expect(result.current.archived).toHaveLength(0);
    expect(result.current.active[0].archived).toBe(false);
    expect(result.current.active[0].archived_at).toBeNull();
  });

  it('removeList() hard-deletes a list', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Doomed'); });
    await act(async () => { await result.current.removeList(row.id); });
    expect(result.current.active).toHaveLength(0);
  });

  it('archived list ordering is most-recently-archived first', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let a, b;
    await act(async () => { a = await result.current.create('A'); });
    await act(async () => { b = await result.current.create('B'); });
    await act(async () => { await result.current.archive(a.id); });
    // Tiny delay so archived_at timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    await act(async () => { await result.current.archive(b.id); });
    expect(result.current.archived.map((l) => l.title)).toEqual(['B', 'A']);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/hooks/useThoughtLists.test.js
```

Expected: FAIL — cannot resolve `./useThoughtLists.js`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useThoughtLists.js`:

```js
// ─── useThoughtLists ───────────────────────────────────────────────
// Owner-side hook for the thought_lists table. Active vs archived
// rows are surfaced as two arrays; the component never has to filter.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useThoughtLists() {
  const { userId } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('thought_lists')
        .select('*')
        .eq('user_id', userId)
        .order('position');
      if (alive && data) setLists(data);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const create = useCallback(async (title) => {
    const activeCount = lists.filter((l) => !l.archived).length;
    const row = {
      user_id: userId,
      title: title || '',
      archived: false,
      archived_at: null,
      position: activeCount,
    };
    const { data, error } = await supabase
      .from('thought_lists').insert(row).select().single();
    if (error) throw error;
    setLists((prev) => [...prev, data]);
    return data;
  }, [lists, userId]);

  const rename = useCallback(async (id, title) => {
    const { error } = await supabase
      .from('thought_lists')
      .update({ title })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title } : l)));
  }, [userId]);

  const archive = useCallback(async (id) => {
    const archived_at = new Date().toISOString();
    const { error } = await supabase
      .from('thought_lists')
      .update({ archived: true, archived_at })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) =>
      l.id === id ? { ...l, archived: true, archived_at } : l));
  }, [userId]);

  const restore = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_lists')
      .update({ archived: false, archived_at: null })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) =>
      l.id === id ? { ...l, archived: false, archived_at: null } : l));
  }, [userId]);

  const removeList = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_lists')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, [userId]);

  const active = useMemo(
    () => lists.filter((l) => !l.archived)
      .slice()
      .sort((a, b) => a.position - b.position),
    [lists]
  );

  const archived = useMemo(
    () => lists.filter((l) => l.archived)
      .slice()
      .sort((a, b) => {
        const ax = a.archived_at ?? '';
        const bx = b.archived_at ?? '';
        return ax > bx ? -1 : ax < bx ? 1 : 0;
      }),
    [lists]
  );

  return { active, archived, loading, create, rename, archive, restore, removeList };
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/hooks/useThoughtLists.test.js
```

Expected: PASS — 8 green tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useThoughtLists.js src/hooks/useThoughtLists.test.js
git commit -m "Add useThoughtLists hook — create, rename, archive, restore, remove"
```

---

## Task 4: `useThoughtItems` hook (TDD)

**Files:**
- Create: `src/hooks/useThoughtItems.js`
- Test: `src/hooks/useThoughtItems.test.js`

API:
- `items` — for the given `listId`, ordered by `position` ascending
- `loading`
- `add(text)` — appends an item with the next position
- `toggle(id)`
- `edit(id, text)`
- `remove(id)`

- [ ] **Step 1: Write failing test**

Create `src/hooks/useThoughtItems.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));

import { useThoughtItems } from './useThoughtItems.js';

let rows;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'thought_items') throw new Error('unexpected table ' + table);
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          const out = rows
            .filter((r) => Object.entries(this._filter).every(([k, v]) => r[k] === v))
            .slice()
            .sort((a, b) => a.position - b.position);
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { id: row.id ?? `id-${rows.length + 1}`, ...row };
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
        delete() {
          return {
            _filter: {},
            eq(col, val) { this._filter[col] = val; return this; },
            then(resolve) {
              rows = rows.filter(
                (r) => !Object.entries(this._filter).every(([k, v]) => r[k] === v)
              );
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

describe('useThoughtItems', () => {
  it('starts empty for a list with no items', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('add() appends an item with the next position', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Milk'); });
    await act(async () => { await result.current.add('Eggs'); });
    expect(result.current.items.map((i) => i.text)).toEqual(['Milk', 'Eggs']);
    expect(result.current.items.map((i) => i.position)).toEqual([0, 1]);
    expect(result.current.items[0].list_id).toBe('list-1');
    expect(result.current.items[0].user_id).toBe('u1');
    expect(result.current.items[0].done).toBe(false);
  });

  it('toggle() flips done state', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('A'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.toggle(id); });
    expect(result.current.items[0].done).toBe(true);
    await act(async () => { await result.current.toggle(id); });
    expect(result.current.items[0].done).toBe(false);
  });

  it('edit() patches text in-place', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Old'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.edit(id, 'New'); });
    expect(result.current.items[0].text).toBe('New');
  });

  it('remove() deletes an item', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Gone'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.remove(id); });
    expect(result.current.items).toEqual([]);
  });

  it('scopes items to the listId passed in', async () => {
    rows.push(
      { id: 'i1', list_id: 'other', user_id: 'u1', text: 'OTHER', done: false, position: 0 },
      { id: 'i2', list_id: 'list-1', user_id: 'u1', text: 'MINE', done: false, position: 0 },
    );
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.text)).toEqual(['MINE']);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/hooks/useThoughtItems.test.js
```

Expected: FAIL — cannot resolve `./useThoughtItems.js`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useThoughtItems.js`:

```js
// ─── useThoughtItems ───────────────────────────────────────────────
// Per-list item hook for thought_items. Instantiated once per list
// card in ThoughtsTab. Local state is the items for THIS list only.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useThoughtItems(listId) {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !listId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('thought_items')
        .select('*')
        .eq('user_id', userId)
        .eq('list_id', listId)
        .order('position');
      if (alive && data) setItems(data);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, listId]);

  const add = useCallback(async (text) => {
    const position = items.length;
    const row = {
      list_id: listId,
      user_id: userId,
      text: text || '',
      done: false,
      position,
    };
    const { data, error } = await supabase
      .from('thought_items').insert(row).select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
    return data;
  }, [items.length, listId, userId]);

  const toggle = useCallback(async (id) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const next = !current.done;
    const { error } = await supabase
      .from('thought_items')
      .update({ done: next })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: next } : i)));
  }, [items, userId]);

  const edit = useCallback(async (id, text) => {
    const { error } = await supabase
      .from('thought_items')
      .update({ text })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }, [userId]);

  const remove = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_items')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [userId]);

  return { items, loading, add, toggle, edit, remove };
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/hooks/useThoughtItems.test.js
```

Expected: PASS — 6 green tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useThoughtItems.js src/hooks/useThoughtItems.test.js
git commit -m "Add useThoughtItems hook — add, toggle, edit, remove"
```

---

## Task 5: `ThoughtsTab` component (TDD)

**Files:**
- Create: `src/components/ThoughtsTab.jsx`
- Test: `src/components/ThoughtsTab.test.jsx`

The tab takes the `useThoughtLists` hook result as a `listsHook` prop. Each list card (`ThoughtListCard`) instantiates `useThoughtItems(list.id)` internally — declared inside the same file.

UX scoping reminder (full detail in spec section 4):
- Subtitle, new-list entry, active cards, empty state, show-archived link, archived cards
- Each card: title, items, add-an-item input, edit toggle, mark-complete or restore button
- Edit mode reveals delete-list button + per-item × delete

- [ ] **Step 1: Write failing test**

Create `src/components/ThoughtsTab.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useThoughtItems so each card receives a canned per-list items hook.
const itemsByList = {};
function makeItemsHook(listId) {
  if (!itemsByList[listId]) itemsByList[listId] = { items: [], loading: false };
  const bucket = itemsByList[listId];
  return {
    items: bucket.items,
    loading: bucket.loading,
    add: vi.fn(async (text) => {
      bucket.items = [...bucket.items, { id: `i-${bucket.items.length}`, text, done: false, position: bucket.items.length }];
    }),
    toggle: vi.fn(async (id) => {
      bucket.items = bucket.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    }),
    edit: vi.fn(async (id, text) => {
      bucket.items = bucket.items.map((i) => (i.id === id ? { ...i, text } : i));
    }),
    remove: vi.fn(async (id) => {
      bucket.items = bucket.items.filter((i) => i.id !== id);
    }),
  };
}
vi.mock('../hooks/useThoughtItems.js', () => ({
  useThoughtItems: (listId) => makeItemsHook(listId),
}));

import ThoughtsTab from './ThoughtsTab.jsx';

function makeListsHook(over = {}) {
  return {
    active: [],
    archived: [],
    loading: false,
    create: vi.fn(async (title) => ({ id: 'L1', title, archived: false, archived_at: null, position: 0 })),
    rename: vi.fn(async () => {}),
    archive: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    removeList: vi.fn(async () => {}),
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const k of Object.keys(itemsByList)) delete itemsByList[k];
});

describe('ThoughtsTab', () => {
  it('renders the subtitle and empty state when there are no lists', () => {
    render(<ThoughtsTab listsHook={makeListsHook()} />);
    expect(screen.getByText(/Lists for what you're holding/i)).toBeTruthy();
    expect(screen.getByText(/Nothing here yet/i)).toBeTruthy();
  });

  it('new-list flow: tap "+ New list", enter a title, tap Done → calls create()', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook();
    render(<ThoughtsTab listsHook={listsHook} />);
    await user.click(screen.getByRole('button', { name: /\+ New list/i }));
    const input = await screen.findByPlaceholderText(/What is this/i);
    await user.type(input, 'Birthday party');
    await user.click(screen.getByRole('button', { name: /^Done$/ }));
    expect(listsHook.create).toHaveBeenCalledWith('Birthday party');
  });

  it('renders active list cards with title and items', async () => {
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Shopping', archived: false, archived_at: null, position: 0 }],
    });
    itemsByList['L1'] = { items: [
      { id: 'a', text: 'Milk', done: false, position: 0 },
      { id: 'b', text: 'Eggs', done: true,  position: 1 },
    ], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    expect(await screen.findByText('Shopping')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('Mark complete → calls archive(id)', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Done soon', archived: false, archived_at: null, position: 0 }],
    });
    render(<ThoughtsTab listsHook={listsHook} />);
    await user.click(screen.getByRole('button', { name: /Mark complete/i }));
    expect(listsHook.archive).toHaveBeenCalledWith('L1');
  });

  it('Show archived expands and shows archived lists with Restore', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      archived: [{ id: 'A1', title: 'Old', archived: true, archived_at: '2026-05-19T00:00:00Z', position: 0 }],
    });
    itemsByList['A1'] = { items: [{ id: 'x', text: 'thing', done: true, position: 0 }], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    expect(screen.queryByText('Old')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Show archived/i }));
    expect(await screen.findByText('Old')).toBeTruthy();
    const restoreBtn = screen.getByRole('button', { name: /^Restore$/i });
    await user.click(restoreBtn);
    expect(listsHook.restore).toHaveBeenCalledWith('A1');
  });

  it('edit mode reveals Delete list and per-item × buttons', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Editable', archived: false, archived_at: null, position: 0 }],
    });
    itemsByList['L1'] = { items: [{ id: 'a', text: 'one', done: false, position: 0 }], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    // The EditToggle component (src/components/Components.jsx) renders
    // the text "✎ Edit" when not editing and "Done" when editing.
    // Match the "Edit" substring — it's the only button containing it.
    const edit = screen.getByRole('button', { name: /Edit/i });
    await user.click(edit);
    expect(await screen.findByRole('button', { name: /Delete list/i })).toBeTruthy();
    // Item × delete carries aria-label "Delete item".
    expect(screen.getByLabelText(/Delete item/i)).toBeTruthy();
  });

  it('Show archived hides when archived.length is 0', () => {
    render(<ThoughtsTab listsHook={makeListsHook({ archived: [] })} />);
    expect(screen.queryByRole('button', { name: /Show archived/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/components/ThoughtsTab.test.jsx
```

Expected: FAIL — cannot resolve `./ThoughtsTab.jsx`.

- [ ] **Step 3: Implement the component**

Create `src/components/ThoughtsTab.jsx`:

```jsx
import { useState } from 'react';
import { Checkbox, EditToggle } from './Components.jsx';
import { useThoughtItems } from '../hooks/useThoughtItems.js';

export default function ThoughtsTab({ listsHook }) {
  const [newTitleOpen, setNewTitleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const handleCreate = async () => {
    const t = newTitle.trim();
    setNewTitle('');
    setNewTitleOpen(false);
    await listsHook.create(t);
  };

  const cancelNew = () => {
    setNewTitle('');
    setNewTitleOpen(false);
  };

  return (
    <div className="pt-6 px-5 pb-8">
      <p className="muted text-[12px] font-body italic font-display px-2 mb-5 leading-relaxed">
        Lists for what you're holding.
      </p>

      {/* New-list entry */}
      <div className="cream-card rounded-2xl border-soft px-5 py-4 mb-5">
        {newTitleOpen ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="edit-input ink text-[14px] font-body flex-1"
              placeholder="What is this?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') cancelNew();
              }}
            />
            <button
              onClick={cancelNew}
              className="font-display muted text-[10px] tracking-[0.22em] uppercase">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>
              Done
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewTitleOpen(true)}
            className="w-full text-left font-display rose-deep text-[12px] tracking-[0.22em] uppercase"
            style={{ fontWeight: 500 }}>
            + New list
          </button>
        )}
      </div>

      {/* Active lists */}
      {listsHook.active.length === 0 ? (
        <p className="muted text-[12px] font-body italic font-display text-center mt-12">
          Nothing here yet. Start one.
        </p>
      ) : (
        <div className="space-y-4">
          {listsHook.active.map((list) => (
            <ThoughtListCard
              key={list.id}
              list={list}
              mode="active"
              onRename={(t) => listsHook.rename(list.id, t)}
              onArchive={() => listsHook.archive(list.id)}
              onRestore={() => listsHook.restore(list.id)}
              onDeleteList={() => listsHook.removeList(list.id)}
            />
          ))}
        </div>
      )}

      {/* Show archived */}
      {listsHook.archived.length > 0 && !showArchived && (
        <div className="text-center mt-10">
          <button
            onClick={() => setShowArchived(true)}
            className="font-display rose text-[11px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Show archived ({listsHook.archived.length})
          </button>
        </div>
      )}

      {showArchived && (
        <>
          <div className="mt-10 border-t hairline" />
          <p className="muted text-[10px] tracking-[0.28em] uppercase font-body text-center mt-6 mb-4">
            Archived
          </p>
          <div className="space-y-4">
            {listsHook.archived.map((list) => (
              <ThoughtListCard
                key={list.id}
                list={list}
                mode="archived"
                onRename={(t) => listsHook.rename(list.id, t)}
                onArchive={() => listsHook.archive(list.id)}
                onRestore={() => listsHook.restore(list.id)}
                onDeleteList={() => listsHook.removeList(list.id)}
              />
            ))}
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => setShowArchived(false)}
              className="font-display muted text-[10px] tracking-[0.22em] uppercase">
              Hide archived
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ThoughtListCard({ list, mode, onRename, onArchive, onRestore, onDeleteList }) {
  const itemsHook = useThoughtItems(list.id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(list.title);
  const [newItemText, setNewItemText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isArchived = mode === 'archived';
  const titleClasses = isArchived
    ? 'font-display muted italic'
    : 'font-display ink';

  const commitTitle = () => {
    if (draftTitle !== list.title) onRename(draftTitle);
  };

  const addItem = async () => {
    const t = newItemText.trim();
    if (!t) return;
    setNewItemText('');
    await itemsHook.add(t);
  };

  const handleItemBlur = (item) => {
    if (item.text.trim() === '') itemsHook.remove(item.id);
  };

  return (
    <div className="cream-card rounded-2xl border-soft px-5 py-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        {editing && !isArchived ? (
          <input
            className="edit-input ink text-[18px] font-display flex-1"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            placeholder="Untitled"
            style={{ fontWeight: 400 }}
          />
        ) : (
          <div className={titleClasses} style={{ fontWeight: 400, fontSize: '18px' }}>
            {list.title || 'Untitled'}
          </div>
        )}
        {!isArchived && (
          <EditToggle editing={editing} onClick={() => {
            if (editing) commitTitle();
            setEditing((v) => !v);
          }} />
        )}
      </div>

      <div className="space-y-2">
        {itemsHook.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <button
              onClick={() => !isArchived && itemsHook.toggle(it.id)}
              disabled={isArchived}>
              <Checkbox done={it.done} />
            </button>
            {editing && !isArchived ? (
              <>
                <input
                  className="edit-input ink text-[14px] font-body flex-1"
                  value={it.text}
                  onChange={(e) => itemsHook.edit(it.id, e.target.value)}
                  onBlur={() => handleItemBlur(it)}
                />
                <button
                  onClick={() => itemsHook.remove(it.id)}
                  aria-label="Delete item"
                  className="muted text-base">×</button>
              </>
            ) : (
              <span className={`text-[14px] font-body flex-1 ${(it.done || isArchived) ? 'muted line-through' : 'ink'}`}>
                {it.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {!isArchived && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t hairline">
          <input
            className="bg-transparent outline-none ink text-[13px] font-body flex-1"
            placeholder="Add an item"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
          />
          <button
            onClick={addItem}
            disabled={!newItemText.trim()}
            className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
            style={{ fontWeight: 500, opacity: newItemText.trim() ? 1 : 0.3 }}>
            Add
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {editing && !isArchived ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="muted text-[11px] font-body italic">Delete this list?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="font-display muted text-[10px] tracking-[0.22em] uppercase">
                No
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setEditing(false);
                  onDeleteList();
                }}
                className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
                style={{ fontWeight: 500 }}>
                Delete list
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
              style={{ fontWeight: 500 }}>
              Delete list
            </button>
          )
        ) : (
          <span />
        )}
        {isArchived ? (
          <button
            onClick={onRestore}
            className="font-display rose text-[10px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Restore
          </button>
        ) : (
          <button
            onClick={onArchive}
            className="font-display rose text-[10px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Mark complete →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
npx vitest run src/components/ThoughtsTab.test.jsx
```

Expected: PASS — 7 green tests. If a test fails because of test-vs-implementation mismatch, fix the implementation, not the test (the test pins the spec'd UX). Note: the shared `EditToggle` (in `src/components/Components.jsx`) renders `✎ Edit` / `Done` — the test already accounts for this by matching the `/Edit/i` substring. Don't change `EditToggle`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThoughtsTab.jsx src/components/ThoughtsTab.test.jsx
git commit -m "Add ThoughtsTab — named lists, items, archive, restore"
```

---

## Task 6: Wire ThoughtsTab into App.jsx + add to nav

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the hook import**

In `src/App.jsx`, near the other hook imports, add:

```jsx
import { useThoughtLists } from './hooks/useThoughtLists.js';
import ThoughtsTab from './components/ThoughtsTab.jsx';
```

- [ ] **Step 2: Instantiate the hook**

Near other hook instantiations (around the lines that call `useKids()`, `useNotes()`, etc.), add:

```jsx
const thoughtListsHook = useThoughtLists();
```

- [ ] **Step 3: Mount the Thoughts tab body**

Find the spot in `App.jsx` where the tab branches live (`{activeNav === 'Girls' && (...)}`). Immediately before the `GIRLS` branch — so Thoughts renders just before Girls in source order — add:

```jsx
{/* THOUGHTS */}
{activeNav === 'Thoughts' && (
  <ThoughtsTab listsHook={thoughtListsHook} />
)}
```

- [ ] **Step 4: Update bottom-nav array**

Find the bottom-nav array (post-Task-2 it looks like this):

```jsx
{ id: 'Today', label: 'Today' },
{ id: 'Tidy', label: 'Tidy' },
{ id: 'Nourish', label: 'Nourish' },
{ id: 'Girls', label: 'Girls' },
```

Replace with:

```jsx
{ id: 'Today', label: 'Today' },
{ id: 'Tidy', label: 'Tidy' },
{ id: 'Nourish', label: 'Nourish' },
{ id: 'Thoughts', label: 'Thoughts' },
{ id: 'Girls', label: 'Girls' },
```

- [ ] **Step 5: Run the full test suite + build**

```bash
cd /Users/taylor/Code/maison-home
TZ=UTC npx vitest run
npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Mount ThoughtsTab in App; add Thoughts to bottom nav before Girls"
```

---

## Task 7: Manual end-to-end smoke

**No file changes in this task.**

After Task 6 ships, the working tree has the full Thoughts feature plus the Moments removal. Run the manual smoke before declaring done.

- [ ] **Step 1: Push or run locally**

Push to origin so Vercel auto-deploys, OR run locally with `npm run dev` to test against the dev server. Either works; the migration is already applied to the remote Supabase project so the cloud-backed flow works in both cases.

- [ ] **Step 2: Smoke the Thoughts tab**

Open the app, tap the Thoughts tab in the bottom nav (it should appear between Nourish and Girls). Verify:
- Subtitle says *Lists for what you're holding.*
- Empty state says *Nothing here yet. Start one.*
- Tap *+ New list*, enter "Groceries", tap Done. The list appears.
- Tap *Add* a few items: Milk, Eggs, Bread. Each appears stacked.
- Check off Milk. The text gets muted line-through.
- Tap the Edit toggle. Title becomes editable; items get × delete buttons; *Delete list* button appears at the bottom.
- Rename the list to "Weekly grocery". Blur. Title updates.
- Tap × next to one item. It disappears.
- Tap the Edit toggle again to leave edit mode.
- Tap *Mark complete →*. The list animates out.
- *Show archived (1)* appears at the bottom. Tap it.
- The archived list appears in the muted/italic state. Items show greyed.
- Tap *Restore*. List returns to active.
- Create a second list. In edit mode, tap *Delete list*. Confirm. List disappears.

- [ ] **Step 3: Confirm Moments is fully gone**

- The bottom nav has no Moments entry.
- No tab path goes to the old Moments UI.
- Visit `/api/share/sitter/anything` (if the sitter-share API route is deployed) — it should NOT reference moments anywhere.

- [ ] **Step 4: Confirm Today + Seventh-Day still work**

- Open Today tab. Notes section ("Hold this for me.") still works.
- If today is Sunday OR you can force `isSeventhDay()` (via dev), the Seventh-Day view renders the new placeholder copy *Rest is the work. Pick up tomorrow.* without crashing.

- [ ] **Step 5: Update memory**

After confirming, add a project memory file at `/Users/taylor/.claude/projects/-Users-taylor-Code-Mantle/memory/project_maison_thoughts_shipped.md` recording: ship date (2026-05-19), the replacement of Moments by Thoughts, and that the Moments table + bucket were dropped without preservation. Add a one-line pointer to `MEMORY.md`.

---

## Spec coverage map

| Spec section | Covered by |
|---|---|
| 2 In scope | Tasks 1, 2, 3, 4, 5, 6 |
| 3 Data model | Task 1 |
| 3 Encryption posture | Task 1 (plaintext text columns; documented in spec) |
| 3 Hooks API | Tasks 3 (lists), 4 (items) |
| 3 Component shape | Task 5 |
| 3 Removal of Moments | Task 2 |
| 4 UX (subtitle, new-list, cards, archive, restore) | Task 5 |
| 4 Tab order change | Tasks 2 (remove Moments entry) + 6 (add Thoughts before Girls) |
| 5 Security/RLS | Task 1 |
| 6 Vitest coverage | Tasks 3, 4, 5 |
| 6 Verification protocol | Task 7 |
| 7 Migration apply | Task 1 (steps 2-4) |

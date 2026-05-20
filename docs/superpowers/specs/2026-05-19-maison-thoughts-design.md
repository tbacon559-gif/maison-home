# Maison — Thoughts Tab (Design)

**Date:** 2026-05-19
**Status:** Approved — ready for plan
**Supersedes:** the Moments tab portion of `2026-05-19-maison-productize-design.md`
**Related:** `2026-05-18-maison-positioning-design.md` (voice)

---

## 1. Purpose

Replace the Moments tab with a Thoughts tab built for a SAHM's scattered head: named lists of items she's holding — birthday party shopping, ideas for next week, things she meant to remember about Ruth, anything ambiguous. When a list is done, she marks it complete and it goes to archive; she can look back later but it leaves the active surface.

The existing photo journal (Moments) ships out entirely — table dropped, Storage bucket emptied, hook + UI removed. Tiff is the only user and the data is roughly 24 hours old; the user has confirmed no preservation.

---

## 2. Scope

### In scope
- Two new tables: `thought_lists` (title + archived flag) and `thought_items` (text + done).
- Two new hooks: `useThoughtLists` and `useThoughtItems(listId)`.
- A new `ThoughtsTab.jsx` component containing the entire tab body.
- Bottom-nav update: new tab order `Today, Tidy, Nourish, Thoughts, Girls` (Thoughts placed *before* Girls, replacing Moments's slot then moved left one position).
- Complete removal of the Moments feature: table, Storage bucket, `useMoments` hook, photo-staging flow, share-moment flow, and the `moments` prop on `SeventhDay`.

### Out of scope (V1)
- Drag-to-reorder of lists or items (the `position` column exists for future use but is not exposed in UI).
- Permanent delete of archived lists. Archive is terminal; manual SQL only.
- Nested items, sub-lists, hierarchy of any kind.
- Photos, attachments, or media on items.
- Sharing (no sitter-share access; no `navigator.share`).
- Reminders, due dates, time-based metadata.
- Search.
- Tags or categories — the list's title is the only organizing axis.

### Explicit non-goals
- The Today-tab Notes section (`Hold this for me.`) is unchanged. Today-Notes stays as the quick-capture surface for fleeting items; Thoughts is for organized named lists. Two distinct surfaces, two purposes.

---

## 3. Architecture

### Data model

```sql
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
```

- `user_id` duplicated on `thought_items` so RLS doesn't need a join. Same pattern as `daily_tasks` / `weekly_tasks`.
- `archived_at` is set when `archived` transitions to true; cleared on restore. Used only for "look back" ordering in the archived view (most-recently-archived first).
- `position` exists for future drag-to-reorder; V1 always sets new rows to the trailing position and never exposes reordering.

### Encryption posture

Same as existing `notes` and `daily_tasks` tables. The current anon-auth state stores `text` plaintext under RLS. When email+password auth is revived (post-V1), the column transitions to `text_encrypted` along with the rest of the user-text columns. V1 ships plain `text`.

### Hooks

`src/hooks/useThoughtLists.js`:
- `active` — non-archived rows, ordered by `position` ascending.
- `archived` — archived rows, ordered by `archived_at` descending (most-recently-archived first).
- `loading`
- `create(title)` — inserts a new list, returns the row. `position` = max(position) + 1 among active.
- `rename(id, title)` — patches `title`.
- `archive(id)` — sets `archived = true`, `archived_at = now()`.
- `restore(id)` — clears `archived`, clears `archived_at`.
- `removeList(id)` — hard delete. Used only via the *Delete list* button in edit mode for active lists (not exposed for archived).

`src/hooks/useThoughtItems.js`:
- `items` for the given `listId`
- `loading`
- `add(text)` — appends; `position` = max(position) + 1 within the list.
- `toggle(id)`
- `edit(id, text)`
- `remove(id)`
- Empty-text items: the hook does NOT auto-remove. The component handles that on blur (the UX rule, not a hook invariant).

### Component

`src/components/ThoughtsTab.jsx` — the entire tab body. Receives the two hooks as props (instantiated in `App.jsx`). Internal state: which list is currently being created (input vs button), which list is in edit mode (`editingListId`), whether archive is expanded (`showArchived`).

App.jsx loses ~80 lines of Moments JSX and gains ~5 lines of `<ThoughtsTab ... />` mounting.

### Removal of Moments

Same migration drops the `moments` table and its bucket:

```sql
drop table public.moments;
delete from storage.objects where bucket_id = 'moments';
delete from storage.buckets where id = 'moments';
```

Code removals (all paths verified to exist):
- `src/hooks/useMoments.js` (delete). No corresponding test file exists.
- `useMoments` import + `momentsHook = useMoments()` line in `App.jsx`.
- The `MOMENTS` JSX block in `App.jsx` (the `activeNav === 'Moments' && (...)` branch).
- `pendingPhotos`, `fileInputRef`, `onPhotoPick`, `updatePending`, `cancelPending`, `saveAllPending` — the entire photo staging flow.
- `shareMoment`, `shareMomentStatus`, `deleteMomentLocal` handlers.
- `photoUrls` state + the `useEffect` that fetches photos for moments.
- `src/lib/photoCache.js` and `src/lib/photoCache.test.js` (delete both).
- The `moments` and `photoCache` props passed to `SeventhDay` in `App.jsx`. Update `src/components/SeventhDay.jsx` to drop those props from its signature; remove the moments rendering inside (the photo + caption loop) and any consumption of `photoCache`.

`src/data/initial.js` has been confirmed to contain no `INITIAL_MOMENTS` constant. No edits to that file.

---

## 4. UX

### Tab body (top to bottom)

1. **Subtitle.** *Lists for what you're holding.* — italic display font, muted, matches Maison voice (contemplative, plainspoken, no exclamation marks, no emoji). Same treatment as other tab subtitles.

2. **New-list entry.** A cream-card row at the top:
   - Default state: large *+ New list* button, rose-deep display caps, same shape as other "add" affordances.
   - Active state (after tap): an `edit-input` titled *What is this?* with a *Done* button. Submit → inserts a new list, switches the new list into edit mode, focuses the first item-add input. Cancel → reverts to default state without creating anything.
   - Empty title is allowed. A list with no title renders as *Untitled* in muted display.

3. **Active list cards.** Each list is a cream card, ordered by `position` ascending. Per card:
   - **Title** in display font 20px, top-left. In edit mode, an `edit-input` replaces the title text.
   - **Edit toggle** top-right, `EditToggle` component already in use.
   - **Items** below — each is a row: checkbox + text. Tap checkbox toggles `done`. Done items render `muted line-through` (matches Notes, Tidy, Grocery patterns).
   - **Add an item** input at the bottom of the card. Enter or *Add* button appends. Type, press Enter, type, press Enter — multiple items add fluidly.
   - In edit mode: title editable; each item text editable; per-item × delete; a *Delete list* button at the bottom (rose-deep small caps, confirms via one-tap modal *Delete this list? It can't be brought back.*). Hard delete only available for active lists.
   - **Mark complete →** in the bottom-right, always visible (single tap, no confirm — archive is recoverable). Sets `archived = true`, `archived_at = now()`. The card animates out and reappears below the archive divider when expanded.
   - Empty-text item on blur is auto-removed (no orphan blank rows).

4. **Empty state.** When no active lists exist:
   *Nothing here yet. Start one.* — muted italic display, centered, mt-12.

5. **Show archived link.** Always rendered at the bottom of the tab (even when 0 archived):
   - If `archived.length === 0` and `showArchived === false`: hidden entirely. (No "Show archived (0)" eyesore.)
   - If `archived.length > 0` and `showArchived === false`: *Show archived (n) →* as a quiet display button, rose, tracking caps.
   - If `showArchived === true`: archived lists render inline below the divider, then a *Hide archived* link at the bottom.

### Archived view

- Each archived list renders the same shell as active, with these differences:
  - Title rendered in muted italic display (signals dormant).
  - Items rendered muted; checkboxes still visible but tap-to-toggle is disabled.
  - In place of *Mark complete →*, a *Restore* button (rose, same caps style).
  - No Edit toggle, no *Delete list* button. Archived is terminal; permanent delete is a manual SQL operation in V1.

### Bottom nav

Order changes from `[Today, Tidy, Nourish, Girls, Moments]` to `[Today, Tidy, Nourish, Thoughts, Girls]`.

- `{ id: 'Thoughts', label: 'Thoughts' }` — no header transform needed (the header for `Girls` keeps its `'The Girls'` mapping; everything else renders the id directly per the post-rename header logic).

### Voice / typography

- Subtitle: italic display.
- Section labels stay restrained — no all-caps screaming, no exclamation marks anywhere.
- No streaks, no badges, no counts-as-metrics. The archive count is shown only as a wayfinding affordance.

---

## 5. Security & privacy

- RLS owner-only on both new tables (same policy shape as every other Maison table).
- `text` column is plaintext under anon auth (matches every other user-text column today). When email auth returns, a separate spec migrates all plaintext-text columns together to `text_encrypted`.
- Thoughts are not exposed via any sharing route — the sitter-share endpoint (in flight) reads only `kids`, `household_items`, `profiles.sitter_notes`, and `share_links.tonight_plan`. Thoughts stays private to the owner.
- The migration's drop-and-recreate of the `moments` Storage bucket permanently destroys all moments' photo objects. The user confirmed no preservation is required.

---

## 6. Testing

### Vitest (new)

- `src/hooks/useThoughtLists.test.js` — mocks supabase the same way `useShareLinks.test.js` does. Covers: create, rename, archive (sets archived + archived_at), restore (clears both), removeList, the active/archived split exposed by the hook.
- `src/hooks/useThoughtItems.test.js` — covers: add (positions appended), toggle, edit, remove.
- `src/components/ThoughtsTab.test.jsx` — `// @vitest-environment jsdom`, mocks the two hooks. Covers: empty state copy, new-list flow (input shows, submit creates), list edit mode (title editable, item delete button visible, *Delete list* button visible), mark-complete moves a list out of active, *Show archived* toggle reveals archived lists, *Restore* moves a list back to active.

### Vitest (removal of Moments)

- Delete `src/lib/photoCache.test.js`.
- No `useMoments.test.js` to delete (it doesn't exist).
- No `SeventhDay.test.jsx` to update (it doesn't exist either — the `SeventhDay` component is verified by manual smoke).
- Run the full suite; confirm no remaining test imports anything from `useMoments`, `photoCache`, or the moments JSX.

### Manual verification protocol

1. `TZ=UTC npx vitest run` → all tests pass.
2. `npm run build` → success.
3. Manual smoke on the deployed preview: create a list, add three items, check two, rename the list, tap Mark complete; expand *Show archived*; tap *Restore*; create a second list and delete it via edit mode. ~90 seconds.

---

## 7. Migration apply

User-driven, same as the share_links migration.

1. Paste the new-tables DDL + the moments drop into the Supabase SQL editor for project `hgkvxogtehyjdhjfexow`. Run.
2. Manually delete the `moments` Storage bucket from the dashboard (the SQL `delete from storage.buckets where id = 'moments';` may be blocked by FK on objects; if so, the dashboard's "Delete bucket" UI is the cleaner path).
3. Confirm both new tables exist via `list_tables` (or the dashboard's Table Editor).
4. Confirm RLS policies via:
   ```sql
   select polname, polcmd from pg_policy
   where polrelid in (
     'public.thought_lists'::regclass,
     'public.thought_items'::regclass
   );
   ```
   Expected: one row per table, `*` for cmd (a single `for all` policy).

---

## 8. Open questions

None blocking. Flagged for future:

- If Thoughts grows beyond ~50 active lists, the lack of search starts to bite. V2 might add a search bar at the top. Not in V1.
- Drag-to-reorder is the most likely V2 addition; the `position` column exists so this is purely a UI concern.
- If/when Tiff wants to share a list with someone (a shopping list with you, an idea list with a friend), the sitter-share architecture generalizes — `kind: 'thoughts'` on `share_links` + a new public route. Not in V1.
- Permanent delete of archived lists could be a small future addition (a *Delete forever* button in archived edit mode). Skipped V1 to keep archive purely soft.

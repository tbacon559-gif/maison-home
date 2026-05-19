# Maison — Sitter Sharing (Design)

**Date:** 2026-05-19
**Status:** Approved — ready for plan
**Supersedes:** none
**Related:** `2026-05-19-maison-productize-design.md` (auth, RLS conventions, hooks pattern)

---

## 1. Purpose

Give Tiff a way to send a sitter a single tap-to-open link that shows everything the sitter needs to know — the girls' particulars, household info, sitter notes, and an editable "tonight" plan — for the duration of an evening. The link expires on its own. No account creation, no friction, no signup wall on the sitter side.

This is the V1 of partner/sitter sharing called out as deferred work in the Productize V1 spec. V1 covers sitter only; spouse and family-helper sharing are out of scope.

---

## 2. Scope

### In scope
- A new "Sitter Card → Send a live link" flow in the Girls tab.
- A `share_links` table holding tokens, owner reference, tonight plan, expiry, and revocation timestamp.
- A public Vercel serverless route at `GET /api/share/sitter/[token]` that returns the data the sitter view needs.
- A public frontend route at `/share/sitter/:token` that renders the sitter view without auth context.
- 12h auto-expiry from creation. Manual "End now" revocation. Edit-in-place for tonight plan.
- Tests: component tests for owner modal and sitter view, smoke test for the API route, manual SQL check for RLS.

### Out of scope (V1)
- Spouse sharing, family-helper sharing, partner-with-richer-access sharing.
- Sitter write-back (notes, check-offs, any kind of input from the public page).
- Realtime push to the sitter view — the sitter refreshes the page to see edits.
- Re-share / extend — to extend, end the current link and create a new one.
- Sharing Moments, photos, meals, tidy state, or anything outside Girls/household/sitter_notes/tonight_plan.
- Notification when a sitter opens the link.
- iOS native shell behavior — works in any modern browser.
- Analytics on link opens.

### Explicit non-goals
- No registration, login, or PIN gate on the sitter side. The link itself is the credential.
- No additional share kinds yet, but the `kind` column on `share_links` is set up so future kinds (`spouse`, `family`) can be added without a schema migration.

---

## 3. Architecture

### Approach
Approach A from brainstorm: serverless route + dedicated `share_links` table. Sitter never queries Supabase directly. The serverless route uses the Supabase service-role key to validate the token and fetch the owner's data. RLS stays strict.

### Data flow

```
Owner (in app)            Supabase                 Sitter (public link)
─────────────             ────────                 ───────────────────
1. Open Girls tab
2. Tap "Send a live link"
3. Modal: enter tonight,
   tap Create
4. Client mints token
5. Insert share_links ──> RLS allows (owner_id=auth.uid())
6. Receive row back
7. Display URL +
   native share
                                                  8. Tap link
                                                  9. /share/sitter/:token
                                                     fetches API
10.                       <── /api/share/sitter/[token]
                          Service-role:
                          - look up token
                          - validate not expired, not revoked
                          - SELECT kids, profile, household
                            FOR owner_id
                          - return JSON
                                                  11. Render view
12. Owner edits
    tonight plan ────> UPDATE share_links via RLS
                                                  13. Sitter refreshes
                                                      → sees new plan
14. Owner taps "End now"
    ───────────> UPDATE share_links
                 SET revoked_at = now()
                                                  15. Sitter refreshes
                                                      → "This link has ended"
```

### Auth-context isolation
The current app auto-calls `signInAnonymously()` on first open via `<AuthProvider>` (see Productize V1 spec, post-launch pivot). The share route must NOT trigger that — otherwise every sitter who opens a link gets a stray anonymous Maison account in localStorage.

App.jsx routing splits at the top level:
- Paths matching `/share/sitter/:token` mount the share view directly, with no auth context.
- Everything else continues to mount `<AuthProvider>` as today.

The share view uses `fetch` against the API route; it never touches the Supabase client.

---

## 4. Data model

### New table: `share_links`

```sql
create table public.share_links (
  token       text primary key,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind = 'sitter'),
  tonight_plan text not null default '',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

create index share_links_owner_idx on share_links (owner_id, created_at desc);

alter table share_links enable row level security;

create policy "share_links owner select"
  on share_links for select
  using (owner_id = auth.uid());

create policy "share_links owner insert"
  on share_links for insert
  with check (owner_id = auth.uid());

create policy "share_links owner update"
  on share_links for update
  using (owner_id = auth.uid());

create policy "share_links owner delete"
  on share_links for delete
  using (owner_id = auth.uid());
```

There is no public/anon read policy. The serverless route uses the service-role key, which bypasses RLS.

### Token format
- Client-generated using `crypto.getRandomValues(new Uint8Array(32))` and base64url-encoded.
- 256 bits of entropy. URL-safe characters only (`A-Z a-z 0-9 - _`).
- Roughly 43 characters in the URL.

### Expiry
- `expires_at = created_at + interval '12 hours'`, set in the insert payload.
- Not extendable. The owner can edit `tonight_plan` but cannot change `expires_at`.

### Migration
A new file `supabase/migrations/0002_share_links.sql` containing the DDL and policies above. Apply via the Supabase MCP `apply_migration` tool or `supabase db push`.

---

## 5. API route

### `GET /api/share/sitter/[token]`

A Vercel serverless function at `api/share/sitter/[token].js`.

**Logic:**
1. Read `token` from the dynamic segment.
2. Connect to Supabase with the service-role key. This is the first server route in the repo to use it. New env var `SUPABASE_SERVICE_ROLE_KEY` must be added to Vercel (Production + Preview) and reflected in `.env.local` for local dev. Existing `api/calendar.js` does not use Supabase — no pattern to copy; create a small `api/_supabase.js` helper that exports a service-role client, so future server routes can reuse it.
3. `SELECT owner_id, tonight_plan, created_at, expires_at, revoked_at FROM share_links WHERE token = $1 AND kind = 'sitter'`.
4. If no row, or `revoked_at IS NOT NULL`, or `now() >= expires_at`: return `404` with body `{ status: "ended" }`.
5. Otherwise, in parallel (using the `owner_id` from share_links as the `user_id` for the data tables):
   - `SELECT greeting_name, sitter_notes FROM profiles WHERE id = owner_id`
   - `SELECT name, birthday, clothes_size, shoe_size, diaper_size, allergies FROM kids WHERE user_id = owner_id ORDER BY position`
   - `SELECT label, value FROM household_items WHERE user_id = owner_id ORDER BY position`
6. Return `200` with:
   ```json
   {
     "tonight_plan": "string",
     "sitter_notes": "string",
     "owner_name": "string",
     "kids": [
       { "name": "...", "birthday": "iso-date|null",
         "clothes_size": "...", "shoe_size": "...",
         "diaper_size": "...", "allergies": "..." }
     ],
     "household": [{ "label": "...", "value": "..." }],
     "created_at": "iso",
     "expires_at": "iso"
   }
   ```
   `owner_name` is taken from `profiles.greeting_name`. If null, the header on the sitter view falls back to "Tonight" (no possessive).
7. On any unexpected failure: `500` with `{ status: "error" }`.

**Cache:** `Cache-Control: no-store`. Live view requires fresh reads.

**CORS:** none — same-origin only. The frontend route is served from the same Vercel project.

**Rate limit:** none for V1. The token's 256 bits of entropy make brute force infeasible; one route with one query per request is a tiny surface.

---

## 6. Owner UX

### Where it lives
The Girls tab already has a "Sitter Card" section with one button labeled "Preview & Share →" (opens the static image card). That section grows to two stacked actions under the same heading:

- *Share as image →* (existing static modal, renamed for clarity)
- *Send a live link →* (new)

No new tab, no new top-level surface.

### Send-link modal — initial state
- Title: **A Live Link**
- One paragraph: *A page the sitter can pull up tonight. Closes itself in 12 hours.*
- Textarea labeled **Tonight** (empty by default; not prefilled from previous shares)
- Buttons: **Create link** (primary) / **Cancel**

### Send-link modal — ready state
After insert succeeds the modal swaps content:
- Title: **Ready**
- The full URL in a selectable, readable block
- **Copy link** button (uses `navigator.clipboard.writeText`)
- **Share** button (uses `navigator.share` when available; hidden when not)
- Quiet supporting line: *Ends 5:42 am.*
- **Done** button to close

### Active link panel
Below the two action buttons in the Sitter Card section, an "Active link" row appears when any of this owner's `share_links` rows is unexpired and unrevoked:

> Live until 5:42 am · *Edit* · *End now*

- **Edit** reopens the modal in its initial state with `tonight_plan` pre-filled and editable. Save updates the row and closes the modal — no transition to "ready" state.
- **End now** triggers a one-tap confirm (*"End this link?"*), then sets `revoked_at = now()` and removes the row from the panel.

If multiple active links exist (rare but possible), the panel lists each on its own row.

### Hook
New hook `useShareLinks` (matches the pattern of `useKids`, `useNotes`, etc. from Productize V1):
- `links` — array of `share_links` rows for this owner, ordered by `created_at desc`
- `active` — filtered to unrevoked + unexpired
- `create(tonightPlan)` — generates a token, inserts a row, returns the inserted row
- `updatePlan(token, tonightPlan)` — updates `tonight_plan` for the owner's row
- `revoke(token)` — sets `revoked_at = now()`

---

## 7. Sitter UX

### Page: `/share/sitter/:token`

Mounted outside `<AuthProvider>`. Fetches `/api/share/sitter/[token]` on mount with `Cache-Control: no-store`.

### Layout (cream background, body content in a single column, mobile-first)

1. **Header.** Display font: *[greeting_name]'s home — tonight.* If `greeting_name` is null, header is just *Tonight*.
2. **Tonight.** The plan text rendered with whitespace preserved (`white-space: pre-wrap`). Omitted entirely if empty.
3. **The girls.** Each kid as a cream card. Top row: name + computed age from birthday (e.g., "Ruth · 2 years"). Below: clothes size, shoe size, diaper size, allergies — each shown as a small label/value row, with empty fields hidden per-kid. Match the structure `buildSitterCardSVG` uses in `lib/svg.js` so the live view and the static image stay aligned.
4. **The house.** Household items rendered as label/value rows. Empty list → section omitted.
5. **Notes.** `profiles.sitter_notes` in italic display font, matching the Girls-tab rendering. Empty → section omitted.
6. **Footer.** Quiet line: *Live until 5:42 am.*

Typography and color match the rest of Maison — Fraunces for headings, body font for content, cream cards, no exclamation marks, no emojis.

### Ended / invalid state
For `404` (unknown token, expired, or revoked) the page renders a calm full-page state:

> *This link has ended.*
> Ask the parent for a new one.

No owner name, no retry button, no error code. Single state for all three cases — no enumeration.

### Server error state
For `500` or network error:

> *Something went wrong.*
> Try refreshing.

### Refresh model
No realtime, no polling. The sitter refreshes the page to see edits or revocation. Pull-to-refresh works natively on iOS Safari. No banner or instruction needed.

---

## 8. Security & privacy

- **Token entropy.** 256 bits of cryptographic randomness via `crypto.getRandomValues`. Brute force is infeasible.
- **Link secrecy.** Anyone with the link can read the sitter view's content. Same model as a Google Doc share link. The UI copy ("A page the sitter can pull up tonight") makes the model legible without being alarmist.
- **No data leakage on ended state.** The "ended" page never reveals the owner's name or whether the token ever existed. A random token returns the same page as a real-but-expired one.
- **Anon-account isolation.** The share route mounts outside `<AuthProvider>`. Visitors do not get an anonymous Maison account from opening a link.
- **Encryption boundary.** Kids, household items, and `sitter_notes` are plaintext in the DB under RLS — they always were, even when email+password auth was reachable. No encryption boundary issue for sitter sharing. If a future spec encrypts `sitter_notes` or adds encrypted "tonight" content, that's a V2 conversation; the service-role route cannot decrypt without the owner's key.
- **RLS.** `share_links` has owner-only read/write policies. The sitter never touches Supabase directly — only the serverless route does, with the service-role key.
- **Service-role key handling.** Stored only as a Vercel environment variable (`SUPABASE_SERVICE_ROLE_KEY`), never exposed to the client, never logged.

---

## 9. Testing

### Vitest component tests
- `src/components/SitterShareModal.test.jsx`
  - Empty initial state renders the textarea and Create button.
  - Create with empty plan succeeds (empty `tonight_plan` is allowed).
  - On submit, calls the `useShareLinks.create` hook with the plan text.
  - After create, modal swaps to ready state showing URL + copy + share buttons.
  - Edit flow: loads existing tonight_plan, on save calls `updatePlan`.
  - End now: confirm + `revoke` call.
- `src/pages/SitterShareView.test.jsx`
  - With mocked 200 response: renders header, tonight section, girls cards, household, notes, footer.
  - With empty tonight/notes/household: omits those sections.
  - With mocked 404: renders ended state with no owner name and no retry.
  - With mocked 500: renders server-error state.
  - Page renders without `<AuthProvider>` in its tree; confirms `signInAnonymously` is not called.

### API route smoke
- `api/share/sitter/[token].test.js` against a minimal mock of the Supabase service-role client:
  - Unknown token → 404
  - Expired token → 404
  - Revoked token → 404
  - Valid token → 200 with the documented JSON shape
  - Token missing from URL → 404

### Manual SQL — RLS
Commit a snippet at `supabase/checks/share_links_rls.sql` with two assertions runnable in the SQL editor:
1. As `anon` role, `select * from share_links` returns zero rows.
2. As `authenticated` role acting as user A, `select * from share_links where owner_id = '<B>'` returns zero rows when B has rows.

### Verification protocol
1. `npm test` passes (new tests above).
2. `npm run build` succeeds.
3. Single manual smoke on the deployed preview: create a share, open the URL in a private window on phone, confirm content; tap End now, refresh private window, confirm ended state.
4. Run the RLS SQL snippet, confirm both queries return zero rows.

---

## 10. Open questions

None blocking. Flagged for future:

- When/if email+password auth is revived and `sitter_notes` becomes E2E-encrypted, the service-role route cannot decrypt. That's a Productize V2 problem, not this spec's.
- If link opens become a useful signal ("did the sitter actually pull this up?"), an optional `last_opened_at` column on `share_links` updated by the API route is a small addition. Not in V1.
- Reusable named "templates" for tonight plans (e.g., "Standard bedtime") could reduce friction if Tiff is sharing often. Out of scope for V1; revisit if usage warrants.

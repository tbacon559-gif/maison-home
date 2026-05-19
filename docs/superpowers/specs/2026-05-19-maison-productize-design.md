# Maison — Productize Design

**Date:** 2026-05-19
**Status:** Approved design spec. Constraint document for the two downstream specs (Native Packaging, Feature Depth).
**Prior:** [Positioning & GTM Design](2026-05-18-maison-positioning-design.md) (2026-05-18). This spec inherits all positioning constraints — voice, audience, pricing, encryption boundary principles.
**Scope:** Accounts, cloud-primary data layer, selective E2E encryption, light onboarding, subscription state machine, one-time migration of existing local data. Not WHAT to charge (Positioning) or HOW to collect (Native Packaging).

---

## 1. System overview & scope

### In scope

- A fully separate Supabase project for Maison (auth, DB, Storage, RLS) — no shared infrastructure with Mantle.
- Account-required signup/signin via Supabase Auth, email + password only.
- A three-screen light onboarding (account → name → kids), with **skip-if-importing** behavior for users with existing local data.
- A cloud-primary data layer using per-table React hooks (`useDailyTasks`, `useMoments`, `useNotes`, etc.) that replace today's `usePersistedState` + `lsGet/lsSet`.
- Selective end-to-end encryption: Moments captions, Moments photo blobs, Quick Notes text. Everything else under RLS only.
- Photos stored in Supabase Storage (encrypted client-side), cached in IndexedDB after first load.
- A subscription state machine: `trialing` → `trial_expired` (soft-gate banner) / `active` / `hardship_granted` / `cancelled` / `hardship_pending`.
- Hardship Grant: "Request Access" link on signin, creates a flagged account, you approve manually via SQL.
- A `is_founding_member` column on `profiles`, written later by Native Packaging.
- One-time auto-import of any existing localStorage + IndexedDB data on first signup, triggered before onboarding.
- Account deletion (Settings → typed confirmation → cascade delete).

### Out of scope (deferred)

- **Payment collection** (Stripe-for-web, Apple IAP) → *Native Packaging* spec.
- **Native iOS shell, push notifications, App Store submission** → *Native Packaging* spec.
- **Founding-member enforcement** (the "first 200 paying users" rule) → enforced at payment time by *Native Packaging*.
- **Partner / sitter / spouse cloud sharing** → *Feature Depth* spec.
- **Recovery phrases for E2E content** → *Feature Depth*. V1 discloses the password-reset trade-off explicitly.
- **In-app admin UI for hardship requests** — manual SQL is sufficient at launch volume.
- **Email notifications** (welcome, hardship approval, trial ending) — manual for V1.
- **Search across encrypted content** — impossible server-side; client-side search lives in *Feature Depth*.
- **User-facing data export** — not in V1; deletion alone covers GDPR/CCPA hygiene at launch scale.
- **Realtime cross-device sync** — single user with two devices serially refetches on app open; that's enough.
- **AI features of any kind** — out, period. Matches Maison/Mantle V1 stance.

### Top-level architecture

Vite + React 18 client (unchanged framework). One new dependency: `@supabase/supabase-js`. No new serverless functions in Productize — the existing `api/calendar.js` proxy stays as-is. Server side is Supabase only.

---

## 2. Database schema

UUID primary keys throughout. Every table has Row-Level Security with policy `user_id = auth.uid()` for both read and write, unless noted.

### `profiles`

One row per user, paired 1:1 with `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | FK to `auth.users.id` |
| `created_at` | timestamptz | |
| `greeting_name` | text | Shown in "Good morning, ___" |
| `subscription_status` | text | Enum: `trialing | trial_expired | active | cancelled | hardship_granted | hardship_pending` |
| `trial_ends_at` | timestamptz | Set on signup to `now() + interval '14 days'` |
| `is_founding_member` | boolean default false | Set later by *Native Packaging* |
| `hardship_granted_until` | timestamptz nullable | Optional expiry on hardship grants; null = indefinite |
| `encryption_salt` | text | 16-byte random salt, base64 encoded. Immutable post-signup. |
| `calendar_url` | text nullable | Private iCal URL (the secret URL from Google Calendar). Plaintext under RLS. |
| `sitter_notes` | text nullable | Free-form text. Designed to be exported via Sitter Card; plaintext under RLS. |
| `last_daily_reset_date` | text | YYYY-MM-DD |
| `last_weekly_reset_date` | text | YYYY-MM-DD |

### `kids`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | → profiles.id |
| `position` | int | Display order |
| `name` | text | |
| `birthday` | date nullable | |
| `clothes_size` | text nullable | |
| `shoe_size` | text nullable | |
| `diaper_size` | text nullable | |
| `allergies` | text nullable | |
| `created_at` | timestamptz | |

### `household_items`

The "If You Need It" list (pediatrician, emergency contact, wifi, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `position` | int | |
| `label` | text | e.g., "Pediatrician" |
| `value` | text | e.g., "Dr. Smith — 555-1234" |

### `daily_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `slot` | text | Enum: `day | night` |
| `position` | int | |
| `label` | text | |
| `done` | boolean default false | |

### `weekly_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `position` | int | |
| `label` | text | |
| `done` | boolean default false | |

### `meals`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `day` | text | Enum: `Sun | Mon | Tue | Wed | Thu | Fri | Sat` |
| `slot` | text | Enum: `L | D` (breakfast was removed; current app has lunch + dinner only) |
| `text` | text | |

Constraint: `UNIQUE (user_id, day, slot)`. Writes are UPSERTs.

### `list_items`

Grocery list and to-buy list, partitioned by a `list` column.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `list` | text | Enum: `grocery | tobuy` |
| `position` | int | |
| `item` | text | |
| `got` | boolean default false | |

### `notes` (E2E encrypted)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `position` | int | |
| `text_encrypted` | text | `base64(iv ‖ ciphertext)`; client-side AES-256-GCM. |
| `done` | boolean default false | Plaintext — not sensitive. |
| `created_at` | timestamptz | |

### `moments` (E2E encrypted caption + photo)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `date_label` | text | The displayed date string (e.g., "Tue, Mar 5"). Plaintext for sort/display. |
| `caption_encrypted` | text | `base64(iv ‖ ciphertext)`. |
| `photo_storage_path` | text nullable | Path within Storage bucket: `{user_id}/{moment_id}.bin` |
| `created_at` | timestamptz | Used for ordering (most recent first). |

### `hardship_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | The pending account |
| `email` | text | Denormalized for admin convenience |
| `reason` | text nullable | Optional message from requester |
| `requested_at` | timestamptz | |
| `approved` | boolean default false | |
| `reviewed_at` | timestamptz nullable | |
| `granted_until` | date nullable | Optional; null = indefinite |
| `notes` | text nullable | Admin notes |

RLS: user can `INSERT` their own row but not `UPDATE`. Admin operations happen via Supabase SQL with the service role.

### Storage bucket `moments`

Private bucket. Path convention: `{user_id}/{moment_id}.bin`. RLS policy: read/write where `auth.uid()::text = (storage.foldername(name))[1]`. Files are raw bytes `iv ‖ ciphertext` — no metadata, no envelope.

### Indexes

- `(user_id, position)` on `kids`, `household_items`, `daily_tasks`, `weekly_tasks`, `list_items`, `notes`.
- `(user_id, created_at DESC)` on `moments`.
- Standard PK indexes elsewhere.

### Seed function

`seed_new_user(user_id UUID)` — Postgres function called from an `after insert` trigger on `profiles`. Populates the default daily/weekly tasks, meals, household-info labels, etc. (today's `INITIAL_*` data from `src/data/initial.js`).

---

## 3. Authentication & account lifecycle

### Provider

Supabase Auth. Single method: **email + password.** No OAuth.

Three reasons OAuth is out:
1. The audience expects email/password — every Christian-mom-resource site uses it. Sign-in-with-Google reads as "tech bro."
2. E2E encryption requires a password-derived key. OAuth doesn't expose a password to the client. Going OAuth would force per-device random keys with no cross-device sync.
3. App Store: Apple only mandates "Sign in with Apple" if you also offer Google/Facebook/etc. Email/password alone is allowed.

Password policy: 8 character minimum. No complexity gates.

### Signup → onboarding

Three screens, ~30 seconds total:

1. **Sign up.** Email + password. Terms-and-Privacy stub link. On submit:
   - Create `auth.users` row via Supabase Auth.
   - Insert `profiles` row with `subscription_status='trialing'`, `trial_ends_at = now() + 14 days`, random `encryption_salt`.
   - Derive encryption key from password + salt, hold in memory.
   - Run `seed_new_user()` trigger (default daily/weekly/meals/household labels).
   - **If `hasLocalData()` is true → skip onboarding entirely and run import (see Section 7).**
2. **"What should we call you?"** Single field → `profiles.greeting_name`. Continue.
3. **"Who do you tend to?"** Add 0–N children (name + birthday). Skip allowed. Each child becomes a row in `kids`.

After: land on Today tab.

### Signin

Email + password. Below the form: "Forgot password?" link, "Request Access (Hardship)" link.

On successful signin:
1. Fetch profile; derive encryption key from password + `profiles.encryption_salt`.
2. Check `effectiveStatus(profile)` (see Section 6):
   - `hardship_pending` → route to `<ReviewPendingScreen />`.
   - Anything else → route to Today tab.

### Hardship Request flow

Modal launched from signin screen. Fields: email, optional reason text.

On submit:
- Create auth user (Supabase signup with a system-generated placeholder password — the user gets a password-reset link on approval).
- Insert `profiles` row with `subscription_status='hardship_pending'`.
- Insert `hardship_requests` row.
- Show: *"Thank you. We'll be in touch."* Close modal.

You review via SQL: read pending rows, flip `subscription_status` to `hardship_granted`, optionally set `hardship_granted_until`, mark the `hardship_requests` row `approved=true`. Email the user a password-reset link manually.

### Password reset

Standard Supabase email-link flow.

**Honest UX wart:** When password changes, the old encryption key is unrecoverable. The reset screen surfaces this plainly:

> *Resetting your password will make your existing Moments and Quick Notes unreadable. They use a key that only your old password could unlock.*
>
> Options: **Reset and keep ciphertext** (in case you remember old password later) or **Reset and wipe encrypted data** (clean slate).

This is the same trade-off Mantle has. We don't hide it.

### Logout

Button in Settings. Clears Supabase session and the in-memory encryption key. Clears `cache.row_cache` and `photoCache`. Re-login required to read encrypted content.

### Account deletion

Settings → "Delete account" → typed-confirmation modal ("type DELETE to confirm"). Calls a Postgres function `delete_user_account()` (SECURITY DEFINER) that:

1. Deletes all rows in user-owned tables (cascades via FK).
2. Deletes the user's folder in the `moments` Storage bucket.
3. Deletes the `auth.users` row.

After: client clears all local state, returns to signin. Real legal hygiene. Ships in V1.

---

## 4. Encryption

The E2E surface is small and concrete: `notes.text_encrypted`, `moments.caption_encrypted`, and the photo blobs in the `moments` Storage bucket. Everything else stays plaintext under RLS.

### Primitives (Web Crypto API — no library)

- **Key derivation:** PBKDF2-HMAC-SHA256, 100,000 iterations. Inputs: user password + `profiles.encryption_salt` (16 bytes, base64). Output: 32-byte AES key.
- **Cipher:** AES-256-GCM. Authenticated; tampering is detected.
- **IV:** 12 bytes, randomly generated per encryption operation.

### Salt lifecycle

Generated client-side as 16 random bytes at signup, written to `profiles.encryption_salt`. Immutable for the lifetime of the user. Password reset rotates the password and therefore the derived key — but not the salt.

### Wire format

- **Text fields** (`notes.text_encrypted`, `moments.caption_encrypted`): `base64(iv ‖ ciphertext)` — single TEXT column.
- **Photo blobs in Storage:** raw bytes `iv ‖ ciphertext` written to `{user_id}/{moment_id}.bin`. No metadata, no envelope.

### Key lifecycle

- Derived at signup (from new password + new salt) and at every signin (from entered password + stored salt).
- Held in a module-level variable (`let key: CryptoKey | null = null`).
- Cleared on logout, on session expiry, on tab close.
- Never persisted to storage. Never logged. Never sent to the server.

### Photo flow

**Write:** `File → ArrayBuffer → AES-GCM encrypt → iv ‖ ct → Blob → Storage upload → moments row insert with photo_storage_path`.

**Read:** `Storage fetch (signed URL) → ArrayBuffer → split iv + ct → AES-GCM decrypt → ArrayBuffer → object URL → <img src>`.

**Cache:** Decrypted photo ArrayBuffers cached in IndexedDB keyed by `moment_id` after first decrypt. Cleared on logout.

### Performance

AES-GCM on Web Crypto is hardware-accelerated where available. ~50ms per 2MB photo on modern phones. Single-photo flows: imperceptible. Moments-scroll thumbnails: decrypt in viewport, lazy.

### Browser support

Web Crypto has been universal since ~2016. If `crypto.subtle` is undefined, app shows an unsupported-browser message rather than silently writing plaintext. Failure mode is refuse-to-save, not fall-back-to-cleartext.

### Implementation rule

**All Moments and Notes writes go through the encryption helper.** No code path writes plaintext to `text_encrypted` or `caption_encrypted` columns. Enforced by the helper signature: takes plaintext, returns ciphertext. No plaintext-passthrough mode.

---

## 5. Data layer

### Supabase client

Single instance at `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

Env vars in `.env.local` (gitignored) and Vercel project settings. No checked-in secrets.

### Auth surface

`src/lib/auth.jsx` exports:

- `<AuthProvider>` — wraps the app at the root.
- `useAuth()` — returns `{ session, userId, profile, effectiveStatus, encryptionKey, status, signIn, signUp, signOut, requestHardship, resetPassword, deleteAccount }`.

`status` is a discriminated string: `'loading' | 'signed_out' | 'onboarding' | 'authenticated'`. App-level routing keys off it.

`effectiveStatus` is computed from `profile.subscription_status` + dates (see Section 6).

`encryptionKey` is `null` until signin/signup completes.

### Per-table hooks

One hook per logical entity. Located in `src/hooks/`:

- `useProfile` — `{profile, updateGreetingName, updateCalendarUrl, updateSitterNotes, ...}`
- `useKids` — `{kids, add, edit, remove, reorder}`
- `useHouseholdItems` — same shape
- `useDailyTasks` — `{day, night, toggle, add, edit, remove}`
- `useWeeklyTasks` — `{tasks, toggle, add, edit, remove}`
- `useMeals` — `{meals, setMeal}`
- `useListItems(list)` — single hook, `list='grocery'` or `'tobuy'`, returns `{items, toggle, add, edit, remove}`
- `useNotes` — `{notes, toggle, add, edit, remove}` (encrypts on write, decrypts on read)
- `useMoments` — `{moments, add (with photo), remove, getPhoto}` (encrypts on write, decrypts on read)

### Canonical hook shape

```javascript
function useDailyTasks() {
  const { userId } = useAuth();
  const [state, setState] = useState({ day: [], night: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // 1. Cache-first render
      const cached = await cache.read('daily_tasks', userId);
      if (cached) {
        setState(groupBySlot(cached));
        setLoading(false);
      }
      // 2. Network fetch → reconcile + cache update
      const { data, error } = await supabase
        .from('daily_tasks').select('*').eq('user_id', userId)
        .order('slot').order('position');
      if (data) {
        setState(groupBySlot(data));
        await cache.write('daily_tasks', userId, data);
      }
      setLoading(false);
    })();
  }, [userId]);

  // Mutations: optimistic → network → revert on failure
  const toggle = async (slot, id) => { /* ... */ };
  const add = async (slot, label) => { /* ... */ };
  const edit = async (id, label) => { /* ... */ };
  const remove = async (id) => { /* ... */ };

  return { ...state, loading, toggle, add, edit, remove };
}
```

### Offline cache

`src/lib/cache.js` — single IndexedDB store named `row_cache`. Key: `${table}:${userId}`. Value: JSON array of rows.

Three exports: `cache.read(table, userId)`, `cache.write(table, userId, rows)`, `cache.clear()`. Cleared on logout.

### Photo cache

`src/lib/photoCache.js` — separate IndexedDB store. Key: `${userId}:${moment_id}`. Value: decrypted `ArrayBuffer`.

Three exports: `photoCache.getPhoto(momentId)`, `photoCache.put(momentId, buffer)`, `photoCache.clear()`. Hot path: `getPhoto` checks cache first, then fetches from Storage + decrypts on miss. Cleared on logout.

### Optimistic update pattern

`src/lib/optimistic.js` exposes `withOptimistic(setState, optimisticDelta, networkCall)`. Captures pre-state, applies delta, awaits network, restores pre-state and toasts an error on failure. Used by every mutation in every hook to keep the pattern DRY.

### What changes for consumers

- Today: `const [daily, setDaily] = usePersistedState('daily', INITIAL_DAILY); ... setDaily(p => ...)`.
- Productize: `const { day, night, toggle, add, edit, remove, loading } = useDailyTasks(); ... toggle('day', id)`.

Each consumer changes a small number of lines. The mutation API replaces ad-hoc `setX(p => ...)` calls with explicit named mutations.

### What stays sync (in plain `useState`)

Volatile UI state: `activeNav`, `showSettings`, `showSitterCard`, `editingNotes`, `editingDaily`, `keepReaderOpen`, etc. Only persisted data moves to hooks.

### Realtime

Not in V1. Single user with two devices serially refetches on app open via the useEffect — sufficient.

---

## 6. Subscription state machine

### States (`profiles.subscription_status`)

| State | Set by | Means |
|---|---|---|
| `trialing` | Signup (default) | First 14 days. Full app access. |
| `trial_expired` | Derived in JS (not stored) | `status='trialing' && trial_ends_at < now()`. Soft-gate banner; app still works. |
| `active` | *Native Packaging* (payment success) | Paying subscriber. Full access. No banner. |
| `cancelled` | *Native Packaging* (cancel at period end) | Treated identically to `trial_expired` in UX. |
| `hardship_pending` | Request Access form | Account exists, signin succeeds, then routes to a review-pending screen — not the product. |
| `hardship_granted` | Manual SQL by you | Full app access, no banner. `hardship_granted_until` may be set or null. |

### Effective status (not stored)

`trialing` and `hardship_granted` both age out over time. Rather than running a cron, `useAuth()` computes `effectiveStatus` on every profile read:

```javascript
function effective(profile) {
  const now = new Date();
  if (profile.subscription_status === 'trialing'
      && new Date(profile.trial_ends_at) < now) return 'trial_expired';
  if (profile.subscription_status === 'hardship_granted'
      && profile.hardship_granted_until
      && new Date(profile.hardship_granted_until) < now) return 'trial_expired';
  return profile.subscription_status;
}
```

Consumers read `effectiveStatus`. The raw column is only touched by writes.

### Transitions in Productize V1

| From | To | Trigger |
|---|---|---|
| — | `trialing` | Signup → `seed_new_user()` sets `trial_ends_at = now() + 14 days` |
| — | `hardship_pending` | Request Access form submit |
| `hardship_pending` | `hardship_granted` | You, via SQL, after reading the request |

### Transitions deferred to Native Packaging

- `trialing | trial_expired | cancelled` → `active` (payment success)
- `active` → `cancelled` (user cancellation at period end)
- Setting `is_founding_member = true` at payment time when paying-subscriber count < 200

### App-level gating

```
status === 'loading'                          → splash
status === 'signed_out'                       → <SigninScreen />
status === 'onboarding'                       → <OnboardingFlow />
status === 'authenticated':
  effectiveStatus === 'hardship_pending'      → <ReviewPendingScreen />
  effectiveStatus === 'trial_expired' ||
  effectiveStatus === 'cancelled'             → <MainApp /> + <TrialEndedBanner />
  else                                        → <MainApp />
```

### Banner copy (in voice)

> *Your trial has quietly ended. Subscribe to keep what you've kept.*
>
> Button: **Subscribe →** — opens a small modal: *Subscriptions arrive with the iOS app. Soon.*

Honest. No fake checkout. Banner is dismissible per-session; reappears on next signin until status flips.

### Review-pending screen

> *Your access request is being reviewed.*
>
> *We read each one personally. Most replies come within a few days. Thank you for your patience.*
>
> Sign out button.

### Founding member tracking

`profiles.is_founding_member` boolean default false. Productize exposes a small marker on the Settings screen ("✦ Founding member") when true. *Native Packaging* writes to the column.

---

## 7. Migration of existing local data

One-time auto-import, triggered after first signup completes, before onboarding. Targets Tiff today; future beta-testers who installed the PWA before Productize ships get the same path.

### Detection

`hasLocalData()` returns true if any of these localStorage keys exist with non-trivial content, OR if the IndexedDB `maison`/`photos` store has any rows:

```
maison.daily, maison.weekly, maison.meals, maison.groceries, maison.toBuy,
maison.notes, maison.girls, maison.household, maison.sitterNotes,
maison.moments, maison.settings, maison.lastDailyResetDate, maison.lastWeeklyResetDate
```

`maison.streak` is ignored — the streak system was cut in the positioning work, but old PWA installs may still have the key. Skip silently.

### Trigger

After signup form submitted and auth + profile rows created, BEFORE the 3-screen onboarding starts.

- `hasLocalData() === false` → run normal onboarding (name → kids → app).
- `hasLocalData() === true` → skip onboarding entirely. Run `importLocalData(userId, encryptionKey)`. On success, show a one-time toast on Today: *"Your existing data is here."* On any failure, surface a concrete error with a Retry button.

**Why skip onboarding for migrators:** Imported data already includes greeting name (from `maison.settings`), kids, household, sitter notes, etc. Running the wizard on top creates conflict.

### Per-key mapping

| Local key | Destination |
|---|---|
| `maison.daily` (`{day:[], night:[]}`) | `daily_tasks` rows; `slot` from key, `position` from array order |
| `maison.weekly` (array) | `weekly_tasks` rows; `position` from array order |
| `maison.meals` (`{Sun:{L,D}, ...}`) | `meals` rows (UPSERT) |
| `maison.groceries` (array) | `list_items` rows with `list='grocery'` |
| `maison.toBuy` (array) | `list_items` rows with `list='tobuy'` |
| `maison.notes` (array) | `notes` rows; text encrypted before insert |
| `maison.girls` (array) | `kids` rows |
| `maison.household` (array) | `household_items` rows |
| `maison.sitterNotes` (string) | `profiles.sitter_notes` |
| `maison.settings.calendarUrl` | `profiles.calendar_url` |
| `maison.lastDailyResetDate` | `profiles.last_daily_reset_date` |
| `maison.lastWeeklyResetDate` | `profiles.last_weekly_reset_date` |
| `maison.moments` (array) | `moments` rows; caption encrypted; photos read from IndexedDB, encrypted, uploaded to Storage |
| `maison.streak` | IGNORED |

### ID transformation

Old IDs (`Date.now() + Math.random()` floats) are dropped. Every new row gets a fresh UUID. The only cross-reference in the local schema is `moment.photoId` → IndexedDB key; resolved during the same loop.

### Photo migration

For each `moment` with a `photoId`:

1. Read dataUrl from IndexedDB.
2. Decode to `ArrayBuffer`.
3. AES-GCM encrypt with the new user's key.
4. Upload `iv ‖ ct` to Storage at `{user_id}/{new_moment_uuid}.bin`.
5. Insert moments row with `photo_storage_path = {user_id}/{new_moment_uuid}.bin`.

### Atomicity

No client-side transaction available across tables. Imports run sequentially per table. If a table fails mid-way, surface "Import had issues importing X. [Retry] [Skip rest]" — partial state is visible. Acceptable for a one-time, single-user-at-a-time operation.

### Post-import

- Set `localStorage.setItem('maison.imported_to_cloud', '1')` — never prompt again.
- Old localStorage and IndexedDB are **not deleted** — left as a safety net. (Optional Settings → "Clear local backup" button is *Feature Depth* if it ever ships.)

### Idempotency

If a user re-signs up on the same device (e.g., deleted account, started over), `maison.imported_to_cloud` blocks accidental double-import. Manual removal of the flag re-enables import.

---

## 8. Success criteria & out-of-scope

### V1 success — "shipped well" looks like

1. **Tiff signs up; auto-import works.** Her current PWA data (kids, meals, lists, sitter notes, calendar URL, Moments + photos, daily/weekly tasks) lands in her cloud account on first signup. She sees a familiar Today tab on first load.
2. **A new user signs up cleanly.** Email + password → onboarding (name → kids → in app) in under 60 seconds. Default seed data populates daily/weekly tasks, meals, household-info labels.
3. **Multi-device works.** Signed in on two devices; changes from device A appear on device B after refresh (no realtime push needed).
4. **E2E content is opaque server-side.** Inspecting `notes.text_encrypted` and `moments.caption_encrypted` rows in Supabase Studio shows base64 ciphertext, nothing legible. Storage `.bin` files are unrecognizable as images.
5. **Trial state machine is honest.** Day 0: no banner. Day 15: banner appears. Subscribe button shows "soon" modal — no fake checkout.
6. **Hardship flow works end-to-end.** Request Access submission lands a row; SQL approval flips status; user signs in and reaches the app.
7. **Offline tolerance.** Airplane mode after first load: cached lists render instantly. Writes surface a "you're offline" message rather than silently dropping.
8. **Account deletion works.** Settings → "Delete account" → typed confirmation → all user data and Storage blobs gone, auth row removed, can re-sign-up with same email.

### Fail signals — when we revisit the design, not just the code

- Signup → first signin takes more than 5 seconds end-to-end on a normal phone.
- Photo encrypt → upload of a 2MB image takes more than 3 seconds on broadband.
- Tiff's import loses any field she had before.
- Encryption produces decrypt errors on read after a clean signin (bug; should be zero).
- Multi-device sync drift exceeds one app-open cycle (changes vanish on refresh).

### Explicitly out of scope

- **Payment collection** (Stripe-for-web, Apple IAP) → *Native Packaging* spec.
- **Native iOS shell, push notifications, App Store submission** → *Native Packaging* spec.
- **Founding-member enforcement** (the "first 200 paying users" rule) → *Native Packaging*.
- **Partner / sitter / spouse cloud sharing** → *Feature Depth* spec.
- **Recovery phrases for E2E content** → *Feature Depth*. V1 ships with the password-reset trade-off disclosed.
- **In-app admin UI for hardship review** — manual SQL is sufficient at launch volume.
- **Email notifications** (welcome, hardship approval, trial ending) — manual for V1; automated arrives with *Native Packaging*.
- **Search across encrypted content** — impossible server-side; client-side search is *Feature Depth*.
- **User-facing data export** — not in V1; deletion alone covers GDPR/CCPA hygiene.
- **Realtime cross-device sync** — single user with two devices serially refetches on app open.
- **AI features of any kind** — out, period.

### Constraint discipline

**This spec is the constraint document for the next two specs.** *Native Packaging* and *Feature Depth* both read this one first; neither may contradict it. Revisiting any decision here is a Productize V2 conversation, not a sneak-in.

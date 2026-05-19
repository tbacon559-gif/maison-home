# Maison Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Maison PWA reflect the V1 positioning spec (`docs/superpowers/specs/2026-05-18-maison-positioning-design.md`) — cut what contradicts "homemaking as calling, not chore" (streaks, win counts, twee microcopy), reframe what stays, and add the two new surfaces (The Keep, The Seventh Day).

**Architecture:** Pure refactor + two small additions, all inside the existing Vite/React/PWA codebase. No backend. No accounts. No new dependencies. The streak module is the largest piece of cut work; the rest is targeted string rewrites and two new components. The Keep and Seventh Day both live in the existing IA — The Keep is reachable through a quiet weekly callout on the Today tab (no new bottom-nav slot); The Seventh Day is a conditional render mode on the Today tab triggered when `new Date().getDay() === 0`.

**Tech Stack:** Vite + React 18, Tailwind via CDN, localStorage + IndexedDB, vitest + React Testing Library, jsdom. No new libraries are added.

**Scope this plan does NOT cover** (each deferred to its own brainstorm/spec):
- Multi-user, accounts, sync, household onboarding → *Productize*
- Native packaging (Capacitor/SwiftUI), push, IAP → *Native packaging*
- Partner/sitter live sharing, push notifications, school calendars → *Feature depth*
- Marketing site, founding-member system, hardship-grant infrastructure → require accounts; live in *Productize*
- The actual full set of 30 welcome notes and 12 Keep essays (those are content the founder writes over weeks — this plan installs seeds in the right voice and a structure to add more)
- README rewrite (currently documents a single-user gift; rewrite belongs with *Productize* when the audience changes)

---

## File Structure

**Files this plan modifies:**

- `src/App.jsx` — remove streak state and effect; add Seventh Day conditional; rewrite Today-tab microcopy and footer; wire weekly Keep callout
- `src/components/TidyTab.jsx` — remove Streak card UI; remove streak imports/props; rewrite internal copy; rename header
- `src/components/KitchenTab.jsx` — rewrite empty-state copy
- `src/components/WelcomeOverlay.jsx` — no logic change; new copy comes via data file
- `src/data/initial.js` — remove `STREAK_THRESHOLD`, `GRACE_PER_MONTH`, `INITIAL_STREAK`; rename initial daily/weekly copy where needed
- `src/data/welcome.js` — replace contents with curated seed library in new voice

**Files this plan creates:**

- `src/lib/rollover.js` — pure functions for daily/weekly reset and Sunday detection (`resetDaily`, `resetWeekly`, `shouldResetDaily`, `shouldResetWeekly`, `isSeventhDay`)
- `src/lib/rollover.test.js` — vitest coverage
- `src/data/keep.js` — seed library of 3 short essays + helper to pick current-week reading
- `src/data/keep.test.js` — vitest coverage of essay-selection logic
- `src/components/KeepCallout.jsx` — small italicized "This week:" line that lives on the Today tab
- `src/components/KeepReader.jsx` — modal that displays one essay
- `src/components/KeepList.jsx` — list of all essays, reachable from the reader
- `src/components/SeventhDay.jsx` — Sunday quiet-mode replacement for the standard Today body

**Files this plan deletes:**

- `src/lib/streak.js`
- `src/lib/streak.test.js`
- All root-level duplicates: `App.jsx`, `Components.jsx`, `KitchenTab.jsx`, `SettingsModal.jsx`, `SitterCardModal.jsx`, `TidyTab.jsx`, `WelcomeOverlay.jsx`, `calendar.js`, `dates.js`, `ics.js`, `initial.js`, `main.jsx`, `storage.js`, `streak.js`, `svg.js`, `welcome.js` (vite entry is `./src/main.jsx`; root copies are stale duplicates, confirmed by `diff -q`)

**One file structure decision worth flagging:** `rollover.js` is a new module that absorbs the non-streak portions of `streak.js` (`resetDaily`, `resetWeekly`, `shouldResetWeekly`, plus new helpers `shouldResetDaily` and `isSeventhDay`). The streak file is being deleted entirely; we cannot leave those three functions stranded inside a deleted module. `rollover.js` is small (≤80 lines), single-purpose, and matches the existing `lib/` pattern.

---

## Task 1: Delete duplicate root-level source files

**Files:**
- Delete: `App.jsx`, `Components.jsx`, `KitchenTab.jsx`, `SettingsModal.jsx`, `SitterCardModal.jsx`, `TidyTab.jsx`, `WelcomeOverlay.jsx`, `calendar.js`, `dates.js`, `ics.js`, `initial.js`, `main.jsx`, `storage.js`, `streak.js`, `svg.js`, `welcome.js` (all at repo root)

These files are stale duplicates of the canonical sources under `src/`. The Vite entry in `index.html` is `./src/main.jsx`; nothing imports from the root copies. Deleting them eliminates a real future-bug risk (editing the wrong file).

- [ ] **Step 1: Confirm the duplicates are not imported anywhere**

Run from repo root:
```bash
grep -rn "from '\./App" --include="*.js" --include="*.jsx" . | grep -v node_modules | grep -v src/
grep -rn 'from "\./streak' --include="*.js" --include="*.jsx" . | grep -v node_modules | grep -v src/
```
Expected: no output. (If output appears, investigate before deleting.)

- [ ] **Step 2: Delete the root-level duplicate files**

```bash
cd /Users/taylor/Code/maison-home
rm App.jsx Components.jsx KitchenTab.jsx SettingsModal.jsx SitterCardModal.jsx \
   TidyTab.jsx WelcomeOverlay.jsx calendar.js dates.js ics.js initial.js \
   main.jsx storage.js streak.js svg.js welcome.js
```

- [ ] **Step 3: Verify the app still builds**

```bash
npm run build
```
Expected: build completes without errors (output to `dist/`).

- [ ] **Step 4: Verify the test suite still passes**

```bash
npm test
```
Expected: all tests pass (we have not touched src/ yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove duplicate root-level source files; canonical sources live under src/"
```

---

## Task 2: Create `src/lib/rollover.js` with date-rollover logic (TDD)

**Files:**
- Create: `src/lib/rollover.js`
- Create: `src/lib/rollover.test.js`

This module absorbs the three functions in `streak.js` that aren't actually streak logic (`resetDaily`, `resetWeekly`, `shouldResetWeekly`) and adds two new helpers (`shouldResetDaily`, `isSeventhDay`) needed for the post-streak rollover effect and for The Seventh Day. Pure functions, no React. Fully TDD.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/rollover.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  resetDaily,
  resetWeekly,
  shouldResetDaily,
  shouldResetWeekly,
  isSeventhDay,
} from './rollover.js';

// Tests assume TZ=UTC (set via the test script).

describe('resetDaily', () => {
  it('flips every day and night task to done=false', () => {
    const input = {
      day: [{ id: 1, label: 'a', done: true }],
      night: [{ id: 2, label: 'b', done: true }],
    };
    const out = resetDaily(input);
    expect(out.day[0].done).toBe(false);
    expect(out.night[0].done).toBe(false);
  });

  it('preserves task labels and ids', () => {
    const out = resetDaily({ day: [{ id: 7, label: 'wipe counters', done: true }], night: [] });
    expect(out.day[0]).toEqual({ id: 7, label: 'wipe counters', done: false });
  });

  it('returns empty arrays for missing keys', () => {
    expect(resetDaily({})).toEqual({ day: [], night: [] });
  });

  it('does not mutate the input', () => {
    const input = { day: [{ id: 1, label: 'a', done: true }], night: [] };
    resetDaily(input);
    expect(input.day[0].done).toBe(true);
  });
});

describe('resetWeekly', () => {
  it('clears done on every weekly task', () => {
    const out = resetWeekly([
      { id: 1, label: 'a', done: true },
      { id: 2, label: 'b', done: false },
    ]);
    expect(out.map((t) => t.done)).toEqual([false, false]);
  });

  it('does not mutate the input', () => {
    const input = [{ id: 1, label: 'a', done: true }];
    resetWeekly(input);
    expect(input[0].done).toBe(true);
  });
});

describe('shouldResetDaily', () => {
  it('returns false when no last reset date is recorded', () => {
    expect(shouldResetDaily(null, new Date(2026, 5, 10))).toBe(false);
    expect(shouldResetDaily(undefined, new Date(2026, 5, 10))).toBe(false);
    expect(shouldResetDaily('', new Date(2026, 5, 10))).toBe(false);
  });

  it('returns false when today is the same day as last reset', () => {
    expect(shouldResetDaily('2026-06-10', new Date(2026, 5, 10))).toBe(false);
  });

  it('returns true when today is a different day from last reset', () => {
    expect(shouldResetDaily('2026-06-09', new Date(2026, 5, 10))).toBe(true);
  });

  it('returns true across a month boundary', () => {
    expect(shouldResetDaily('2026-06-30', new Date(2026, 6, 1))).toBe(true);
  });
});

describe('shouldResetWeekly', () => {
  it('returns false when no last reset date is recorded', () => {
    expect(shouldResetWeekly(null, new Date(2026, 5, 10))).toBe(false);
    expect(shouldResetWeekly(undefined, new Date(2026, 5, 10))).toBe(false);
    expect(shouldResetWeekly('', new Date(2026, 5, 10))).toBe(false);
  });

  it('returns false when today is in the same week as last reset', () => {
    // 2026-06-10 is a Wednesday; 2026-06-08 is the Monday of that same week.
    expect(shouldResetWeekly('2026-06-08', new Date(2026, 5, 10))).toBe(false);
  });

  it('returns true when a Sunday boundary has been crossed', () => {
    // Last reset on Saturday 2026-06-06, today is Monday 2026-06-08 — crossed Sunday 2026-06-07.
    expect(shouldResetWeekly('2026-06-06', new Date(2026, 5, 8))).toBe(true);
  });

  it('returns false when checked on the same Sunday as last reset', () => {
    expect(shouldResetWeekly('2026-06-07', new Date(2026, 5, 7))).toBe(false);
  });

  it('returns true when checked the following Sunday', () => {
    expect(shouldResetWeekly('2026-06-07', new Date(2026, 5, 14))).toBe(true);
  });
});

describe('isSeventhDay', () => {
  it('returns true on Sunday', () => {
    // 2026-06-07 is a Sunday.
    expect(isSeventhDay(new Date(2026, 5, 7))).toBe(true);
  });

  it('returns false on Monday through Saturday', () => {
    for (let day = 1; day <= 6; day++) {
      const date = new Date(2026, 5, 7 + day); // 2026-06-08 (Mon) through 2026-06-13 (Sat)
      expect(isSeventhDay(date)).toBe(false);
    }
  });

  it('defaults to current date if no argument is passed', () => {
    const result = isSeventhDay();
    expect(typeof result).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rollover
```
Expected: FAIL with "Failed to load url ./rollover.js" or similar — module does not exist yet.

- [ ] **Step 3: Create `src/lib/rollover.js`**

Create `src/lib/rollover.js`:

```javascript
// ─── Date-rollover logic ──────────────────────────────────────────
// Pure functions. Decides when daily/weekly task lists should reset
// and whether today is the seventh day (Sunday, for The Seventh Day mode).
// Carved out of the deleted streak module — only the rollover bits survive.

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function resetDaily(daily) {
  return {
    day: (daily.day || []).map((t) => ({ ...t, done: false })),
    night: (daily.night || []).map((t) => ({ ...t, done: false })),
  };
}

export function resetWeekly(weekly) {
  return weekly.map((t) => ({ ...t, done: false }));
}

// Should we reset the daily list? True if we've crossed into a new day
// since the last check.
export function shouldResetDaily(lastDailyResetDate, today = new Date()) {
  if (!lastDailyResetDate) return false;
  return lastDailyResetDate !== ymd(today);
}

// Should we reset the weekly list? True if we've crossed a Sunday
// boundary since the last check.
export function shouldResetWeekly(lastWeeklyResetDate, today = new Date()) {
  if (!lastWeeklyResetDate) return false;
  const last = new Date(lastWeeklyResetDate + 'T00:00:00');
  const todaySunday = new Date(today);
  todaySunday.setDate(today.getDate() - today.getDay());
  todaySunday.setHours(0, 0, 0, 0);
  return last < todaySunday;
}

// Is today the seventh day (Sunday)? Drives The Seventh Day quiet mode
// on the Today tab.
export function isSeventhDay(today = new Date()) {
  return today.getDay() === 0;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- rollover
```
Expected: PASS for all describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rollover.js src/lib/rollover.test.js
git commit -m "Add rollover.js — date-based daily/weekly reset and Sunday detection"
```

---

## Task 3: Replace App.jsx day-rollover effect with rollover.js

**Files:**
- Modify: `src/App.jsx` (imports block; the day-rollover useEffect around lines 91-109; add a new persisted state for `lastDailyResetDate`)

The current effect calls `evaluateStreak`, which simultaneously updates the streak object AND returns a `shouldReset` flag. We're replacing it with two independent date checks against the persisted reset dates.

- [ ] **Step 1: Update the imports block in `src/App.jsx`**

Replace the line:
```javascript
import {
  evaluateStreak, resetDaily, resetWeekly, shouldResetWeekly,
} from './lib/streak.js';
```

With:
```javascript
import {
  resetDaily, resetWeekly, shouldResetDaily, shouldResetWeekly,
} from './lib/rollover.js';
```

- [ ] **Step 2: Add `lastDailyResetDate` to the persisted-state block**

Find the existing line (around line 42):
```javascript
const [lastWeeklyResetDate, setLastWeeklyResetDate] = usePersistedState('lastWeeklyResetDate', null);
```

Add immediately above it:
```javascript
const [lastDailyResetDate, setLastDailyResetDate] = usePersistedState('lastDailyResetDate', null);
```

- [ ] **Step 3: Replace the day-rollover effect**

Find the effect block (around lines 91-109) that begins `// ─── Day-rollover logic: evaluate streak, reset daily, maybe reset weekly ──`. Replace the entire effect with:

```javascript
  // ─── Day-rollover logic: reset daily on a new day, reset weekly on Sunday crossing ──
  // Run once per app open.
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Daily reset
    if (!lastDailyResetDate) {
      setLastDailyResetDate(todayStr);
    } else if (shouldResetDaily(lastDailyResetDate, today)) {
      setDaily(resetDaily(daily));
      setLastDailyResetDate(todayStr);
    }

    // Weekly reset
    if (!lastWeeklyResetDate) {
      setLastWeeklyResetDate(todayStr);
    } else if (shouldResetWeekly(lastWeeklyResetDate, today)) {
      setWeekly(resetWeekly(weekly));
      setLastWeeklyResetDate(todayStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Run the app and confirm it boots**

```bash
npm run dev
```
Expected: dev server starts; opening the printed URL in a browser shows the Today tab with no console errors. (Streak UI on Tidy tab still present — that's the next task.)

Stop the dev server (Ctrl+C).

- [ ] **Step 5: Run the test suite**

```bash
npm test
```
Expected: `streak.test.js` still passes (file still exists). All other tests pass. The `App.test.jsx` may or may not break depending on assertions — if it breaks, that means it was asserting on streak behavior and we'll fix it in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Wire App.jsx to rollover.js; add lastDailyResetDate"
```

---

## Task 4: Remove the Streak card UI from TidyTab

**Files:**
- Modify: `src/components/TidyTab.jsx` (remove the entire "Streak card" JSX block, lines ~45-112)

This deletes the visible streak card, the rest-day button, the progress bar, and the percent display. The component still receives streak props from App.jsx; we'll cut those in Task 5.

- [ ] **Step 1: Delete the Streak card JSX**

In `src/components/TidyTab.jsx`, delete the entire JSX block that starts with `{/* Streak card */}` (currently around line 45) and ends just before `{/* Daily — The Rhythm */}`. After deletion, the `return` statement should begin:

```javascript
  return (
    <div className="pt-6 px-5 pb-8">
      {/* Daily — The Rhythm */}
      <div className="cream-card rounded-2xl p-6 border-soft mb-5 fade-in" style={{ animationDelay: '0.05s' }}>
```

- [ ] **Step 2: Delete the now-unused local variables**

Inside the component body, delete these lines (near the top of the function):

```javascript
  const dailyDone = dailyAll.filter((t) => t.done).length;
  const dailyTotal = dailyAll.length;
  const pct = dailyPercent(daily);
  const dailyPct = Math.round(pct * 100);
  const meetingThreshold = pct >= STREAK_THRESHOLD;
  const grace = graceRemaining(streak);
```

Also delete:

```javascript
  const handleRestDay = () => {
    if (grace <= 0) return;
    if (!confirm("Bank today as a rest day? Your streak keeps going. Some days just are what they are.")) return;
    setStreak(takeRestDay(streak));
  };
```

And delete `const dailyAll = [...daily.day, ...daily.night];` if it's no longer referenced (verify with a quick grep: if `dailyAll` only appeared in the deleted lines above, it goes).

- [ ] **Step 3: Run the dev server, confirm Tidy tab still loads**

```bash
npm run dev
```
Expected: opening the Tidy tab shows the Daily and Weekly sections, but no Streak card above them. No console errors.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/TidyTab.jsx
git commit -m "Remove Streak card UI from TidyTab"
```

---

## Task 5: Remove streak imports, props, and state from TidyTab and App.jsx

**Files:**
- Modify: `src/components/TidyTab.jsx` (imports and props)
- Modify: `src/App.jsx` (state declaration, TidyTab prop passing)

Cuts the remaining wiring. After this task the streak module is no longer imported by any live code.

- [ ] **Step 1: Remove streak imports from TidyTab**

In `src/components/TidyTab.jsx`, delete these import lines at the top:

```javascript
import { takeRestDay, graceRemaining, dailyPercent } from '../lib/streak.js';
import { STREAK_THRESHOLD, GRACE_PER_MONTH } from '../data/initial.js';
```

- [ ] **Step 2: Remove streak props from TidyTab signature**

In `src/components/TidyTab.jsx`, change the props destructure:

```javascript
export default function TidyTab({
  daily, setDaily,
  weekly, setWeekly,
  streak, setStreak,
  editingDaily, setEditingDaily,
  editingWeekly, setEditingWeekly,
}) {
```

To:

```javascript
export default function TidyTab({
  daily, setDaily,
  weekly, setWeekly,
  editingDaily, setEditingDaily,
  editingWeekly, setEditingWeekly,
}) {
```

- [ ] **Step 3: Remove streak state from App.jsx**

In `src/App.jsx`, delete this line from the persisted-state block:

```javascript
const [streak, setStreak] = usePersistedState('streak', INITIAL_STREAK);
```

Also remove `INITIAL_STREAK` from the import statement at the top of the file:

```javascript
import {
  INITIAL_DAILY, INITIAL_WEEKLY, INITIAL_STREAK,
  INITIAL_MEALS, INITIAL_GROCERIES, INITIAL_TOBUY, INITIAL_NOTES,
  INITIAL_GIRLS, INITIAL_HOUSEHOLD, INITIAL_SITTER_NOTES,
  INITIAL_MOMENTS, INITIAL_SETTINGS,
} from './data/initial.js';
```

Becomes:

```javascript
import {
  INITIAL_DAILY, INITIAL_WEEKLY,
  INITIAL_MEALS, INITIAL_GROCERIES, INITIAL_TOBUY, INITIAL_NOTES,
  INITIAL_GIRLS, INITIAL_HOUSEHOLD, INITIAL_SITTER_NOTES,
  INITIAL_MOMENTS, INITIAL_SETTINGS,
} from './data/initial.js';
```

- [ ] **Step 4: Remove streak from the TidyTab JSX usage in App.jsx**

Find (around line 417-423):

```javascript
          {activeNav === 'Tidy' && (
            <TidyTab
              daily={daily} setDaily={setDaily}
              weekly={weekly} setWeekly={setWeekly}
              streak={streak} setStreak={setStreak}
              editingDaily={editingDaily} setEditingDaily={setEditingDaily}
              editingWeekly={editingWeekly} setEditingWeekly={setEditingWeekly}
            />
          )}
```

Replace with:

```javascript
          {activeNav === 'Tidy' && (
            <TidyTab
              daily={daily} setDaily={setDaily}
              weekly={weekly} setWeekly={setWeekly}
              editingDaily={editingDaily} setEditingDaily={setEditingDaily}
              editingWeekly={editingWeekly} setEditingWeekly={setEditingWeekly}
            />
          )}
```

- [ ] **Step 5: Run the dev server, confirm app boots**

```bash
npm run dev
```
Expected: app boots, Today and Tidy tabs both render, no console errors. Stop the server.

- [ ] **Step 6: Run the test suite**

```bash
npm test
```
Expected: `TidyTab.test.jsx` may fail if it was asserting on streak UI (likely). Read the failures and update them — the assertions for the deleted Streak card, "X days strong", "Rest day" button, and percent bar should all be removed. Keep the assertions for Daily and Weekly task editing/toggling. `streak.test.js` still passes (file still present). Re-run until green.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/TidyTab.jsx src/components/TidyTab.test.jsx
git commit -m "Cut streak state, props, and imports — TidyTab and App.jsx no longer reference streak"
```

---

## Task 6: Delete streak.js, streak.test.js, and streak constants from initial.js

**Files:**
- Delete: `src/lib/streak.js`
- Delete: `src/lib/streak.test.js`
- Modify: `src/data/initial.js` (remove `STREAK_THRESHOLD`, `GRACE_PER_MONTH`, `INITIAL_STREAK`)

At this point nothing imports from streak.js anymore. Confirm and remove.

- [ ] **Step 1: Confirm streak.js has no remaining importers**

```bash
cd /Users/taylor/Code/maison-home
grep -rn "from '.*streak" --include="*.js" --include="*.jsx" src/
```
Expected: only matches inside `src/lib/streak.js` and `src/lib/streak.test.js`. If there are matches in other files, that import must be cleaned up first (Task 5 was incomplete).

- [ ] **Step 2: Delete the streak files**

```bash
rm src/lib/streak.js src/lib/streak.test.js
```

- [ ] **Step 3: Remove streak constants from `src/data/initial.js`**

Delete this entire block from `src/data/initial.js`:

```javascript
// ─── Streak settings ─────────────────────────────────────────────
export const STREAK_THRESHOLD = 0.8;
export const GRACE_PER_MONTH = 2;

export const INITIAL_STREAK = {
  current: 0,
  best: 0,
  lastCheckedDate: null,
  graceUsedThisMonth: 0,
  graceMonth: null,
};
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```
Expected: all tests pass. The data test (`src/data/data.test.js`) may assert on `INITIAL_STREAK` — if so, remove that assertion.

- [ ] **Step 5: Run the build**

```bash
npm run build
```
Expected: clean build. No "imported X is not defined" errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete streak.js, streak.test.js, and streak constants — streak system fully removed"
```

---

## Task 7: Replace Today tab's "Today's Wins" footer with "Today's Work"

**Files:**
- Modify: `src/App.jsx` (the Today tab footer block around lines 401-411)
- Modify: `src/App.jsx` (remove now-unused `dailyDone` / `dailyAll` if no other reference)

The current footer uses a big right-aligned count of tasks done. Per spec, the count goes away and is replaced with a single hand-written line of acknowledgment that varies by time of day. The acknowledgment line lives inline in App.jsx as a small helper function — small enough not to warrant its own file.

- [ ] **Step 1: Add a helper function above the `App` component**

In `src/App.jsx`, immediately above the `export default function App()` line (around line 36), add:

```javascript
function todaysWorkLine(hour = new Date().getHours()) {
  if (hour < 11) return 'A morning to begin gently.';
  if (hour < 14) return 'The middle of a day, held.';
  if (hour < 18) return 'An afternoon, kept as it is.';
  if (hour < 21) return 'An evening softening down.';
  return 'A late hour. Be kind to it.';
}
```

- [ ] **Step 2: Replace the "Today's Wins" JSX block**

In `src/App.jsx`, find the Today tab footer block (around lines 401-411):

```javascript
              {/* Today's Wins */}
              <div className="mx-7 mb-8 mt-2 pt-5 border-t hairline fade-in">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="muted text-[10px] tracking-[0.28em] uppercase font-body">Today's Wins</div>
                    <div className="muted text-[12px] font-body mt-2" style={{ maxWidth: '230px' }}>
                      {dailyDone > 0 ? `${dailyDone} task${dailyDone > 1 ? 's' : ''} done · keep going.` : 'Every small thing counts.'}
                    </div>
                  </div>
                  <div className="font-display rose-deep" style={{ fontWeight: 400, fontSize: '36px', lineHeight: 1 }}>{dailyDone}</div>
                </div>
              </div>
```

Replace with:

```javascript
              {/* Today's Work */}
              <div className="mx-7 mb-8 mt-2 pt-5 border-t hairline fade-in">
                <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">Today's Work</div>
                <p className="font-display ink text-[15px] leading-snug" style={{ fontStyle: 'italic', fontWeight: 400 }}>
                  {todaysWorkLine()}
                </p>
              </div>
```

- [ ] **Step 3: Remove the now-unused `dailyDone` and `dailyAll` variables**

In `src/App.jsx`, find these two lines (around lines 79-80, inside the App function body):

```javascript
  const dailyAll = [...daily.day, ...daily.night];
  const dailyDone = dailyAll.filter((t) => t.done).length;
```

Confirm with a grep that neither `dailyAll` nor `dailyDone` is used elsewhere in the file:

```bash
grep -n "dailyAll\|dailyDone" src/App.jsx
```

If only the two declaration lines appear in the grep output, delete them. (`notesActive` on the next line stays — it's used elsewhere.)

- [ ] **Step 4: Run the dev server**

```bash
npm run dev
```
Expected: open the Today tab. The footer shows "TODAY'S WORK" + an italicized acknowledgment line (varies by time of day). No big number. No console errors.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "Replace Today's Wins counter with Today's Work — time-of-day acknowledgment"
```

---

## Task 8: Voice sweep across remaining microcopy

**Files:**
- Modify: `src/App.jsx` (multiple inline strings)
- Modify: `src/components/KitchenTab.jsx` (empty-state copy)
- Modify: `src/components/TidyTab.jsx` (subtitle/empty-state copy — header rename happens in Task 9)

Per the spec's "Voice in practice" table plus the voice rules ("no cute/twee, no productivity-bro, no exclamation, no cheerful"), rewrite every microcopy string that contradicts the voice. This is a focused string-pass; no logic changes.

- [ ] **Step 1: Update `src/App.jsx` microcopy**

Apply these exact string replacements in `src/App.jsx`:

| Find (old string) | Replace with (new string) |
|---|---|
| `Connect your Google Calendar in settings to see what's coming up.` | `Connect a calendar in settings to see what's coming.` |
| `Couldn't load events. Check the URL in settings.` | `Couldn't reach the calendar. Try again, or check settings.` |
| `Nothing coming up.` | `Nothing on the calendar.` |
| `Don't forget…` | `Hold this for me.` |
| `A clear head. Nothing pending.` | `Nothing pending. A quiet head.` |
| `Sizes, allergies, the essentials. Everything a sitter or grandma might need.` | `The particulars. What a sitter or a grandparent might want to know.` |
| `Share everything above as one beautiful image. AirDrop to grandma, text to a sitter.` | `Share the particulars as one image. AirDrop, text, however.` |
| `The good stuff. Capture it before you forget.` | `The ordinary, before it goes.` |
| `Tap "Today's Photos" to start your journal.` | `When something matters today, keep it here.` |
| `A few words for each…` | `A few words for each.` |
| `What was this?` | `What was this.` |
| `Naps, routines, snack rules, anything they should know…` | `Naps, routines, anything they should know.` |

- [ ] **Step 2: Update `src/components/KitchenTab.jsx` microcopy**

Apply these exact string replacements in `src/components/KitchenTab.jsx`:

| Find (old string) | Replace with (new string) |
|---|---|
| `Meals, groceries, and what else needs grabbing. Tap a section to open.` | `Feeding people. Lists for the week.` |
| `this week's plan` | `who's home for dinner?` |
| `${groceries.filter((g) => !g.got).length} left · this week` | `${groceries.filter((g) => !g.got).length} left` |
| `+ Add grocery item` | `+ Add to the list` |
| `${toBuy.filter((g) => !g.got).length} left · everything else` | `${toBuy.filter((g) => !g.got).length} left` |
| `Household supplies, gifts, things she'll grab when she's at Target.` | `Household supplies. Gifts. Things to pick up.` |
| `+ Add to-buy item` | `+ Add to the list` |
| `Item…` | `Item.` |

The `Nothing yet.` empty state and the section labels (`Meals`, `Grocery List`, `To-Buy`, `Lunch`, `Dinner`) stay as written — already in voice.

Note: the two ``+ Add to the list`` lines are intentionally identical; the section context (Grocery vs To-Buy) makes the meaning clear without needing to repeat the noun.

- [ ] **Step 3: Update `src/components/TidyTab.jsx` microcopy (subtitles and empty states only — header rename is Task 9)**

In `src/components/TidyTab.jsx`, replace these strings:

| Find | Replace with |
|---|---|
| `Resets every day at midnight. Same list, fresh slate.` | `A new day, returned to.` |
| `When there's a window. Resets every Sunday.` | `When there's a window. A week's wider arc.` |
| `quick wins` | `the small turns` |
| `after they're down` | `after they're down` *(keep — this one's already right)* |
| `+ Add weekly task` | `+ Add to the week` |
| `+ Add daytime task` *(generated by template)* | leave the template; it produces `+ Add [title] task` which becomes `+ Add daytime task` and `+ Add tonight task` — these read fine. |

- [ ] **Step 4: Run the dev server and walk every tab**

```bash
npm run dev
```
Expected: open Today, Tidy, Kitchen, Girls, Moments. Every visible string should read in the new voice. No old "Don't forget…" or "Capture it before you forget" or similar. Stop the server.

- [ ] **Step 5: Run the test suite**

```bash
npm test
```
Expected: any tests asserting on the old string literals (likely in `App.test.jsx`, `KitchenTab.test.jsx`, `TidyTab.test.jsx`) will fail. Update the assertions to match the new strings. Re-run until green.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/KitchenTab.jsx src/components/TidyTab.jsx \
        src/App.test.jsx src/components/KitchenTab.test.jsx src/components/TidyTab.test.jsx
git commit -m "Voice sweep — rewrite microcopy across Today, Tidy, Kitchen"
```

---

## Task 9: Rename Tidy tab → The Keeping (and reframe its header)

**Files:**
- Modify: `src/App.jsx` (bottom-nav label, the activeNav comparison string, header rendering)
- Modify: `src/components/TidyTab.jsx` (any internal references to the tab name)

The spec calls this rename "workshopped." Locking in **The Keeping**. If a different word is preferred, replace the string `'The Keeping'` everywhere in this task before running.

Note: this rename does NOT change the `activeNav === 'Tidy'` comparison's identifier in code unless we want to. Simpler: keep the internal identifier as `'Tidy'` and only change the display label. That way no other state/handler code breaks.

- [ ] **Step 1: Update the bottom-nav label in `src/App.jsx`**

Find (around line 649):
```javascript
            {['Today', 'Tidy', 'Kitchen', 'Girls', 'Moments'].map((label) => {
```

This is the source of both the display label AND the activeNav identifier. To allow the display name to differ from the internal identifier, change the structure:

```javascript
            {[
              { id: 'Today', label: 'Today' },
              { id: 'Tidy', label: 'The Keeping' },
              { id: 'Kitchen', label: 'Kitchen' },
              { id: 'Girls', label: 'Girls' },
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
```

(This replaces the entire `{[...].map(...)}` block in the bottom nav.)

- [ ] **Step 2: Update the non-Today header rendering in `src/App.jsx`**

Find (around line 290):
```javascript
            <h2 className="font-display ink" style={{ fontWeight: 400, fontSize: '24px' }}>
              {activeNav === 'Girls' ? 'The Girls' : activeNav}
            </h2>
```

Replace with:
```javascript
            <h2 className="font-display ink" style={{ fontWeight: 400, fontSize: '24px' }}>
              {activeNav === 'Girls' ? 'The Girls' :
               activeNav === 'Tidy'  ? 'The Keeping' : activeNav}
            </h2>
```

- [ ] **Step 3: Run the dev server and confirm rename is visible**

```bash
npm run dev
```
Expected: bottom nav shows "THE KEEPING" instead of "TIDY"; tapping it opens the same tab; the header at the top of that tab reads "The Keeping." Stop the server.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```
Expected: any test that looked for the literal "Tidy" in rendered DOM will fail. Update those assertions to look for "The Keeping." (The internal `'Tidy'` identifier hasn't changed, so tests that interact with state by identifier still work.)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/TidyTab.test.jsx src/App.test.jsx
git commit -m "Rename Tidy tab display label to The Keeping; internal identifier unchanged"
```

---

## Task 10: Replace welcome.js with curated seed library in new voice

**Files:**
- Modify: `src/data/welcome.js` (replace contents)

The current file has 50 messages; several are explicitly cute/twee ("Today's forecast: 100% chance of being needed for snacks", "You've changed approximately 14,000 diapers"). Per spec voice rules: cut everything that's hashtag-mom, cute, performative, or addressed in productivity-bro register. Keep what's contemplative.

This task installs a **seed library of 10 messages** in the right voice — 6 carried over from the original (the ones that already fit) and 4 new ones written in the register. The founder will expand to ~30 over time; the file's top comment explains how.

- [ ] **Step 1: Replace `src/data/welcome.js` with the seed library**

Open `src/data/welcome.js` and replace its entire contents with:

```javascript
// ─── Welcome messages library ─────────────────────────────────────
// A short message is shown each time the app is opened. The whole
// library is read aloud over a long time; the goal is for any one of
// these to feel sturdy in a tired moment.
//
// Voice rules (from positioning spec, May 2026):
//   - Contemplative. Dignified. Quiet beats cheerful.
//   - No exclamation marks. No hashtag-mom. No "you got this."
//   - Borrow the cadence of Wendell Berry, Tish Warren, Mary Oliver.
//   - The work of the home is real work. We never speak down to it.
//
// To add a message: append to the array below. Aim for short — one
// breath. Attribution is optional.

export const WELCOME_MESSAGES = [
  { eyebrow: 'A reminder', body: 'Rest is not a reward for finishing. It is part of the work.' },
  { eyebrow: 'A reminder', body: 'Slow is okay. Small is okay. Showing up is the whole thing.' },
  { eyebrow: 'A reminder', body: 'You are allowed to be tired. You are allowed to be human.' },
  { eyebrow: 'A reminder', body: 'Imperfect days still count. They might count the most.' },
  { eyebrow: 'A small thought', body: 'Do small things with great love.', attribution: '— Mother Teresa' },
  { eyebrow: 'A small thought', body: 'There is no way to be a perfect mother, and a million ways to be a good one.', attribution: '— Jill Churchill' },
  { eyebrow: 'For today', body: 'Choose one thing and let the rest go.' },
  { eyebrow: 'For today', body: 'The work of the home is real work. So is the rest from it.' },
  { eyebrow: 'For today', body: 'A folded sheet, a peeled apple, the back of a small head. The day is made of these.' },
  { eyebrow: 'For today', body: 'What you tend, tends you back.' },
];

export function pickWelcomeMessage() {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}
```

- [ ] **Step 2: Run the test suite**

```bash
npm test
```
Expected: `WelcomeOverlay.test.jsx` and possibly `data.test.js` may have assertions about specific old strings or about the array length (50). Update them to match the new library (10 messages; one of the test strings might be `'Rest is not a reward for finishing. It is part of the work.'`). Re-run until green.

- [ ] **Step 3: Run the dev server, open the app, dismiss the welcome, refresh several times**

```bash
npm run dev
```
Expected: the welcome overlay appears each time with one of the 10 seed messages. None of the old twee strings appear. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/data/welcome.js src/components/WelcomeOverlay.test.jsx src/data/data.test.js
git commit -m "Replace welcome library with 10 seed messages in new voice"
```

---

## Task 11a: Create The Keep data file with seed essays + week-picker helper (TDD)

**Files:**
- Create: `src/data/keep.js`
- Create: `src/data/keep.test.js`

The Keep is a small library of short essays. Each essay has a slug, title, and body (string with `\n\n` paragraph breaks). One essay is surfaced per week on the Today tab; the picker uses the ISO week-of-year so the rotation is deterministic per device clock.

For now: 3 seed essays I write as plausible examples in the voice. Founder will replace/expand. The picker function must work for any size library ≥ 1.

- [ ] **Step 1: Write the failing test**

Create `src/data/keep.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { KEEP_ESSAYS, essayOfWeek, essayBySlug, allEssays } from './keep.js';

describe('KEEP_ESSAYS', () => {
  it('has at least one seed essay', () => {
    expect(KEEP_ESSAYS.length).toBeGreaterThanOrEqual(1);
  });

  it('every essay has a slug, title, and non-empty body', () => {
    for (const essay of KEEP_ESSAYS) {
      expect(typeof essay.slug).toBe('string');
      expect(essay.slug.length).toBeGreaterThan(0);
      expect(typeof essay.title).toBe('string');
      expect(essay.title.length).toBeGreaterThan(0);
      expect(typeof essay.body).toBe('string');
      expect(essay.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('all slugs are unique', () => {
    const slugs = KEEP_ESSAYS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('essayOfWeek', () => {
  it('returns an essay for any date', () => {
    expect(essayOfWeek(new Date(2026, 0, 1))).toBeDefined();
    expect(essayOfWeek(new Date(2026, 5, 18))).toBeDefined();
    expect(essayOfWeek(new Date(2026, 11, 31))).toBeDefined();
  });

  it('returns the same essay for two dates in the same ISO week', () => {
    // 2026-06-15 (Monday) and 2026-06-21 (Sunday) are the same ISO week
    const a = essayOfWeek(new Date(2026, 5, 15));
    const b = essayOfWeek(new Date(2026, 5, 21));
    expect(a.slug).toBe(b.slug);
  });

  it('may return a different essay across a week boundary', () => {
    // Across the Sunday → Monday boundary between weeks
    const sun = essayOfWeek(new Date(2026, 5, 21));
    const mon = essayOfWeek(new Date(2026, 5, 22));
    // Cannot assert they differ (modulo collisions are possible), but
    // both must be valid essays present in the library.
    expect(KEEP_ESSAYS.some((e) => e.slug === sun.slug)).toBe(true);
    expect(KEEP_ESSAYS.some((e) => e.slug === mon.slug)).toBe(true);
  });

  it('defaults to current date when no argument passed', () => {
    const result = essayOfWeek();
    expect(result).toBeDefined();
    expect(typeof result.slug).toBe('string');
  });
});

describe('essayBySlug', () => {
  it('returns the essay matching the slug', () => {
    const first = KEEP_ESSAYS[0];
    expect(essayBySlug(first.slug)).toBe(first);
  });

  it('returns undefined for an unknown slug', () => {
    expect(essayBySlug('not-a-real-slug')).toBeUndefined();
  });
});

describe('allEssays', () => {
  it('returns the whole library', () => {
    expect(allEssays()).toEqual(KEEP_ESSAYS);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- keep
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `src/data/keep.js`**

Create `src/data/keep.js`:

```javascript
// ─── The Keep — a small library of readings ───────────────────────
// Short essays in the tradition of Tish Warren, Wendell Berry,
// Henri Nouwen. One is surfaced per week on the Today tab.
//
// To add an essay: append to KEEP_ESSAYS. The library rotates
// weekly using ISO week-of-year, so the cycle length matches the
// library size. Aim for short — 200 to 400 words. Plain paragraphs
// separated by blank lines.

export const KEEP_ESSAYS = [
  {
    slug: 'on-the-laundry-that-is-never-done',
    title: 'On the laundry that is never done',
    body: `The laundry is never done. The dishes are never done. The hallway is never quite tidy. This is not a failure of will. It is the shape of the work.

A house with people in it produces. A child eats and the plate is dirty; the child sleeps and the bed is mussed; the child plays and the floor is strewn. The work of a home is not a project that finishes. It is a tending — one that lasts as long as the love does.

To accept this is not to give up. It is to stop being defeated by what was never a defeat. The laundry will be there tomorrow. So will you. So will they. Tend what is in front of you, and then put the basket down.`,
  },
  {
    slug: 'a-small-table-set-for-four',
    title: 'A small table set for four',
    body: `Most of what a mother does is invisible. The crusts trimmed, the song hummed at 3 a.m., the third reading of the same book. None of it photographs well. None of it is what the world calls accomplishment.

But these are the materials of a life. A child does not remember the cleaned baseboards. She remembers the table set for four, the same way, week after week, in a house where someone made it so.

You are making it so. The setting of a small table is not a small thing.`,
  },
  {
    slug: 'the-day-asks-only-what-the-day-asks',
    title: 'The day asks only what the day asks',
    body: `The day is not a competition. It is not a list to be defeated. It is the hours that are given to you, and the people who are in them, and the small acts that connect one hour to the next.

When the day asks for patience, give patience. When it asks for soup, make soup. When it asks for you to sit on the floor with a small person who is upset, sit on the floor. Do not measure the day by what you have crossed off. The crossings off are only one kind of work, and not the most important one.

What was done with love today was enough. The rest will keep until tomorrow.`,
  },
];

// Returns the essay whose index matches the ISO week-of-year modulo
// the library size. Same essay all week; rotates on the week boundary.
export function essayOfWeek(today = new Date()) {
  const week = isoWeek(today);
  const idx = (week - 1) % KEEP_ESSAYS.length;
  return KEEP_ESSAYS[idx];
}

export function essayBySlug(slug) {
  return KEEP_ESSAYS.find((e) => e.slug === slug);
}

export function allEssays() {
  return KEEP_ESSAYS;
}

// ISO 8601 week number. Week 1 contains the year's first Thursday.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- keep
```
Expected: PASS for all describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/data/keep.js src/data/keep.test.js
git commit -m "Add The Keep data file with 3 seed essays and week-picker helper"
```

---

## Task 11b: Build KeepReader and KeepList components

**Files:**
- Create: `src/components/KeepReader.jsx`
- Create: `src/components/KeepList.jsx`

KeepReader displays one essay. KeepList shows all essays as a tap-to-read list. They share a modal shell pattern (matching `SettingsModal` and `SitterCardModal`). The reader has a footer link "Read more from The Keep →" that opens the list; the list closes back to the reader when an essay is tapped.

- [ ] **Step 1: Create `src/components/KeepReader.jsx`**

```jsx
import { useState } from 'react';
import KeepList from './KeepList.jsx';

export default function KeepReader({ open, essay, onClose }) {
  const [showList, setShowList] = useState(false);
  const [activeEssay, setActiveEssay] = useState(essay);

  if (!open) return null;

  if (showList) {
    return (
      <KeepList
        open={true}
        onSelect={(picked) => { setActiveEssay(picked); setShowList(false); }}
        onClose={() => setShowList(false)}
      />
    );
  }

  const current = activeEssay || essay;
  if (!current) return null;

  const paragraphs = current.body.split(/\n\n+/);

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)' }}>
      <div className="flex items-center justify-between px-7 pt-5 pb-3">
        <button onClick={onClose} className="muted text-[14px] nav-btn" aria-label="Close">×</button>
        <span className="font-display rose text-[10px] tracking-[0.32em] uppercase" style={{ fontWeight: 500 }}>THE KEEP</span>
        <div style={{ width: '14px' }} />
      </div>

      <div className="mx-8 border-t hairline" />

      <div className="overflow-y-auto flex-1 px-7 pt-8 pb-10">
        <h1 className="font-display ink leading-tight mb-6"
          style={{ fontWeight: 400, fontSize: '28px', fontStyle: 'italic' }}>
          {current.title}
        </h1>
        {paragraphs.map((p, i) => (
          <p key={i} className="font-display ink text-[17px] leading-relaxed mb-5"
            style={{ fontWeight: 400 }}>
            {p}
          </p>
        ))}
        <div className="pt-8 border-t hairline mt-8">
          <button onClick={() => setShowList(true)}
            className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Read more from The Keep →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/KeepList.jsx`**

```jsx
import { allEssays } from '../data/keep.js';

export default function KeepList({ open, onSelect, onClose }) {
  if (!open) return null;

  const essays = allEssays();

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)' }}>
      <div className="flex items-center justify-between px-7 pt-5 pb-3">
        <button onClick={onClose} className="muted text-[14px] nav-btn" aria-label="Close">×</button>
        <span className="font-display rose text-[10px] tracking-[0.32em] uppercase" style={{ fontWeight: 500 }}>THE KEEP</span>
        <div style={{ width: '14px' }} />
      </div>

      <div className="mx-8 border-t hairline" />

      <div className="overflow-y-auto flex-1 px-7 pt-8 pb-10">
        <p className="muted text-[12px] font-body italic font-display mb-6">
          A small library of readings. One a week is enough.
        </p>
        <div className="space-y-5">
          {essays.map((essay) => (
            <button key={essay.slug} onClick={() => onSelect(essay)}
              className="w-full text-left nav-btn pb-4 border-b hairline">
              <h2 className="font-display ink text-[20px] leading-snug" style={{ fontWeight: 400, fontStyle: 'italic' }}>
                {essay.title}
              </h2>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify both components compile**

```bash
npm run build
```
Expected: clean build. (Components are not yet wired into App.jsx — that's Task 11c.)

- [ ] **Step 4: Commit**

```bash
git add src/components/KeepReader.jsx src/components/KeepList.jsx
git commit -m "Add KeepReader and KeepList components"
```

---

## Task 11c: Wire weekly Keep callout into the Today tab

**Files:**
- Create: `src/components/KeepCallout.jsx`
- Modify: `src/App.jsx` (import the components, hold `keepReaderOpen` state, render the callout on Today, mount the reader)

The callout is a single italicized line on the Today tab — "This week: *On the laundry that is never done*" — that taps to open the reader for that week's essay. It lives below the Quick Notes section, above the Today's Work footer.

- [ ] **Step 1: Create `src/components/KeepCallout.jsx`**

```jsx
export default function KeepCallout({ essay, onOpen }) {
  if (!essay) return null;
  return (
    <button onClick={onOpen}
      className="mx-7 mb-5 mt-2 pt-5 border-t hairline fade-in w-auto text-left nav-btn block">
      <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">From The Keep</div>
      <p className="font-display ink text-[15px] leading-snug" style={{ fontWeight: 400 }}>
        This week: <span style={{ fontStyle: 'italic' }}>{essay.title}</span>
      </p>
    </button>
  );
}
```

- [ ] **Step 2: Add imports to `src/App.jsx`**

In the imports block at the top of `src/App.jsx`, add:

```javascript
import { essayOfWeek } from './data/keep.js';
import KeepCallout from './components/KeepCallout.jsx';
import KeepReader from './components/KeepReader.jsx';
```

- [ ] **Step 3: Add reader state**

Inside the `App` function body, alongside the other `useState` declarations for volatile UI state (around line 56), add:

```javascript
  const [keepReaderOpen, setKeepReaderOpen] = useState(false);
  const currentEssay = essayOfWeek();
```

- [ ] **Step 4: Render the KeepCallout on the Today tab**

In `src/App.jsx`, find the block where the Today tab content closes (just before `{/* Today's Wins */}` — which after Task 7 is `{/* Today's Work */}`). Add the callout between Quick Notes and Today's Work:

Before the `{/* Today's Work */}` block, add:

```javascript
              <KeepCallout essay={currentEssay} onOpen={() => setKeepReaderOpen(true)} />
```

- [ ] **Step 5: Mount the KeepReader near the top-level modal mounts**

In `src/App.jsx`, find where other modals are mounted (just below `<SitterCardModal ...>`, around line 275). Add:

```javascript
        <KeepReader
          open={keepReaderOpen}
          essay={currentEssay}
          onClose={() => setKeepReaderOpen(false)}
        />
```

- [ ] **Step 6: Run the dev server and confirm the callout works**

```bash
npm run dev
```
Expected: open the Today tab. Below Quick Notes (above the Today's Work footer) there's a line "FROM THE KEEP" / "This week: *On the laundry that is never done*" (or whichever essay matches this week). Tapping it opens the reader full-bleed. "Read more from The Keep →" opens the list. Selecting a different essay returns to the reader with that essay. The × closes back to Today.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/KeepCallout.jsx
git commit -m "Wire weekly Keep callout into Today tab; mount reader and list"
```

---

## Task 12: Add The Seventh Day — Sunday quiet mode on Today tab

**Files:**
- Create: `src/components/SeventhDay.jsx`
- Modify: `src/App.jsx` (import isSeventhDay; conditionally render SeventhDay in place of the standard Today body when it's Sunday)

On Sundays the Today tab becomes a single quiet card: the past week's Moments thumbnails (last 7 days of `moments`) and a single italicized line. No task lists, no Quick Notes, no calendar block, no Keep callout, no Today's Work footer. The bottom nav stays normal — she can navigate elsewhere if she wants.

- [ ] **Step 1: Create `src/components/SeventhDay.jsx`**

```jsx
export default function SeventhDay({ moments, photoCache }) {
  // Filter to last 7 days. Moments dates are short-format strings; we
  // compare by created order — moments are unshifted to the array on
  // save, so the first 7 are the most recent.
  const recent = (moments || []).slice(0, 7);

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

      {recent.length === 0 ? (
        <p className="muted text-[13px] font-body italic font-display">
          A quiet week. No moments captured.
        </p>
      ) : (
        <div className="space-y-5">
          {recent.map((m) => {
            const photoData = m.photoId ? photoCache[m.photoId] : null;
            return (
              <div key={m.id}>
                <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-2" style={{ fontWeight: 500 }}>
                  {m.date}
                </div>
                {photoData && (
                  <img src={photoData} alt="" className="w-full rounded-xl mb-2 object-cover"
                    style={{ maxHeight: '240px', border: '1px solid rgba(184,133,123,0.18)' }} />
                )}
                {m.text && (
                  <p className="font-display ink text-[15px] leading-snug" style={{ fontWeight: 400 }}>
                    {m.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add imports to `src/App.jsx`**

In the imports block, add:

```javascript
import { isSeventhDay } from './lib/rollover.js'; // (or add to the existing rollover import line)
import SeventhDay from './components/SeventhDay.jsx';
```

If you already have an import from `./lib/rollover.js`, extend it rather than adding a second line:

```javascript
import {
  resetDaily, resetWeekly, shouldResetDaily, shouldResetWeekly, isSeventhDay,
} from './lib/rollover.js';
```

- [ ] **Step 3: Conditionally render SeventhDay on the Today tab**

Wrap the existing Today body in a Sunday conditional **without restating the body** — this is a two-line surgical edit, not a paste-over.

In `src/App.jsx`, find the line that opens the Today block:

```javascript
          {/* TODAY */}
          {activeNav === 'Today' && (
            <>
```

Change those three lines to:

```javascript
          {/* TODAY */}
          {activeNav === 'Today' && (isSeventhDay() ? (
            <SeventhDay moments={moments} photoCache={photoCache} />
          ) : (
            <>
```

Then find the corresponding close of that Today block — the `</>` followed by `)}` that ends the `{activeNav === 'Today' && (...)` expression. It currently reads:

```javascript
            </>
          )}
```

Change it to:

```javascript
            </>
          ))}
```

(One extra closing paren to match the new ternary wrapper.) The entire existing Today body (greeting, calendar block, Quick Notes, KeepCallout, Today's Work footer) is untouched in between.

- [ ] **Step 4: Test in dev — verify both modes render**

```bash
npm run dev
```

Expected if today is **not** Sunday: Today tab renders normally (greeting, calendar, notes, Keep callout, Today's Work).

To verify Sunday mode without waiting: temporarily edit the import to wrap a fixed Sunday for one boot:

```javascript
// TEMPORARY for verification:
import { isSeventhDay as _real } from './lib/rollover.js';
const isSeventhDay = () => true; // forces Seventh Day; revert before commit
```

Confirm SeventhDay renders (heading "The seventh day.", italicized line, week's Moments).

**Revert the temporary override** before continuing. Restore the original import.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/SeventhDay.jsx
git commit -m "Add The Seventh Day — Sunday quiet mode on Today tab"
```

---

## Task 13: Final verification — full test suite, build, manual smoke

**Files:**
- None modified.

The plan is complete. Run end-to-end verification before declaring done.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```
Expected: clean build to `dist/` with no warnings about missing imports, unused symbols (lint-level warnings are fine), or React strictness.

- [ ] **Step 3: Manual smoke walk in `npm run dev`**

```bash
npm run dev
```

Walk through each tab in a browser and confirm:

- **Today** — greeting reads cleanly; calendar block present (or "Connect a calendar in settings" if unset); Quick Notes works (add/edit/delete/toggle); a "FROM THE KEEP" callout appears below Quick Notes and opens the reader; the reader's "Read more from The Keep →" opens the list; the list returns to the reader on selection; "Today's Work" footer shows an italicized acknowledgment line varying by hour; no big number, no streak count.
- **The Keeping** (formerly Tidy) — header says "The Keeping"; bottom nav says "THE KEEPING"; Daily and Weekly sections present and editable; **no Streak card, no Rest day button, no progress bar, no "X days strong"**.
- **Kitchen** — meal grid and grocery/to-buy lists work; empty-state copy reads in the new voice.
- **Girls** — kid cards, household info, sitter notes, Sitter Card share button all work; updated microcopy.
- **Moments** — photo journal works; empty state reads "When something matters today, keep it here."; share button works.

Verify the WelcomeOverlay appears on first load and shows one of the 10 new seed messages (refresh several times to see the rotation).

Stop the server.

- [ ] **Step 4: Push** (optional — confirm with the user before pushing)

```bash
git push origin main
```

Only push if the user has explicitly asked to publish these changes. Otherwise leave the work locally committed.

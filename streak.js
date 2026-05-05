// ─── Streak management ────────────────────────────────────────────
// Evaluates the streak based on yesterday's performance.
// Called each time the app opens — auto-resets daily checkboxes too.

import { STREAK_THRESHOLD, GRACE_PER_MONTH } from '../data/initial.js';

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function ym(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

// Given the daily tasks state at the moment the day rolls over,
// returns the percent done.
export function dailyPercent(daily) {
  const all = [...(daily.day || []), ...(daily.night || [])];
  if (all.length === 0) return 0;
  const done = all.filter((t) => t.done).length;
  return done / all.length;
}

// Returns updated streak state and a flag indicating if the daily list should reset.
// Called once on app open.
export function evaluateStreak(streak, daily, today = new Date()) {
  const todayKey = ymd(today);
  const monthKey = ym(today);

  // First-ever open
  if (!streak.lastCheckedDate) {
    return {
      streak: { ...streak, lastCheckedDate: todayKey, graceMonth: monthKey },
      shouldReset: false,
    };
  }

  // Same day — no change
  if (streak.lastCheckedDate === todayKey) {
    return { streak, shouldReset: false };
  }

  // Reset grace if we've crossed into a new month
  let updated = { ...streak };
  if (streak.graceMonth !== monthKey) {
    updated.graceUsedThisMonth = 0;
    updated.graceMonth = monthKey;
  }

  // A new day. Did yesterday meet threshold?
  const pct = dailyPercent(daily);
  const kept = pct >= STREAK_THRESHOLD;

  // Did we miss days? (e.g., didn't open for 2 days)
  const lastDate = new Date(streak.lastCheckedDate + 'T00:00:00');
  const daysSince = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

  if (daysSince === 1) {
    // Just yesterday — evaluate normally
    if (kept) {
      updated.current = streak.current + 1;
      updated.best = Math.max(updated.best, updated.current);
    } else {
      // Streak broken
      updated.current = 0;
    }
  } else {
    // We skipped one or more days in between — streak breaks unless grace covers it
    // For simplicity: any gap > 1 day breaks the streak (grace is for *active* rest, not absence)
    updated.current = 0;
  }

  updated.lastCheckedDate = todayKey;
  return { streak: updated, shouldReset: true };
}

// Called when user taps "Rest day"
// Banks the day as kept without checking tasks. Decrements grace counter.
export function takeRestDay(streak, today = new Date()) {
  const todayKey = ymd(today);
  const monthKey = ym(today);

  if (streak.graceUsedThisMonth >= GRACE_PER_MONTH) return streak;

  // Reset grace if month changed
  const baseGrace = streak.graceMonth === monthKey ? streak.graceUsedThisMonth : 0;

  const updated = {
    ...streak,
    current: streak.current + 1,
    best: Math.max(streak.best, streak.current + 1),
    lastCheckedDate: todayKey,
    graceUsedThisMonth: baseGrace + 1,
    graceMonth: monthKey,
  };
  return updated;
}

export function graceRemaining(streak, today = new Date()) {
  if (streak.graceMonth !== ym(today)) return GRACE_PER_MONTH;
  return Math.max(0, GRACE_PER_MONTH - streak.graceUsedThisMonth);
}

// Resets all daily tasks' done flags to false
export function resetDaily(daily) {
  return {
    day: (daily.day || []).map((t) => ({ ...t, done: false })),
    night: (daily.night || []).map((t) => ({ ...t, done: false })),
  };
}

// Resets weekly tasks. Called on Sunday rollover.
export function resetWeekly(weekly) {
  return weekly.map((t) => ({ ...t, done: false }));
}

// Should we reset the weekly list? True if we've crossed into a new week
// since the last check. Uses Sunday as the week boundary.
export function shouldResetWeekly(lastWeeklyResetDate, today = new Date()) {
  if (!lastWeeklyResetDate) return false;
  const last = new Date(lastWeeklyResetDate + 'T00:00:00');
  // Find the most recent Sunday <= today
  const todaySunday = new Date(today);
  todaySunday.setDate(today.getDate() - today.getDay());
  todaySunday.setHours(0, 0, 0, 0);
  return last < todaySunday;
}

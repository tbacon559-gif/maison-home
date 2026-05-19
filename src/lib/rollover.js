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

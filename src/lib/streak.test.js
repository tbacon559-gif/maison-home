import { describe, it, expect } from 'vitest';
import {
  dailyPercent,
  evaluateStreak,
  takeRestDay,
  graceRemaining,
  resetDaily,
  resetWeekly,
  shouldResetWeekly,
} from './streak.js';
import { INITIAL_STREAK, STREAK_THRESHOLD, GRACE_PER_MONTH } from '../data/initial.js';

// Tests assume TZ=UTC (set via the test script). Without it, the local-vs-UTC
// boundary in ymd() becomes ambiguous. See package.json test script.

const dailyAllDone = {
  day: [
    { id: 1, label: 'a', done: true },
    { id: 2, label: 'b', done: true },
  ],
  night: [{ id: 3, label: 'c', done: true }],
};

const dailyNoneDone = {
  day: [
    { id: 1, label: 'a', done: false },
    { id: 2, label: 'b', done: false },
  ],
  night: [{ id: 3, label: 'c', done: false }],
};

// 4 of 5 = 80% (exactly at threshold)
const dailyAtThreshold = {
  day: [
    { id: 1, label: 'a', done: true },
    { id: 2, label: 'b', done: true },
    { id: 3, label: 'c', done: true },
  ],
  night: [
    { id: 4, label: 'd', done: true },
    { id: 5, label: 'e', done: false },
  ],
};

// 3 of 5 = 60% (below threshold)
const dailyBelowThreshold = {
  day: [
    { id: 1, label: 'a', done: true },
    { id: 2, label: 'b', done: true },
    { id: 3, label: 'c', done: true },
  ],
  night: [
    { id: 4, label: 'd', done: false },
    { id: 5, label: 'e', done: false },
  ],
};

describe('dailyPercent', () => {
  it('returns 0 when both lists are empty', () => {
    expect(dailyPercent({ day: [], night: [] })).toBe(0);
  });

  it('returns 0 when day/night keys are missing', () => {
    expect(dailyPercent({})).toBe(0);
  });

  it('returns 1 when everything is done', () => {
    expect(dailyPercent(dailyAllDone)).toBe(1);
  });

  it('returns 0 when nothing is done', () => {
    expect(dailyPercent(dailyNoneDone)).toBe(0);
  });

  it('counts both day and night tasks', () => {
    expect(dailyPercent(dailyAtThreshold)).toBeCloseTo(0.8, 5);
    expect(dailyPercent(dailyBelowThreshold)).toBeCloseTo(0.6, 5);
  });

  it('handles missing night list', () => {
    expect(dailyPercent({ day: [{ id: 1, done: true }] })).toBe(1);
  });
});

describe('evaluateStreak', () => {
  it('seeds lastCheckedDate and graceMonth on first ever open', () => {
    const today = new Date(2026, 5, 10);
    const { streak, shouldReset } = evaluateStreak(INITIAL_STREAK, dailyNoneDone, today);
    expect(streak.lastCheckedDate).toBe('2026-06-10');
    expect(streak.graceMonth).toBe('2026-06');
    expect(streak.current).toBe(0);
    expect(shouldReset).toBe(false);
  });

  it('is a no-op when called twice on the same day', () => {
    const today = new Date(2026, 5, 10);
    const seeded = { ...INITIAL_STREAK, lastCheckedDate: '2026-06-10', graceMonth: '2026-06' };
    const { streak, shouldReset } = evaluateStreak(seeded, dailyAllDone, today);
    expect(streak).toBe(seeded);
    expect(shouldReset).toBe(false);
  });

  it('increments streak when yesterday hit threshold', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 4, best: 5, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const { streak, shouldReset } = evaluateStreak(prior, dailyAtThreshold, today);
    expect(streak.current).toBe(5);
    expect(streak.best).toBe(5);
    expect(streak.lastCheckedDate).toBe('2026-06-10');
    expect(shouldReset).toBe(true);
  });

  it('updates best when current surpasses it', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 9, best: 9, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const { streak } = evaluateStreak(prior, dailyAllDone, today);
    expect(streak.current).toBe(10);
    expect(streak.best).toBe(10);
  });

  it('treats threshold (80%) as kept', () => {
    expect(STREAK_THRESHOLD).toBe(0.8);
    const today = new Date(2026, 5, 10);
    const prior = { current: 1, best: 1, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const { streak } = evaluateStreak(prior, dailyAtThreshold, today);
    expect(streak.current).toBe(2);
  });

  it('resets streak when yesterday was below threshold', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 7, best: 9, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const { streak } = evaluateStreak(prior, dailyBelowThreshold, today);
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(9);
  });

  it('resets streak when more than one day has passed (absence)', () => {
    const today = new Date(2026, 5, 12);
    const prior = { current: 5, best: 8, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const { streak } = evaluateStreak(prior, dailyAllDone, today);
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(8);
    expect(streak.lastCheckedDate).toBe('2026-06-12');
  });

  it('clears graceUsedThisMonth when crossing into a new month', () => {
    const today = new Date(2026, 6, 1);
    const prior = { current: 3, best: 3, lastCheckedDate: '2026-06-30', graceUsedThisMonth: 2, graceMonth: '2026-06' };
    const { streak } = evaluateStreak(prior, dailyAllDone, today);
    expect(streak.graceUsedThisMonth).toBe(0);
    expect(streak.graceMonth).toBe('2026-07');
    expect(streak.current).toBe(4);
  });

  it('marks shouldReset=true on any non-first new-day evaluation', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 1, best: 1, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    expect(evaluateStreak(prior, dailyAllDone, today).shouldReset).toBe(true);
    expect(evaluateStreak(prior, dailyBelowThreshold, today).shouldReset).toBe(true);
  });
});

describe('takeRestDay', () => {
  it('increments current and consumes one grace', () => {
    expect(GRACE_PER_MONTH).toBe(2);
    const today = new Date(2026, 5, 10);
    const prior = { current: 3, best: 5, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    const next = takeRestDay(prior, today);
    expect(next.current).toBe(4);
    expect(next.graceUsedThisMonth).toBe(1);
    expect(next.lastCheckedDate).toBe('2026-06-10');
  });

  it('updates best when rest pushes current past best', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 5, best: 5, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 0, graceMonth: '2026-06' };
    expect(takeRestDay(prior, today).best).toBe(6);
  });

  it('returns the streak unchanged when grace is already exhausted this month', () => {
    const today = new Date(2026, 5, 10);
    const prior = { current: 3, best: 5, lastCheckedDate: '2026-06-09', graceUsedThisMonth: 2, graceMonth: '2026-06' };
    expect(takeRestDay(prior, today)).toBe(prior);
  });

  it('regression: a fully-used previous month silently blocks rest day until evaluateStreak rolls over', () => {
    // Latent quirk: takeRestDay's "is grace exhausted?" check runs BEFORE the
    // month-rollover branch (which would zero out the counter). In practice
    // evaluateStreak is called on every app open and resets graceUsedThisMonth
    // when the month changes, so this state never lingers — but if it ever
    // did, takeRestDay would no-op until evaluateStreak ran. Worth catching
    // if anyone reorders the call sites.
    const today = new Date(2026, 6, 1);
    const prior = { current: 3, best: 5, lastCheckedDate: '2026-06-30', graceUsedThisMonth: 2, graceMonth: '2026-06' };
    expect(takeRestDay(prior, today)).toBe(prior);
  });

  it('grants the new month\'s grace once the month-rollover branch is reached', () => {
    // Same scenario as above but with one slot still free last month — the
    // early-return check passes, so the rollover branch zeroes the counter
    // before incrementing.
    const today = new Date(2026, 6, 1);
    const prior = { current: 3, best: 5, lastCheckedDate: '2026-06-30', graceUsedThisMonth: 1, graceMonth: '2026-06' };
    const next = takeRestDay(prior, today);
    expect(next.graceUsedThisMonth).toBe(1);
    expect(next.graceMonth).toBe('2026-07');
    expect(next.current).toBe(4);
  });
});

describe('graceRemaining', () => {
  it('returns the full allowance for an unset graceMonth', () => {
    const today = new Date(2026, 5, 10);
    expect(graceRemaining(INITIAL_STREAK, today)).toBe(GRACE_PER_MONTH);
  });

  it('returns full allowance when graceMonth is from a previous month', () => {
    const today = new Date(2026, 6, 1);
    const prior = { ...INITIAL_STREAK, graceUsedThisMonth: 2, graceMonth: '2026-06' };
    expect(graceRemaining(prior, today)).toBe(GRACE_PER_MONTH);
  });

  it('subtracts used grace when graceMonth matches', () => {
    const today = new Date(2026, 5, 10);
    const prior = { ...INITIAL_STREAK, graceUsedThisMonth: 1, graceMonth: '2026-06' };
    expect(graceRemaining(prior, today)).toBe(1);
  });

  it('floors at zero', () => {
    const today = new Date(2026, 5, 10);
    const prior = { ...INITIAL_STREAK, graceUsedThisMonth: 9, graceMonth: '2026-06' };
    expect(graceRemaining(prior, today)).toBe(0);
  });
});

describe('resetDaily', () => {
  it('flips every day and night task to done=false', () => {
    const out = resetDaily(dailyAllDone);
    expect(out.day.every((t) => t.done === false)).toBe(true);
    expect(out.night.every((t) => t.done === false)).toBe(true);
  });

  it('preserves task labels and ids', () => {
    const out = resetDaily(dailyAllDone);
    expect(out.day[0]).toEqual({ id: 1, label: 'a', done: false });
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
    // Both on Sunday 2026-06-07.
    expect(shouldResetWeekly('2026-06-07', new Date(2026, 5, 7))).toBe(false);
  });

  it('returns true when checked the following Sunday', () => {
    expect(shouldResetWeekly('2026-06-07', new Date(2026, 5, 14))).toBe(true);
  });
});

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

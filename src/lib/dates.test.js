import { describe, it, expect } from 'vitest';
import {
  calcAge,
  nextBirthday,
  shortDate,
  todayLabel,
  dayKey,
  relativeLabel,
  timeLabel,
  todayZone,
  tomorrowZone,
} from './dates.js';

// All tests pass an explicit `now` so they do not depend on wall-clock time.
// Tests assume TZ=UTC so floating dates compare cleanly.

describe('calcAge', () => {
  it('returns empty string for falsy birthday', () => {
    expect(calcAge('')).toBe('');
    expect(calcAge(null)).toBe('');
    expect(calcAge(undefined)).toBe('');
  });

  it('formats infants as "N mo"', () => {
    expect(calcAge('2026-01-10', new Date(2026, 5, 10))).toBe('5 mo');
  });

  it('returns "0 mo" on the day of birth', () => {
    expect(calcAge('2026-06-10', new Date(2026, 5, 10))).toBe('0 mo');
  });

  it('returns "1 yr" exactly at first birthday', () => {
    expect(calcAge('2025-06-10', new Date(2026, 5, 10))).toBe('1 yr');
  });

  it('formats "N yrs" when months align', () => {
    expect(calcAge('2023-06-10', new Date(2026, 5, 10))).toBe('3 yrs');
  });

  it('formats years + months together', () => {
    expect(calcAge('2023-06-10', new Date(2026, 8, 10))).toBe('3 yrs 3 mo');
  });

  it('singular yr when months > 0 still uses "yr" plural rules (>1)', () => {
    // 2 yrs 1 mo — plural "yrs"
    expect(calcAge('2024-05-10', new Date(2026, 5, 10))).toBe('2 yrs 1 mo');
  });

  it('rolls back when day-of-month has not reached birthday yet', () => {
    // Birthday is the 20th, today is the 10th — should be 2 yrs 11 mo, not 3 yrs.
    expect(calcAge('2023-06-20', new Date(2026, 5, 10))).toBe('2 yrs 11 mo');
  });

  it('handles day-before-first-birthday → 11 mo', () => {
    expect(calcAge('2025-06-10', new Date(2026, 5, 9))).toBe('11 mo');
  });

  it('survives Feb 29 birthdays in non-leap years (no crash)', () => {
    expect(() => calcAge('2024-02-29', new Date(2026, 2, 1))).not.toThrow();
  });
});

describe('nextBirthday', () => {
  it('returns null for falsy birthday', () => {
    expect(nextBirthday('')).toBeNull();
    expect(nextBirthday(null)).toBeNull();
  });

  it('reports days until upcoming birthday this year', () => {
    const out = nextBirthday('2023-06-15', new Date(2026, 5, 10));
    expect(out.days).toBe(5);
    expect(out.turning).toBe(3);
    expect(out.dateStr).toContain('June');
  });

  it('rolls forward to next year when birthday already passed', () => {
    const out = nextBirthday('2023-06-05', new Date(2026, 5, 10));
    expect(out.turning).toBe(4);
    // Next birthday is 2027-06-05 — at least 350 days away.
    expect(out.days).toBeGreaterThan(350);
  });

  it('reports 0 days when birthday is today', () => {
    const out = nextBirthday('2023-06-10', new Date(2026, 5, 10));
    // The birthday Date is constructed at start-of-day, today is also start-of-day.
    // diff = 0, ceil(0) = 0, but `next < today` is false so we keep this year.
    // turning: 2026 - 2023 = 3.
    expect(out.days).toBe(0);
    expect(out.turning).toBe(3);
  });
});

describe('shortDate', () => {
  it('formats as "Mon D"', () => {
    expect(shortDate(new Date(2026, 5, 10))).toBe('Jun 10');
  });
});

describe('todayLabel', () => {
  it('formats with weekday + month + day', () => {
    // 2026-06-10 is a Wednesday.
    expect(todayLabel(new Date(2026, 5, 10))).toBe('Wednesday, June 10');
  });
});

describe('dayKey', () => {
  it('maps each weekday correctly', () => {
    expect(dayKey(new Date(2026, 5, 7))).toBe('Sun'); // 2026-06-07
    expect(dayKey(new Date(2026, 5, 8))).toBe('Mon');
    expect(dayKey(new Date(2026, 5, 9))).toBe('Tue');
    expect(dayKey(new Date(2026, 5, 10))).toBe('Wed');
    expect(dayKey(new Date(2026, 5, 11))).toBe('Thu');
    expect(dayKey(new Date(2026, 5, 12))).toBe('Fri');
    expect(dayKey(new Date(2026, 5, 13))).toBe('Sat');
  });
});

describe('relativeLabel', () => {
  const now = new Date(2026, 5, 10); // Wednesday

  it('returns TODAY for same-day events', () => {
    expect(relativeLabel(new Date(2026, 5, 10, 14, 0), now)).toBe('TODAY');
  });

  it('returns TOMORROW for next-day events', () => {
    expect(relativeLabel(new Date(2026, 5, 11), now)).toBe('TOMORROW');
  });

  it('returns empty string for past events', () => {
    expect(relativeLabel(new Date(2026, 5, 9), now)).toBe('');
  });

  it('returns abbreviated weekday for events within the next 6 days', () => {
    expect(relativeLabel(new Date(2026, 5, 12), now)).toBe('FRI');
    expect(relativeLabel(new Date(2026, 5, 16), now)).toBe('TUE'); // 6 days
  });

  it('returns "NEXT WEEKDAY" for events 7-13 days out', () => {
    expect(relativeLabel(new Date(2026, 5, 17), now)).toBe('NEXT WED');
    expect(relativeLabel(new Date(2026, 5, 23), now)).toBe('NEXT TUE'); // 13 days
  });

  it('returns "MON D" format for events 14+ days out', () => {
    expect(relativeLabel(new Date(2026, 5, 24), now)).toBe('JUN 24');
  });
});

describe('timeLabel', () => {
  it('returns empty string for falsy input', () => {
    expect(timeLabel(null)).toBe('');
    expect(timeLabel(undefined)).toBe('');
    expect(timeLabel('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(timeLabel('not-a-date')).toBe('');
  });

  it('detects all-day events (string ending in T00:00:00)', () => {
    expect(timeLabel('2026-06-10T00:00:00')).toBe('');
  });

  it('formats whole hours without minutes', () => {
    expect(timeLabel(new Date(2026, 5, 10, 9, 0))).toBe('9 am');
  });

  it('formats hours with minutes', () => {
    expect(timeLabel(new Date(2026, 5, 10, 14, 30))).toBe('2:30 pm');
  });
});

describe('todayZone / tomorrowZone', () => {
  const zones = ['Kitchen', 'Bathrooms', 'Living', 'Bedrooms', 'Entry'];

  it('todayZone returns null on weekends', () => {
    expect(todayZone(zones, new Date(2026, 5, 6))).toBeNull(); // Saturday
    expect(todayZone(zones, new Date(2026, 5, 7))).toBeNull(); // Sunday
  });

  it('todayZone maps Mon-Fri to zones[0..4]', () => {
    expect(todayZone(zones, new Date(2026, 5, 8))).toBe('Kitchen'); // Mon
    expect(todayZone(zones, new Date(2026, 5, 9))).toBe('Bathrooms'); // Tue
    expect(todayZone(zones, new Date(2026, 5, 10))).toBe('Living'); // Wed
    expect(todayZone(zones, new Date(2026, 5, 11))).toBe('Bedrooms'); // Thu
    expect(todayZone(zones, new Date(2026, 5, 12))).toBe('Entry'); // Fri
  });

  it('tomorrowZone returns null when tomorrow is Sat/Sun', () => {
    expect(tomorrowZone(zones, new Date(2026, 5, 5))).toBeNull(); // Friday → Saturday
    expect(tomorrowZone(zones, new Date(2026, 5, 6))).toBeNull(); // Saturday → Sunday
  });

  it('tomorrowZone returns null on Sunday (today is Sunday → tomorrow is Monday)', () => {
    // Sunday — getDay()=0, +1 = 1 → not 0 or 6, returns zones[0]
    expect(tomorrowZone(zones, new Date(2026, 5, 7))).toBe('Kitchen');
  });

  it('returns null for empty zone order', () => {
    expect(todayZone([], new Date(2026, 5, 8))).toBeNull();
  });
});

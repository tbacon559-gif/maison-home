import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { upcomingEvents } from './ics.js';

// Tests assume TZ=UTC (set via the test script). Floating ICS times are
// interpreted as local, so without UTC we can't compare timestamps reliably.

const NOW = new Date('2026-06-10T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function buildICS(events) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
}

function buildEvent(props) {
  const lines = ['BEGIN:VEVENT'];
  for (const [k, v] of Object.entries(props)) lines.push(`${k}:${v}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

describe('upcomingEvents — input handling', () => {
  it('returns [] for empty/missing input', () => {
    expect(upcomingEvents('')).toEqual([]);
    expect(upcomingEvents(null)).toEqual([]);
    expect(upcomingEvents(undefined)).toEqual([]);
  });

  it('does not throw on malformed ICS', () => {
    expect(() => upcomingEvents('not an ics file')).not.toThrow();
    expect(upcomingEvents('not an ics file')).toEqual([]);
  });

  it('skips events without DTSTART', () => {
    const ics = buildICS([buildEvent({ SUMMARY: 'Floating' })]);
    expect(upcomingEvents(ics)).toEqual([]);
  });

  it('falls back to "(untitled)" for events without SUMMARY', () => {
    const ics = buildICS([buildEvent({ DTSTART: '20260615T100000Z' })]);
    const out = upcomingEvents(ics);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('(untitled)');
  });
});

describe('upcomingEvents — date parsing', () => {
  it('parses UTC zulu times', () => {
    const ics = buildICS([buildEvent({ SUMMARY: 'A', DTSTART: '20260615T100000Z' })]);
    const out = upcomingEvents(ics);
    expect(out[0].start.toISOString()).toBe('2026-06-15T10:00:00.000Z');
    expect(out[0].allDay).toBe(false);
  });

  it('parses floating (local) times', () => {
    const ics = buildICS([buildEvent({ SUMMARY: 'A', DTSTART: '20260615T090000' })]);
    const out = upcomingEvents(ics);
    // In UTC TZ, local == UTC.
    expect(out[0].start.toISOString()).toBe('2026-06-15T09:00:00.000Z');
    expect(out[0].allDay).toBe(false);
  });

  it('parses date-only as all-day', () => {
    const ics = buildICS([buildEvent({ SUMMARY: 'A', DTSTART: '20260615' })]);
    const out = upcomingEvents(ics);
    expect(out[0].allDay).toBe(true);
  });

  it('ignores TZID parameter and treats as floating local', () => {
    const ev = [
      'BEGIN:VEVENT',
      'SUMMARY:A',
      'DTSTART;TZID=America/New_York:20260615T090000',
      'END:VEVENT',
    ].join('\r\n');
    const ics = buildICS([ev]);
    const out = upcomingEvents(ics);
    expect(out[0].start.toISOString()).toBe('2026-06-15T09:00:00.000Z');
  });
});

describe('upcomingEvents — line folding and escapes', () => {
  it('unfolds CRLF + space continuation lines (per RFC 5545 the fold whitespace is consumed)', () => {
    // To get a literal space in the unfolded output, the producer either ends
    // the prior line with a space or starts the continuation with one — the
    // single fold whitespace itself is stripped along with the CRLF.
    const ev = [
      'BEGIN:VEVENT',
      'SUMMARY:Long title that has been ',
      ' folded across two lines',
      'DTSTART:20260615T100000Z',
      'END:VEVENT',
    ].join('\r\n');
    const ics = buildICS([ev]);
    const out = upcomingEvents(ics);
    expect(out[0].title).toBe('Long title that has been folded across two lines');
  });

  it('unfolds CRLF + tab continuation lines', () => {
    const ev = [
      'BEGIN:VEVENT',
      'SUMMARY:tab-folded',
      '\tcontinuation',
      'DTSTART:20260615T100000Z',
      'END:VEVENT',
    ].join('\r\n');
    const ics = buildICS([ev]);
    expect(upcomingEvents(ics)[0].title).toBe('tab-foldedcontinuation');
  });

  it('unescapes \\n, \\,, \\;, \\\\ in summary', () => {
    const ev = [
      'BEGIN:VEVENT',
      'SUMMARY:Doctor\\, dentist\\; backslash\\\\ and\\nnewline',
      'DTSTART:20260615T100000Z',
      'END:VEVENT',
    ].join('\r\n');
    const ics = buildICS([ev]);
    expect(upcomingEvents(ics)[0].title).toBe('Doctor, dentist; backslash\\ and newline');
  });
});

describe('upcomingEvents — filtering and sorting', () => {
  it('filters out CANCELLED events', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Live', DTSTART: '20260615T100000Z' }),
      buildEvent({ SUMMARY: 'Dead', DTSTART: '20260616T100000Z', STATUS: 'CANCELLED' }),
    ]);
    const out = upcomingEvents(ics);
    expect(out.map((e) => e.title)).toEqual(['Live']);
  });

  it('omits events that have already started (non-all-day)', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Past', DTSTART: '20260609T100000Z' }),
      buildEvent({ SUMMARY: 'Future', DTSTART: '20260612T100000Z' }),
    ]);
    expect(upcomingEvents(ics).map((e) => e.title)).toEqual(['Future']);
  });

  it("keeps today's all-day event even if its start is earlier in the day", () => {
    // NOW is 2026-06-10T12:00Z. An all-day event on 2026-06-10 has start = local midnight = before now.
    const ics = buildICS([buildEvent({ SUMMARY: 'Today AllDay', DTSTART: '20260610' })]);
    const out = upcomingEvents(ics);
    expect(out.map((e) => e.title)).toEqual(['Today AllDay']);
  });

  it('drops yesterday\'s all-day event', () => {
    const ics = buildICS([buildEvent({ SUMMARY: 'Yesterday AllDay', DTSTART: '20260609' })]);
    expect(upcomingEvents(ics)).toEqual([]);
  });

  it('sorts results by start ascending', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Later', DTSTART: '20260620T100000Z' }),
      buildEvent({ SUMMARY: 'Sooner', DTSTART: '20260612T100000Z' }),
      buildEvent({ SUMMARY: 'Middle', DTSTART: '20260615T100000Z' }),
    ]);
    expect(upcomingEvents(ics).map((e) => e.title)).toEqual(['Sooner', 'Middle', 'Later']);
  });

  it('respects the limit option', () => {
    const ics = buildICS(
      Array.from({ length: 10 }, (_, i) =>
        buildEvent({ SUMMARY: `e${i}`, DTSTART: `2026061${i % 10}T100000Z` })
      )
    );
    expect(upcomingEvents(ics, { limit: 3 })).toHaveLength(3);
    expect(upcomingEvents(ics, { limit: 7 })).toHaveLength(7);
  });

  it('respects daysAhead horizon', () => {
    // NOW is 2026-06-10. With daysAhead=5, only events through 2026-06-15 should appear.
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Inside', DTSTART: '20260612T100000Z' }),
      buildEvent({ SUMMARY: 'Outside', DTSTART: '20260620T100000Z' }),
    ]);
    expect(upcomingEvents(ics, { daysAhead: 5 }).map((e) => e.title)).toEqual(['Inside']);
  });

  it('defaults to limit=5', () => {
    const ics = buildICS(
      Array.from({ length: 8 }, (_, i) =>
        buildEvent({ SUMMARY: `e${i}`, DTSTART: `2026061${i + 1}T100000Z` })
      )
    );
    expect(upcomingEvents(ics)).toHaveLength(5);
  });
});

describe('upcomingEvents — recurrence', () => {
  it('expands FREQ=DAILY occurrences', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Daily', DTSTART: '20260612T090000Z', RRULE: 'FREQ=DAILY' }),
    ]);
    const out = upcomingEvents(ics, { limit: 4, daysAhead: 10 });
    expect(out).toHaveLength(4);
    expect(out.every((e) => e.title === 'Daily')).toBe(true);
    const dates = out.map((e) => e.start.toISOString().slice(0, 10));
    expect(dates).toEqual(['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15']);
  });

  it('honors INTERVAL on FREQ=WEEKLY', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Biweekly', DTSTART: '20260612T090000Z', RRULE: 'FREQ=WEEKLY;INTERVAL=2' }),
    ]);
    const out = upcomingEvents(ics, { limit: 3, daysAhead: 60 });
    const dates = out.map((e) => e.start.toISOString().slice(0, 10));
    expect(dates).toEqual(['2026-06-12', '2026-06-26', '2026-07-10']);
  });

  it('terminates expansion at COUNT', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Three', DTSTART: '20260612T090000Z', RRULE: 'FREQ=DAILY;COUNT=3' }),
    ]);
    const out = upcomingEvents(ics, { limit: 10, daysAhead: 30 });
    expect(out).toHaveLength(3);
  });

  it('terminates expansion at UNTIL', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Until', DTSTART: '20260612T090000Z', RRULE: 'FREQ=DAILY;UNTIL=20260614T090000Z' }),
    ]);
    const out = upcomingEvents(ics, { limit: 10, daysAhead: 30 });
    const dates = out.map((e) => e.start.toISOString().slice(0, 10));
    expect(dates).toEqual(['2026-06-12', '2026-06-13', '2026-06-14']);
  });

  it('skips occurrences before now but emits later ones (event began in the past)', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'OldDaily', DTSTART: '20260601T090000Z', RRULE: 'FREQ=DAILY' }),
    ]);
    const out = upcomingEvents(ics, { limit: 2, daysAhead: 10 });
    const dates = out.map((e) => e.start.toISOString().slice(0, 10));
    expect(dates[0] >= '2026-06-10').toBe(true);
    expect(dates).toHaveLength(2);
  });

  it('drops a finite recurring series whose COUNT is exhausted before now', () => {
    // Started 5 days ago, only 3 occurrences ever — all in the past.
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Done', DTSTART: '20260605T090000Z', RRULE: 'FREQ=DAILY;COUNT=3' }),
    ]);
    expect(upcomingEvents(ics)).toEqual([]);
  });

  it('expands FREQ=MONTHLY', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Monthly', DTSTART: '20260615T090000Z', RRULE: 'FREQ=MONTHLY' }),
    ]);
    const out = upcomingEvents(ics, { limit: 3, daysAhead: 200 });
    const dates = out.map((e) => e.start.toISOString().slice(0, 10));
    expect(dates).toEqual(['2026-06-15', '2026-07-15', '2026-08-15']);
  });

  it('expands FREQ=YEARLY', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Yearly', DTSTART: '20260815T090000Z', RRULE: 'FREQ=YEARLY' }),
    ]);
    const out = upcomingEvents(ics, { limit: 1, daysAhead: 365 });
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString().slice(0, 10)).toBe('2026-08-15');
  });

  it('falls back to base event when FREQ is unsupported', () => {
    const ics = buildICS([
      buildEvent({ SUMMARY: 'Weird', DTSTART: '20260615T090000Z', RRULE: 'FREQ=HOURLY' }),
    ]);
    const out = upcomingEvents(ics);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Weird');
  });
});

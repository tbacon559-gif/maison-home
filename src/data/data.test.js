import { describe, it, expect } from 'vitest';
import { WELCOME_MESSAGES, pickWelcomeMessage } from './welcome.js';
import {
  INITIAL_DAILY,
  INITIAL_WEEKLY,
  INITIAL_STREAK,
  INITIAL_MEALS,
  INITIAL_GROCERIES,
  INITIAL_TOBUY,
  INITIAL_NOTES,
  INITIAL_GIRLS,
  INITIAL_HOUSEHOLD,
  INITIAL_SITTER_NOTES,
  INITIAL_MOMENTS,
  INITIAL_SETTINGS,
  STREAK_THRESHOLD,
  GRACE_PER_MONTH,
  WEEK,
  FULL_DAY,
} from './initial.js';

describe('welcome messages', () => {
  it('exports a non-empty list', () => {
    expect(Array.isArray(WELCOME_MESSAGES)).toBe(true);
    expect(WELCOME_MESSAGES.length).toBeGreaterThan(0);
  });

  it('every message has eyebrow + body strings', () => {
    for (const m of WELCOME_MESSAGES) {
      expect(typeof m.eyebrow).toBe('string');
      expect(m.eyebrow.length).toBeGreaterThan(0);
      expect(typeof m.body).toBe('string');
      expect(m.body.length).toBeGreaterThan(0);
      if ('attribution' in m && m.attribution !== undefined) {
        expect(typeof m.attribution).toBe('string');
      }
    }
  });

  it('pickWelcomeMessage returns a member of the list', () => {
    for (let i = 0; i < 20; i++) {
      expect(WELCOME_MESSAGES).toContain(pickWelcomeMessage());
    }
  });
});

describe('initial seed data — daily/weekly tasks', () => {
  it('daily has day and night arrays of {id, label, done:false}', () => {
    for (const slot of ['day', 'night']) {
      expect(Array.isArray(INITIAL_DAILY[slot])).toBe(true);
      for (const t of INITIAL_DAILY[slot]) {
        expect(t.id).toBeTypeOf('number');
        expect(t.label).toBeTypeOf('string');
        expect(t.done).toBe(false);
      }
    }
  });

  it('all daily ids are unique across day + night', () => {
    const ids = [...INITIAL_DAILY.day, ...INITIAL_DAILY.night].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('weekly is an array of {id, label, done:false} with unique ids', () => {
    expect(Array.isArray(INITIAL_WEEKLY)).toBe(true);
    const ids = INITIAL_WEEKLY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of INITIAL_WEEKLY) expect(t.done).toBe(false);
  });
});

describe('initial seed data — streak constants', () => {
  it('STREAK_THRESHOLD is between 0 and 1', () => {
    expect(STREAK_THRESHOLD).toBeGreaterThan(0);
    expect(STREAK_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it('GRACE_PER_MONTH is a positive integer', () => {
    expect(Number.isInteger(GRACE_PER_MONTH)).toBe(true);
    expect(GRACE_PER_MONTH).toBeGreaterThan(0);
  });

  it('INITIAL_STREAK is a fresh zero-ed state', () => {
    expect(INITIAL_STREAK).toEqual({
      current: 0,
      best: 0,
      lastCheckedDate: null,
      graceUsedThisMonth: 0,
      graceMonth: null,
    });
  });
});

describe('initial seed data — meals', () => {
  it('WEEK lists every day Sun..Sat in order', () => {
    expect(WEEK).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('FULL_DAY has a mapping for every WEEK key', () => {
    for (const key of WEEK) {
      expect(FULL_DAY[key]).toBeTypeOf('string');
      expect(FULL_DAY[key].length).toBeGreaterThan(key.length);
    }
  });

  it('INITIAL_MEALS provides L/D for every day', () => {
    for (const key of WEEK) {
      expect(INITIAL_MEALS[key]).toBeDefined();
      for (const slot of ['L', 'D']) {
        expect(INITIAL_MEALS[key][slot]).toBeTypeOf('string');
      }
    }
  });
});

describe('initial seed data — lists and profiles', () => {
  it('grocery and to-buy items have shape {id, item, got:false}', () => {
    for (const list of [INITIAL_GROCERIES, INITIAL_TOBUY]) {
      for (const it of list) {
        expect(it.id).toBeTypeOf('number');
        expect(it.item).toBeTypeOf('string');
        expect(it.got).toBe(false);
      }
    }
  });

  it('notes start empty', () => {
    expect(INITIAL_NOTES).toEqual([]);
  });

  it('every initial girl has the fields the UI reads', () => {
    expect(INITIAL_GIRLS.length).toBeGreaterThan(0);
    for (const g of INITIAL_GIRLS) {
      for (const field of ['id', 'name', 'birthday', 'clothes', 'shoe', 'diaper', 'allergies']) {
        expect(g[field]).toBeDefined();
      }
      // birthday must be parseable as YYYY-MM-DD.
      expect(g.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('household has the three core entries with empty values for first-run', () => {
    const keys = INITIAL_HOUSEHOLD.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['Pediatrician', 'Emergency', 'Wi-Fi']));
    for (const h of INITIAL_HOUSEHOLD) expect(h.value).toBe('');
  });

  it('sitter notes and moments start empty; settings has the expected shape', () => {
    expect(INITIAL_SITTER_NOTES).toBe('');
    expect(INITIAL_MOMENTS).toEqual([]);
    expect(INITIAL_SETTINGS).toEqual({ calendarUrl: '', hasOpenedBefore: false });
  });
});

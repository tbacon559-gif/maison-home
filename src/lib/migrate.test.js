// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { hasLocalData } from './migrate.js';

beforeEach(() => {
  localStorage.clear();
});

describe('hasLocalData', () => {
  it('returns false when no localStorage keys exist', () => {
    expect(hasLocalData()).toBe(false);
  });

  it('returns false when only maison.imported_to_cloud is set', () => {
    localStorage.setItem('maison.imported_to_cloud', '1');
    expect(hasLocalData()).toBe(false);
  });

  it('returns true when any tracked key has non-trivial content', () => {
    localStorage.setItem('maison.daily', JSON.stringify({ day: [{ id: 1, label: 'a', done: false }], night: [] }));
    expect(hasLocalData()).toBe(true);
  });

  it('ignores empty array values', () => {
    localStorage.setItem('maison.notes', JSON.stringify([]));
    expect(hasLocalData()).toBe(false);
  });

  it('ignores the streak key (legacy)', () => {
    localStorage.setItem('maison.streak', JSON.stringify({ current: 5 }));
    expect(hasLocalData()).toBe(false);
  });

  it('detects girls data', () => {
    localStorage.setItem('maison.girls', JSON.stringify([{ id: 1, name: 'Mary' }]));
    expect(hasLocalData()).toBe(true);
  });

  it('detects calendar URL inside settings', () => {
    localStorage.setItem('maison.settings', JSON.stringify({ calendarUrl: 'https://example.com/ical' }));
    expect(hasLocalData()).toBe(true);
  });
});

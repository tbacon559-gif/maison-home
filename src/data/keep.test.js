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

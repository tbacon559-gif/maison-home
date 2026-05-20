import { describe, it, expect } from 'vitest';
import { generateShareToken } from './shareToken.js';

describe('generateShareToken', () => {
  it('produces a URL-safe string roughly 43 chars long', () => {
    const t = generateShareToken();
    expect(typeof t).toBe('string');
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(42);
    expect(t.length).toBeLessThanOrEqual(44);
  });

  it('produces distinct tokens across calls', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(generateShareToken());
    expect(seen.size).toBe(1000);
  });
});

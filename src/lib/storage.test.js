// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lsGet, lsSet, lsRemove, photoSave, photoGet, photoDelete, photoGetAll } from './storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('lsGet', () => {
  it('returns the fallback when the key is missing', () => {
    expect(lsGet('missing', 'default')).toBe('default');
    expect(lsGet('missing', null)).toBeNull();
  });

  it('returns the parsed value when present', () => {
    localStorage.setItem('maison.foo', JSON.stringify({ a: 1 }));
    expect(lsGet('foo', null)).toEqual({ a: 1 });
  });

  it('namespaces keys under "maison."', () => {
    lsSet('foo', 'bar');
    expect(localStorage.getItem('maison.foo')).toBe('"bar"');
    expect(localStorage.getItem('foo')).toBeNull();
  });

  it('returns the fallback on malformed JSON', () => {
    localStorage.setItem('maison.broken', '{not json');
    expect(lsGet('broken', 'safe')).toBe('safe');
  });

  it('returns the fallback when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(lsGet('foo', 'fallback')).toBe('fallback');
    spy.mockRestore();
  });
});

describe('lsSet', () => {
  it('serializes values as JSON', () => {
    lsSet('obj', { a: 1, b: [2, 3] });
    expect(JSON.parse(localStorage.getItem('maison.obj'))).toEqual({ a: 1, b: [2, 3] });
  });

  it('round-trips with lsGet', () => {
    lsSet('k', { hello: 'world' });
    expect(lsGet('k', null)).toEqual({ hello: 'world' });
  });

  it('swallows quota errors without throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => lsSet('full', 'x')).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    spy.mockRestore();
    errSpy.mockRestore();
  });
});

describe('lsRemove', () => {
  it('deletes the namespaced key', () => {
    lsSet('foo', 'bar');
    lsRemove('foo');
    expect(localStorage.getItem('maison.foo')).toBeNull();
  });

  it('does not throw when the key does not exist', () => {
    expect(() => lsRemove('never-set')).not.toThrow();
  });
});

describe('IndexedDB photo store', () => {
  // Each test uses unique ids since fake-indexeddb persists across tests within a file.
  let counter = 0;
  const nextId = () => `photo-${++counter}-${Date.now()}`;

  it('round-trips photoSave → photoGet', async () => {
    const id = nextId();
    await photoSave(id, 'data:image/png;base64,abc');
    expect(await photoGet(id)).toBe('data:image/png;base64,abc');
  });

  it('returns null for unknown ids', async () => {
    expect(await photoGet(nextId())).toBeNull();
  });

  it('photoDelete removes a saved entry', async () => {
    const id = nextId();
    await photoSave(id, 'x');
    await photoDelete(id);
    expect(await photoGet(id)).toBeNull();
  });

  it('photoGetAll returns a map of id → dataUrl for the requested ids', async () => {
    const id1 = nextId();
    const id2 = nextId();
    await photoSave(id1, 'one');
    await photoSave(id2, 'two');
    const out = await photoGetAll([id1, id2]);
    expect(out).toEqual({ [id1]: 'one', [id2]: 'two' });
  });

  it('photoGetAll([]) resolves to an empty object without opening a transaction', async () => {
    expect(await photoGetAll([])).toEqual({});
  });

  it('photoGetAll skips ids that have no entry', async () => {
    const present = nextId();
    const missing = nextId();
    await photoSave(present, 'here');
    const out = await photoGetAll([present, missing]);
    expect(out).toEqual({ [present]: 'here' });
  });
});

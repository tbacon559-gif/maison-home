import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { photoCache } from './photoCache.js';

const USER = '00000000-0000-0000-0000-000000000001';

beforeEach(async () => {
  await photoCache.clear();
});

describe('photoCache.put / photoCache.getPhoto', () => {
  it('returns null when no entry exists', async () => {
    expect(await photoCache.getPhoto(USER, 'm1')).toBeNull();
  });

  it('put then getPhoto returns the same bytes', async () => {
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    await photoCache.put(USER, 'm1', buf);
    const out = await photoCache.getPhoto(USER, 'm1');
    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf));
  });

  it('different moments are isolated', async () => {
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.put(USER, 'm2', new Uint8Array([2]).buffer);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm1'))[0]).toBe(1);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm2'))[0]).toBe(2);
  });

  it('different users for same moment id are isolated', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.put(userB, 'm1', new Uint8Array([2]).buffer);
    expect(new Uint8Array(await photoCache.getPhoto(USER, 'm1'))[0]).toBe(1);
    expect(new Uint8Array(await photoCache.getPhoto(userB, 'm1'))[0]).toBe(2);
  });
});

describe('photoCache.clear', () => {
  it('removes all entries', async () => {
    await photoCache.put(USER, 'm1', new Uint8Array([1]).buffer);
    await photoCache.clear();
    expect(await photoCache.getPhoto(USER, 'm1')).toBeNull();
  });
});

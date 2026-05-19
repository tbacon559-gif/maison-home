import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { cache } from './cache.js';

const USER = '00000000-0000-0000-0000-000000000001';

beforeEach(async () => {
  await cache.clear();
});

describe('cache.read / cache.write', () => {
  it('read returns null when no entry exists', async () => {
    expect(await cache.read('daily_tasks', USER)).toBeNull();
  });

  it('write then read returns the same rows', async () => {
    const rows = [{ id: 'a', label: 'one' }, { id: 'b', label: 'two' }];
    await cache.write('daily_tasks', USER, rows);
    expect(await cache.read('daily_tasks', USER)).toEqual(rows);
  });

  it('different tables for same user are isolated', async () => {
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('weekly_tasks', USER, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'a' }]);
    expect(await cache.read('weekly_tasks', USER)).toEqual([{ id: 'b' }]);
  });

  it('different users for same table are isolated', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('daily_tasks', userB, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'a' }]);
    expect(await cache.read('daily_tasks', userB)).toEqual([{ id: 'b' }]);
  });

  it('write overwrites previous value for same key', async () => {
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('daily_tasks', USER, [{ id: 'b' }]);
    expect(await cache.read('daily_tasks', USER)).toEqual([{ id: 'b' }]);
  });
});

describe('cache.clear', () => {
  it('removes all entries across tables and users', async () => {
    const userB = '00000000-0000-0000-0000-000000000002';
    await cache.write('daily_tasks', USER, [{ id: 'a' }]);
    await cache.write('weekly_tasks', userB, [{ id: 'b' }]);
    await cache.clear();
    expect(await cache.read('daily_tasks', USER)).toBeNull();
    expect(await cache.read('weekly_tasks', userB)).toBeNull();
  });
});

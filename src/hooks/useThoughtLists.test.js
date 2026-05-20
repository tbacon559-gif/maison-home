// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));

import { useThoughtLists } from './useThoughtLists.js';

let rows;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'thought_lists') throw new Error('unexpected table ' + table);
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          const out = rows
            .filter((r) => Object.entries(this._filter).every(([k, v]) => r[k] === v))
            .slice()
            .sort((a, b) => (a.position - b.position));
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { id: row.id ?? `id-${rows.length + 1}`, ...row };
          rows.push(inserted);
          return {
            select() { return this; },
            single: () => Promise.resolve({ data: inserted, error: null }),
          };
        },
        update(patch) {
          return {
            _filter: {},
            eq(col, val) { this._filter[col] = val; return this; },
            then(resolve) {
              for (const r of rows) {
                if (Object.entries(this._filter).every(([k, v]) => r[k] === v)) {
                  Object.assign(r, patch);
                }
              }
              resolve({ data: null, error: null });
            },
          };
        },
        delete() {
          return {
            _filter: {},
            eq(col, val) { this._filter[col] = val; return this; },
            then(resolve) {
              rows = rows.filter(
                (r) => !Object.entries(this._filter).every(([k, v]) => r[k] === v)
              );
              resolve({ data: null, error: null });
            },
          };
        },
      };
      return api;
    },
  };
}

beforeEach(() => { rows = []; });

describe('useThoughtLists', () => {
  it('starts empty and not loading after the initial fetch', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.active).toEqual([]);
    expect(result.current.archived).toEqual([]);
  });

  it('create() appends a new list to active and returns it', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let row;
    await act(async () => { row = await result.current.create('Birthday party'); });

    expect(row.title).toBe('Birthday party');
    expect(row.user_id).toBe('u1');
    expect(row.archived).toBe(false);
    expect(row.position).toBe(0);

    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0].title).toBe('Birthday party');
    expect(result.current.archived).toHaveLength(0);
  });

  it('create() positions each subsequent list after the previous', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('A'); });
    await act(async () => { await result.current.create('B'); });
    await act(async () => { await result.current.create('C'); });
    expect(result.current.active.map((l) => l.title)).toEqual(['A', 'B', 'C']);
    expect(result.current.active.map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it('rename() patches title in-place', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Old'); });
    await act(async () => { await result.current.rename(row.id, 'New'); });
    expect(result.current.active[0].title).toBe('New');
  });

  it('archive() moves a list into archived with archived_at set', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Plan'); });
    await act(async () => { await result.current.archive(row.id); });
    expect(result.current.active).toHaveLength(0);
    expect(result.current.archived).toHaveLength(1);
    expect(result.current.archived[0].archived).toBe(true);
    expect(result.current.archived[0].archived_at).toBeTruthy();
  });

  it('restore() returns an archived list to active and clears archived_at', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Plan'); });
    await act(async () => { await result.current.archive(row.id); });
    await act(async () => { await result.current.restore(row.id); });
    expect(result.current.active).toHaveLength(1);
    expect(result.current.archived).toHaveLength(0);
    expect(result.current.active[0].archived).toBe(false);
    expect(result.current.active[0].archived_at).toBeNull();
  });

  it('removeList() hard-deletes a list', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let row;
    await act(async () => { row = await result.current.create('Doomed'); });
    await act(async () => { await result.current.removeList(row.id); });
    expect(result.current.active).toHaveLength(0);
  });

  it('archived list ordering is most-recently-archived first', async () => {
    const { result } = renderHook(() => useThoughtLists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let a, b;
    await act(async () => { a = await result.current.create('A'); });
    await act(async () => { b = await result.current.create('B'); });
    await act(async () => { await result.current.archive(a.id); });
    // Tiny delay so archived_at timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    await act(async () => { await result.current.archive(b.id); });
    expect(result.current.archived.map((l) => l.title)).toEqual(['B', 'A']);
  });
});

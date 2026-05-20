// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));

import { useThoughtItems } from './useThoughtItems.js';

let rows;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'thought_items') throw new Error('unexpected table ' + table);
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          const out = rows
            .filter((r) => Object.entries(this._filter).every(([k, v]) => r[k] === v))
            .slice()
            .sort((a, b) => a.position - b.position);
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

describe('useThoughtItems', () => {
  it('starts empty for a list with no items', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('add() appends an item with the next position', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Milk'); });
    await act(async () => { await result.current.add('Eggs'); });
    expect(result.current.items.map((i) => i.text)).toEqual(['Milk', 'Eggs']);
    expect(result.current.items.map((i) => i.position)).toEqual([0, 1]);
    expect(result.current.items[0].list_id).toBe('list-1');
    expect(result.current.items[0].user_id).toBe('u1');
    expect(result.current.items[0].done).toBe(false);
  });

  it('toggle() flips done state', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('A'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.toggle(id); });
    expect(result.current.items[0].done).toBe(true);
    await act(async () => { await result.current.toggle(id); });
    expect(result.current.items[0].done).toBe(false);
  });

  it('edit() patches text in-place', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Old'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.edit(id, 'New'); });
    expect(result.current.items[0].text).toBe('New');
  });

  it('remove() deletes an item', async () => {
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.add('Gone'); });
    const id = result.current.items[0].id;
    await act(async () => { await result.current.remove(id); });
    expect(result.current.items).toEqual([]);
  });

  it('scopes items to the listId passed in', async () => {
    rows.push(
      { id: 'i1', list_id: 'other', user_id: 'u1', text: 'OTHER', done: false, position: 0 },
      { id: 'i2', list_id: 'list-1', user_id: 'u1', text: 'MINE', done: false, position: 0 },
    );
    const { result } = renderHook(() => useThoughtItems('list-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.text)).toEqual(['MINE']);
  });
});

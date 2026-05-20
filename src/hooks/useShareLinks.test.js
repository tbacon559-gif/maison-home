// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('../lib/shareToken.js', () => ({ generateShareToken: () => 'TOKEN_X' }));

import { useShareLinks } from './useShareLinks.js';
import { supabase } from '../lib/supabase.js';

// Mutable in-memory rows the mock reads/writes against
let rows;
let failNextUpdate;

function makeSupabaseMock() {
  return {
    from(table) {
      if (table !== 'share_links') throw new Error('unexpected table');
      const api = {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order(col, opts) {
          const asc = opts?.ascending !== false;
          let out = rows.filter((r) => {
            return Object.entries(this._filter).every(([k, v]) => r[k] === v);
          });
          out = [...out].sort((a, b) => {
            if (a[col] < b[col]) return asc ? -1 : 1;
            if (a[col] > b[col]) return asc ? 1 : -1;
            return 0;
          });
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { ...row };
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
              if (failNextUpdate) {
                resolve({ data: null, error: new Error('update failed') });
                return;
              }
              for (const r of rows) {
                if (Object.entries(this._filter).every(([k, v]) => r[k] === v)) {
                  Object.assign(r, patch);
                }
              }
              resolve({ data: null, error: null });
            },
          };
        },
      };
      return api;
    },
  };
}

beforeEach(() => { rows = []; failNextUpdate = false; });

describe('useShareLinks', () => {
  it('loads empty list initially', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.links).toEqual([]);
    expect(result.current.active).toEqual([]);
  });

  it('create() inserts a row with 12h expiry and returns it', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.create('Bath at 7');
    });

    expect(created.token).toBe('TOKEN_X');
    expect(created.owner_id).toBe('u1');
    expect(created.kind).toBe('sitter');
    expect(created.tonight_plan).toBe('Bath at 7');
    expect(created.revoked_at).toBeNull();
    const ms = new Date(created.expires_at).getTime() - new Date(created.created_at).getTime();
    expect(ms).toBeGreaterThanOrEqual(11 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(13 * 60 * 60 * 1000);

    expect(result.current.links).toHaveLength(1);
    expect(result.current.active).toHaveLength(1);
  });

  it('updatePlan() patches tonight_plan in-place', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('first'); });
    await act(async () => { await result.current.updatePlan('TOKEN_X', 'second'); });
    expect(result.current.links[0].tonight_plan).toBe('second');
  });

  it('revoke() sets revoked_at and removes the row from active', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('plan'); });
    expect(result.current.active).toHaveLength(1);

    await act(async () => { await result.current.revoke('TOKEN_X'); });
    expect(result.current.active).toHaveLength(0);
    expect(result.current.links[0].revoked_at).toBeTruthy();
  });

  it('active filters out expired rows', async () => {
    rows.push({
      token: 'EXPIRED', owner_id: 'u1', kind: 'sitter',
      tonight_plan: '', created_at: new Date(Date.now() - 1e7).toISOString(),
      expires_at: new Date(Date.now() - 1e6).toISOString(),
      revoked_at: null,
    });
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.links).toHaveLength(1);
    expect(result.current.active).toHaveLength(0);
  });

  it('loads existing rows newest-first', async () => {
    const future = new Date(Date.now() + 1e7).toISOString();
    rows.push(
      { token: 'OLD', owner_id: 'u1', kind: 'sitter', tonight_plan: '',
        created_at: '2026-01-01T00:00:00.000Z', expires_at: future, revoked_at: null },
      { token: 'NEW', owner_id: 'u1', kind: 'sitter', tonight_plan: '',
        created_at: '2026-02-01T00:00:00.000Z', expires_at: future, revoked_at: null },
    );
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.links.map((l) => l.token)).toEqual(['NEW', 'OLD']);
  });

  it('revoke() throws and leaves links unchanged when the update errors', async () => {
    const { result } = renderHook(() => useShareLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create('plan'); });
    expect(result.current.active).toHaveLength(1);

    failNextUpdate = true;
    await act(async () => {
      await expect(result.current.revoke('TOKEN_X')).rejects.toThrow('update failed');
    });
    expect(result.current.links[0].revoked_at).toBeFalsy();
    expect(result.current.active).toHaveLength(1);
  });
});

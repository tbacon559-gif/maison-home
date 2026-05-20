// @vitest-environment jsdom
//
// Integration test: ThoughtsTab with the REAL useThoughtLists /
// useThoughtItems hooks, only the Supabase client + auth mocked. This
// makes the hook state reactive, so UX behaviors that depend on a hook
// updating mid-interaction can actually be exercised — unlike the
// static-mock unit test in ThoughtsTab.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/auth.jsx', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('../lib/supabase.js', () => ({ supabase: makeSupabaseMock() }));

import { useThoughtLists } from '../hooks/useThoughtLists.js';
import ThoughtsTab from './ThoughtsTab.jsx';

// Two in-memory tables the mock reads/writes against.
let stores;

function makeSupabaseMock() {
  return {
    from(table) {
      const rowsOf = () => stores[table];
      return {
        _filter: {},
        select() { return this; },
        eq(col, val) { this._filter[col] = val; return this; },
        order() {
          const out = rowsOf()
            .filter((r) => Object.entries(this._filter).every(([k, v]) => r[k] === v))
            .slice()
            .sort((a, b) => a.position - b.position);
          return Promise.resolve({ data: out, error: null });
        },
        insert(row) {
          const inserted = { id: row.id ?? `${table}-${rowsOf().length + 1}`, ...row };
          rowsOf().push(inserted);
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
              for (const r of rowsOf()) {
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
              stores[table] = rowsOf().filter(
                (r) => !Object.entries(this._filter).every(([k, v]) => r[k] === v)
              );
              resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
}

function Harness() {
  const listsHook = useThoughtLists();
  return <ThoughtsTab listsHook={listsHook} />;
}

beforeEach(() => { stores = { thought_lists: [], thought_items: [] }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ThoughtsTab (integration)', () => {
  it('a list created via the new-list flow opens in edit mode', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText(/Nothing here yet/i);

    await user.click(screen.getByRole('button', { name: /\+ New list/i }));
    await user.type(await screen.findByPlaceholderText(/What is this/i), 'Party prep');
    await user.click(screen.getByRole('button', { name: /^Done$/ }));

    // The freshly created card must render in edit mode: its title is an
    // editable input and the "Delete list" button (edit-mode only) shows.
    expect(await screen.findByRole('button', { name: /Delete list/i })).toBeTruthy();
    expect(screen.getByDisplayValue('Party prep')).toBeTruthy();
  });

  it('clearing an item and blurring it in edit mode removes the item', async () => {
    const user = userEvent.setup();
    stores.thought_lists.push({
      id: 'L1', user_id: 'u1', title: 'Groceries',
      archived: false, archived_at: null, position: 0,
    });
    stores.thought_items.push({
      id: 'IT1', list_id: 'L1', user_id: 'u1',
      text: 'Milk', done: false, position: 0,
    });
    render(<Harness />);

    await screen.findByText('Groceries');
    await screen.findByText('Milk');

    // Enter edit mode for the card.
    await user.click(screen.getByRole('button', { name: /Edit/i }));
    const itemInput = await screen.findByDisplayValue('Milk');

    await user.clear(itemInput);
    fireEvent.blur(itemInput);

    // Empty-on-blur auto-remove: the item row (and its × delete button) is gone.
    await vi.waitFor(() => {
      expect(screen.queryByLabelText(/Delete item/i)).toBeNull();
    });
  });
});

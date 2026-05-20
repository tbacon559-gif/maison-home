// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useThoughtItems so each card receives a canned per-list items hook.
const itemsByList = {};
function makeItemsHook(listId) {
  if (!itemsByList[listId]) itemsByList[listId] = { items: [], loading: false };
  const bucket = itemsByList[listId];
  return {
    items: bucket.items,
    loading: bucket.loading,
    add: vi.fn(async (text) => {
      bucket.items = [...bucket.items, { id: `i-${bucket.items.length}`, text, done: false, position: bucket.items.length }];
    }),
    toggle: vi.fn(async (id) => {
      bucket.items = bucket.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    }),
    edit: vi.fn(async (id, text) => {
      bucket.items = bucket.items.map((i) => (i.id === id ? { ...i, text } : i));
    }),
    remove: vi.fn(async (id) => {
      bucket.items = bucket.items.filter((i) => i.id !== id);
    }),
  };
}
vi.mock('../hooks/useThoughtItems.js', () => ({
  useThoughtItems: (listId) => makeItemsHook(listId),
}));

import ThoughtsTab from './ThoughtsTab.jsx';

function makeListsHook(over = {}) {
  return {
    active: [],
    archived: [],
    loading: false,
    create: vi.fn(async (title) => ({ id: 'L1', title, archived: false, archived_at: null, position: 0 })),
    rename: vi.fn(async () => {}),
    archive: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    removeList: vi.fn(async () => {}),
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const k of Object.keys(itemsByList)) delete itemsByList[k];
});

describe('ThoughtsTab', () => {
  it('renders the subtitle and empty state when there are no lists', () => {
    render(<ThoughtsTab listsHook={makeListsHook()} />);
    expect(screen.getByText(/Lists for what you're holding/i)).toBeTruthy();
    expect(screen.getByText(/Nothing here yet/i)).toBeTruthy();
  });

  it('new-list flow: tap "+ New list", enter a title, tap Done → calls create()', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook();
    render(<ThoughtsTab listsHook={listsHook} />);
    await user.click(screen.getByRole('button', { name: /\+ New list/i }));
    const input = await screen.findByPlaceholderText(/What is this/i);
    await user.type(input, 'Birthday party');
    await user.click(screen.getByRole('button', { name: /^Done$/ }));
    expect(listsHook.create).toHaveBeenCalledWith('Birthday party');
  });

  it('renders active list cards with title and items', async () => {
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Shopping', archived: false, archived_at: null, position: 0 }],
    });
    itemsByList['L1'] = { items: [
      { id: 'a', text: 'Milk', done: false, position: 0 },
      { id: 'b', text: 'Eggs', done: true,  position: 1 },
    ], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    expect(await screen.findByText('Shopping')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('Mark complete → calls archive(id)', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Done soon', archived: false, archived_at: null, position: 0 }],
    });
    render(<ThoughtsTab listsHook={listsHook} />);
    await user.click(screen.getByRole('button', { name: /Mark complete/i }));
    expect(listsHook.archive).toHaveBeenCalledWith('L1');
  });

  it('Show archived expands and shows archived lists with Restore', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      archived: [{ id: 'A1', title: 'Old', archived: true, archived_at: '2026-05-19T00:00:00Z', position: 0 }],
    });
    itemsByList['A1'] = { items: [{ id: 'x', text: 'thing', done: true, position: 0 }], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    expect(screen.queryByText('Old')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Show archived/i }));
    expect(await screen.findByText('Old')).toBeTruthy();
    const restoreBtn = screen.getByRole('button', { name: /^Restore$/i });
    await user.click(restoreBtn);
    expect(listsHook.restore).toHaveBeenCalledWith('A1');
  });

  it('edit mode reveals Delete list and per-item × buttons', async () => {
    const user = userEvent.setup();
    const listsHook = makeListsHook({
      active: [{ id: 'L1', title: 'Editable', archived: false, archived_at: null, position: 0 }],
    });
    itemsByList['L1'] = { items: [{ id: 'a', text: 'one', done: false, position: 0 }], loading: false };
    render(<ThoughtsTab listsHook={listsHook} />);
    // The EditToggle component (src/components/Components.jsx) renders
    // the text "✎ Edit" when not editing and "Done" when editing.
    // Match the "Edit" substring — it's the only button containing it.
    const edit = screen.getByRole('button', { name: /Edit/i });
    await user.click(edit);
    expect(await screen.findByRole('button', { name: /Delete list/i })).toBeTruthy();
    // Item × delete carries aria-label "Delete item".
    expect(screen.getByLabelText(/Delete item/i)).toBeTruthy();
  });

  it('Show archived hides when archived.length is 0', () => {
    render(<ThoughtsTab listsHook={makeListsHook({ archived: [] })} />);
    expect(screen.queryByRole('button', { name: /Show archived/i })).toBeNull();
  });
});

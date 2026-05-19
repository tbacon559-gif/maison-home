// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import KitchenTab from './KitchenTab.jsx';
import { INITIAL_MEALS, INITIAL_GROCERIES, INITIAL_TOBUY } from '../data/initial.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ initialMeals = INITIAL_MEALS, initialGroceries = INITIAL_GROCERIES, initialToBuy = INITIAL_TOBUY }) {
  const [meals, setMeals] = useState(initialMeals);
  const [groceries, setGroceries] = useState(initialGroceries);
  const [toBuy, setToBuy] = useState(initialToBuy);
  const [editingDay, setEditingDay] = useState(null);
  const [editingGroceries, setEditingGroceries] = useState(false);
  const [editingToBuy, setEditingToBuy] = useState(false);
  return (
    <KitchenTab
      meals={meals}
      setMeals={setMeals}
      groceries={groceries}
      setGroceries={setGroceries}
      toBuy={toBuy}
      setToBuy={setToBuy}
      editingDay={editingDay}
      setEditingDay={setEditingDay}
      editingGroceries={editingGroceries}
      setEditingGroceries={setEditingGroceries}
      editingToBuy={editingToBuy}
      setEditingToBuy={setEditingToBuy}
    />
  );
}

describe('KitchenTab', () => {
  it('renders the three top-level sections', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^Meals/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Grocery List/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^To-Buy/ })).toBeTruthy();
  });

  it('expands a day to show lunch and dinner', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Monday/ }));
    expect(screen.queryByText(/Bkfst/i)).toBeNull();
    expect(screen.getByText(/Lunch/i)).toBeTruthy();
    // "who's home for dinner?" hint + the Dinner slot label both match /Dinner/i
    expect(screen.getAllByText(/Dinner/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(INITIAL_MEALS.Mon.L)).toBeTruthy();
  });

  it('edits a meal slot when in edit mode', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Monday/ }));
    await user.click(screen.getByRole('button', { name: /✎ Edit/i }));

    const lunchInput = screen.getAllByDisplayValue(INITIAL_MEALS.Mon.L)[0];
    await user.clear(lunchInput);
    await user.type(lunchInput, 'Soup');
    expect(lunchInput.value).toBe('Soup');
  });

  it('switches the open dropdown when a different one is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Meals is open by default — Monday is visible.
    expect(screen.getByText('Monday')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Grocery List/ }));
    expect(screen.queryByText('Monday')).toBeNull();
  });

  it('shows initial grocery items when grocery dropdown is open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Grocery List/ }));
    for (const g of INITIAL_GROCERIES) {
      expect(screen.getByText(g.item)).toBeTruthy();
    }
  });

  it('toggles a grocery item as got', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Grocery List/ }));

    // Find the first grocery item's checkbox button (the one wrapping a Checkbox).
    const firstItemText = screen.getByText(INITIAL_GROCERIES[0].item);
    const row = firstItemText.closest('div');
    const checkboxBtn = within(row).getByRole('button');
    await user.click(checkboxBtn);

    // After toggling, the item text gets line-through class.
    const updated = screen.getByText(INITIAL_GROCERIES[0].item);
    expect(updated.className).toMatch(/line-through/);
  });

  it('adds and types into a new grocery item', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Grocery List/ }));
    await user.click(screen.getByRole('button', { name: /✎ Edit/i }));
    await user.click(screen.getByRole('button', { name: /Add to the list/i }));

    // Find the empty input that was just added.
    const inputs = screen.getAllByPlaceholderText(/Item\./);
    const newInput = inputs[inputs.length - 1];
    expect(newInput.value).toBe('');
    await user.type(newInput, 'Bananas');
    expect(newInput.value).toBe('Bananas');
  });

  it('shows the to-buy hint with the correct remaining count', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toBuyBtn = screen.getByRole('button', { name: /^To-Buy/ });
    expect(toBuyBtn.textContent).toContain(`${INITIAL_TOBUY.length} left`);
  });
});

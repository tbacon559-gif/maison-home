// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TidyTab from './TidyTab.jsx';

// TidyTab now consumes dailyHook and weeklyHook props. We pass canned hook
// objects so the component renders without needing live Supabase. The
// behavioral test of mutations through the real hooks happens in the
// end-to-end smoke pass (Task 27).

afterEach(cleanup);

function makeDailyHook(day = [], night = []) {
  return {
    day, night,
    loading: false,
    toggle: () => {}, add: () => {}, edit: () => {}, remove: () => {}, resetAll: () => {},
  };
}
function makeWeeklyHook(tasks = []) {
  return {
    tasks,
    loading: false,
    toggle: () => {}, add: () => {}, edit: () => {}, remove: () => {}, resetAll: () => {},
  };
}

describe('TidyTab', () => {
  it('renders the Daily section heading', () => {
    render(
      <TidyTab
        dailyHook={makeDailyHook()}
        weeklyHook={makeWeeklyHook()}
        editingDaily={false} setEditingDaily={() => {}}
        editingWeekly={false} setEditingWeekly={() => {}}
      />
    );
    expect(screen.getByText('The Rhythm')).toBeTruthy();
    expect(screen.getByText('The Bigger Stuff')).toBeTruthy();
  });

  it('shows daily task labels passed in via the hook', () => {
    const dailyHook = makeDailyHook(
      [{ id: 'a', label: 'Wipe down counters', done: false, slot: 'day', position: 0 }],
      [{ id: 'b', label: 'Run dishwasher',     done: false, slot: 'night', position: 0 }]
    );
    render(
      <TidyTab
        dailyHook={dailyHook}
        weeklyHook={makeWeeklyHook()}
        editingDaily={false} setEditingDaily={() => {}}
        editingWeekly={false} setEditingWeekly={() => {}}
      />
    );
    expect(screen.getByText('Wipe down counters')).toBeTruthy();
    expect(screen.getByText('Run dishwasher')).toBeTruthy();
  });

  it('shows weekly task labels passed in via the hook', () => {
    const weeklyHook = makeWeeklyHook([
      { id: 'w1', label: 'Mop kitchen floor', done: false, position: 0 },
    ]);
    render(
      <TidyTab
        dailyHook={makeDailyHook()}
        weeklyHook={weeklyHook}
        editingDaily={false} setEditingDaily={() => {}}
        editingWeekly={false} setEditingWeekly={() => {}}
      />
    );
    expect(screen.getByText('Mop kitchen floor')).toBeTruthy();
  });
});

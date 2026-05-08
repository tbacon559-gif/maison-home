// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import TidyTab from './TidyTab.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Wrapper that gives the component real state hooks so user interactions reflect.
function Harness({ initialDaily, initialWeekly, initialStreak }) {
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [streak, setStreak] = useState(initialStreak);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  return (
    <TidyTab
      daily={daily}
      setDaily={setDaily}
      weekly={weekly}
      setWeekly={setWeekly}
      streak={streak}
      setStreak={setStreak}
      editingDaily={editingDaily}
      setEditingDaily={setEditingDaily}
      editingWeekly={editingWeekly}
      setEditingWeekly={setEditingWeekly}
    />
  );
}

const sampleDaily = {
  day: [
    { id: 1, label: 'Wipe counters', done: false },
    { id: 2, label: 'Make beds', done: false },
  ],
  night: [{ id: 3, label: 'Run dishwasher', done: false }],
};

const sampleWeekly = [
  { id: 11, label: 'Mop floor', done: false },
  { id: 12, label: 'Vacuum rugs', done: false },
];

const sampleStreak = {
  current: 3,
  best: 5,
  lastCheckedDate: '2026-06-09',
  graceUsedThisMonth: 0,
  graceMonth: '2026-06',
};

describe('TidyTab', () => {
  it('renders streak count and progress (0/3 to start)', () => {
    render(<Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} initialStreak={sampleStreak} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/0\/3/)).toBeTruthy();
  });

  it('toggles a daily task when its checkbox is tapped', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} initialStreak={sampleStreak} />
    );
    // First checkbox button corresponds to first day task.
    const firstTaskRow = container.querySelector('.checkbox').closest('button');
    await user.click(firstTaskRow);
    // Progress text updates from 0/3 to 1/3.
    expect(screen.getByText(/1\/3/)).toBeTruthy();
  });

  it('disables the Rest day button when grace is exhausted', () => {
    // graceMonth must match the current real month for graceRemaining() to
    // count the used slots — otherwise it resets to a full allowance.
    const currentMonth = new Date().toISOString().slice(0, 7);
    render(
      <Harness
        initialDaily={sampleDaily}
        initialWeekly={sampleWeekly}
        initialStreak={{ ...sampleStreak, graceUsedThisMonth: 2, graceMonth: currentMonth }}
      />
    );
    const restBtn = screen.getByRole('button', { name: /Rest day/i });
    expect(restBtn.disabled).toBe(true);
  });

  it('rest day requires confirmation and increments the streak when accepted', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} initialStreak={sampleStreak} />);

    await user.click(screen.getByRole('button', { name: /Rest day/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Streak count went 3 → 4.
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('rest day no-ops when user cancels confirm', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} initialStreak={sampleStreak} />);

    await user.click(screen.getByRole('button', { name: /Rest day/i }));
    // Streak still 3.
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders the weekly task labels', () => {
    render(<Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} initialStreak={sampleStreak} />);
    expect(screen.getByText('Mop floor')).toBeTruthy();
    expect(screen.getByText('Vacuum rugs')).toBeTruthy();
  });
});

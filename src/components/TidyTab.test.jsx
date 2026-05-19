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
function Harness({ initialDaily, initialWeekly }) {
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  return (
    <TidyTab
      daily={daily}
      setDaily={setDaily}
      weekly={weekly}
      setWeekly={setWeekly}
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

describe('TidyTab', () => {
  it('toggles a daily task when its checkbox is tapped', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} />
    );
    // First checkbox button corresponds to first day task (Daytime slot has 2 tasks).
    const firstTaskRow = container.querySelector('.checkbox').closest('button');
    await user.click(firstTaskRow);
    // Daytime slot progress updates from 0/2 to 1/2.
    expect(screen.getByText((_, el) => el?.textContent === '1/2' && el.className.includes('muted'))).toBeTruthy();
  });

  it('renders the weekly task labels', () => {
    render(<Harness initialDaily={sampleDaily} initialWeekly={sampleWeekly} />);
    expect(screen.getByText('Mop floor')).toBeTruthy();
    expect(screen.getByText('Vacuum rugs')).toBeTruthy();
  });
});

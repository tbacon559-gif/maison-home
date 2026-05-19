// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

// App is the orchestrator — these are smoke tests that verify the shell:
// rendering, tab switching, settings modal, and a couple of the lightest
// state interactions on the Today tab. Deeper per-tab behavior lives in the
// individual component test files.

beforeEach(() => {
  localStorage.clear();
  // Pin Math.random so the welcome message picker is deterministic.
  vi.spyOn(Math, 'random').mockReturnValue(0);
  // Calendar URL is empty by default → fetchCalendar early-exits, so we don't
  // need fetch to actually do anything. Stub it just in case.
  globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
  // Silence the expected "Calendar fetch failed" console.error during the
  // settings-save test; surface real errors by inspecting the spy on demand.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe('App shell', () => {
  it('renders the MAISON header on the Today tab', () => {
    render(<App />);
    expect(screen.getByText('MAISON')).toBeTruthy();
  });

  it('renders the welcome overlay on first open', () => {
    render(<App />);
    expect(screen.getByText(/tap to continue/i)).toBeTruthy();
  });

  it('renders all five bottom-nav tabs', () => {
    render(<App />);
    for (const label of ['Today', 'The Keeping', 'Kitchen', 'Girls', 'Moments']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it("shows the calendar 'connect in settings' hint when no URL is set", () => {
    render(<App />);
    expect(screen.getByText(/Connect a calendar in settings/i)).toBeTruthy();
  });
});

describe('App tab switching', () => {
  it('navigates to the Kitchen tab and shows the meals dropdown', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Kitchen' }));
    expect(screen.getByRole('button', { name: /^Meals/ })).toBeTruthy();
  });

  it('navigates to the Girls tab and lists each daughter', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Girls' }));
    expect(screen.getByText('Mary Nolen')).toBeTruthy();
    expect(screen.getByText('Ruth')).toBeTruthy();
  });

  it('navigates to the Moments tab and shows the empty-state hint', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Moments' }));
    expect(screen.getByText(/When something matters today/i)).toBeTruthy();
  });
});

describe('App — Settings modal', () => {
  it('opens when the ⚙ button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Settings'));
    expect(screen.getByPlaceholderText(/Secret iCal URL/i)).toBeTruthy();
  });

  it('persists the saved calendar URL to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Settings'));
    const input = screen.getByPlaceholderText(/Secret iCal URL/i);
    await user.type(input, 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics');
    await user.click(screen.getByRole('button', { name: /Save/i }));

    const stored = JSON.parse(localStorage.getItem('maison.settings'));
    expect(stored.calendarUrl).toBe('https://calendar.google.com/calendar/ical/x/private-y/basic.ics');
  });
});

describe('App — Quick Notes on Today tab', () => {
  it('adds a typed note to the persistent list', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/Hold this for me/i);
    await user.type(input, 'Pick up dry cleaning');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(screen.getByText('Pick up dry cleaning')).toBeTruthy();
    expect(input.value).toBe('');

    const stored = JSON.parse(localStorage.getItem('maison.notes'));
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Pick up dry cleaning');
  });

  it('does not add an empty/whitespace note', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/Hold this for me/i);
    const addBtn = screen.getByRole('button', { name: /^Add$/ });
    expect(addBtn.disabled).toBe(true);

    await user.type(input, '   ');
    expect(addBtn.disabled).toBe(true);
  });
});

describe('App — persistence', () => {
  it('reloads daily/notes/settings state from localStorage on remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const input = screen.getByPlaceholderText(/Hold this for me/i);
    await user.type(input, 'Persisted note');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    unmount();

    render(<App />);
    expect(screen.getByText('Persisted note')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SitterShareModal from './SitterShareModal.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup(props = {}) {
  const onCreate = vi.fn(async (plan) => ({
    token: 'TKN', tonight_plan: plan,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    revoked_at: null,
  }));
  const onSave = vi.fn(async () => {});
  const onClose = vi.fn();
  const utils = render(
    <SitterShareModal
      open={true}
      mode="create"
      editing={null}
      onCreate={onCreate}
      onSave={onSave}
      onClose={onClose}
      {...props}
    />
  );
  return { ...utils, onCreate, onSave, onClose };
}

describe('SitterShareModal', () => {
  it('renders create state with an empty Tonight textarea and Create link button', () => {
    setup();
    expect(screen.getByText(/A Live Link/i)).toBeTruthy();
    const textarea = screen.getByLabelText(/Tonight/i);
    expect(textarea.value).toBe('');
    expect(screen.getByRole('button', { name: /Create link/i })).toBeTruthy();
  });

  it('calls onCreate with the textarea value when Create link is tapped', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup();
    await user.type(screen.getByLabelText(/Tonight/i), 'Bath at 7');
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    expect(onCreate).toHaveBeenCalledWith('Bath at 7');
  });

  it('transitions to ready state after create — shows URL and Copy/Done buttons', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    expect(await screen.findByText(/Ready/i)).toBeTruthy();
    const url = screen.getByText(/\/share\/sitter\/TKN$/);
    expect(url).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy link/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Done/i })).toBeTruthy();
  });

  it('copies the URL to clipboard when Copy link is tapped', async () => {
    const user = userEvent.setup();
    // Define the clipboard mock AFTER userEvent.setup() — setup() installs
    // its own navigator.clipboard stub, so ours has to win the last write.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText }, configurable: true,
    });
    setup();
    await user.click(screen.getByRole('button', { name: /Create link/i }));
    await user.click(await screen.findByRole('button', { name: /Copy link/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/share\/sitter\/TKN$/));
  });

  it('edit mode pre-fills the textarea and calls onSave', async () => {
    const user = userEvent.setup();
    const editing = {
      token: 'TKN', tonight_plan: 'existing plan',
      expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    };
    const onSave = vi.fn(async () => {});
    render(
      <SitterShareModal
        open={true}
        mode="edit"
        editing={editing}
        onCreate={async () => {}}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByLabelText(/Tonight/i);
    expect(textarea.value).toBe('existing plan');
    await user.clear(textarea);
    await user.type(textarea, 'updated plan');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSave).toHaveBeenCalledWith('TKN', 'updated plan');
  });
});

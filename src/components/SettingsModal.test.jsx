// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from './SettingsModal.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseSettings = { calendarUrl: '', hasOpenedBefore: true };

function renderModal(overrides = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const onClearAll = vi.fn();
  render(
    <SettingsModal
      open
      onClose={onClose}
      settings={overrides.settings ?? baseSettings}
      onSave={onSave}
      onClearAll={onClearAll}
    />
  );
  return { onSave, onClose, onClearAll };
}

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SettingsModal open={false} onClose={onClose} settings={baseSettings} onSave={() => {}} onClearAll={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the existing calendarUrl in the input', () => {
    renderModal({ settings: { ...baseSettings, calendarUrl: 'https://calendar.google.com/foo' } });
    const input = screen.getByPlaceholderText(/secret iCal URL/i);
    expect(input.value).toBe('https://calendar.google.com/foo');
  });

  it('saves the trimmed calendar URL and closes', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();

    const input = screen.getByPlaceholderText(/secret iCal URL/i);
    await user.type(input, '  https://calendar.google.com/x  ');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ calendarUrl: 'https://calendar.google.com/x' })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles the help instructions panel', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByText(/Open Google Calendar on a computer/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /How to find this/i }));
    expect(screen.getByText(/Open Google Calendar on a computer/i)).toBeTruthy();
  });

  it('Clear-all flow requires confirm() and only fires when accepted', async () => {
    const user = userEvent.setup();
    const { onClearAll, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /Reset everything/i }));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /Clear all data/i }));
    expect(onClearAll).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /Clear all data/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SettingsModal from './SettingsModal.jsx';
import { AuthProvider } from '../lib/auth.jsx';

// SettingsModal now uses profile + profileHook props and embeds AccountSettings,
// which calls useAuth(). For tests we wrap in <AuthProvider> (which won't have a
// session — that's fine; AccountSettings just won't render founding badge or work
// for delete). Substantive verification happens via the end-to-end smoke pass.

afterEach(cleanup);

const mockProfile = { calendar_url: 'https://example.com/ical', greeting_name: 'Test' };
const mockProfileHook = { profile: mockProfile, update: async () => {} };

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AuthProvider>
        <SettingsModal open={false} onClose={() => {}} profile={mockProfile} profileHook={mockProfileHook} />
      </AuthProvider>
    );
    expect(container.textContent).toBe('');
  });

  it('renders the Settings heading when open', () => {
    render(
      <AuthProvider>
        <SettingsModal open={true} onClose={() => {}} profile={mockProfile} profileHook={mockProfileHook} />
      </AuthProvider>
    );
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows the existing calendar URL pre-filled', () => {
    render(
      <AuthProvider>
        <SettingsModal open={true} onClose={() => {}} profile={mockProfile} profileHook={mockProfileHook} />
      </AuthProvider>
    );
    const input = screen.getByDisplayValue('https://example.com/ical');
    expect(input).toBeTruthy();
  });
});

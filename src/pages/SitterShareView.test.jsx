// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import SitterShareView from './SitterShareView.jsx';

const FUTURE = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 3600 * 1000).toISOString();

const fullPayload = {
  tonight_plan: 'Bath at 7. Books, then lights.',
  sitter_notes: 'Mary naps at 1.',
  owner_name: 'Tiff',
  kids: [
    { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
      shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
    { name: 'Ruth', birthday: '2024-08-10', clothes_size: '12m',
      shoe_size: '3', diaper_size: 'Size 4', allergies: '' },
  ],
  household: [
    { label: 'Pediatrician', value: 'Dr. Smith — 555-0100' },
    { label: 'WiFi', value: 'house-wifi · honeysuckle' },
  ],
  created_at: PAST,
  expires_at: FUTURE,
};

function mockFetch(impl) {
  globalThis.fetch = vi.fn(impl);
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { cleanup(); delete globalThis.fetch; });

describe('SitterShareView', () => {
  it('renders all sections for a valid token', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => fullPayload }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/Tiff's home/i)).toBeTruthy();
    expect(screen.getByText(/Bath at 7/)).toBeTruthy();
    expect(screen.getByText('Mary')).toBeTruthy();
    expect(screen.getByText('Ruth')).toBeTruthy();
    expect(screen.getByText('Pediatrician')).toBeTruthy();
    expect(screen.getByText(/Mary naps at 1/)).toBeTruthy();
    expect(screen.getByText(/Live until/)).toBeTruthy();
  });

  it('falls back to "Tonight" header when owner_name is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, owner_name: '' }),
    }));
    render(<SitterShareView token="abc" />);
    // The page header falls back to "Tonight"; the tonight_plan section
    // also has a "Tonight" label, so target the <h1> heading specifically.
    expect(await screen.findByRole('heading', { name: /^Tonight$/ })).toBeTruthy();
    expect(screen.queryByText(/'s home/)).toBeNull();
  });

  it('omits Tonight section when tonight_plan is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, tonight_plan: '' }),
    }));
    render(<SitterShareView token="abc" />);
    await screen.findByText(/Tiff's home/i);
    expect(screen.queryByText(/Bath at 7/)).toBeNull();
  });

  it('omits Notes section when sitter_notes is empty', async () => {
    mockFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ ...fullPayload, sitter_notes: '' }),
    }));
    render(<SitterShareView token="abc" />);
    await screen.findByText(/Tiff's home/i);
    expect(screen.queryByText(/Mary naps at 1/)).toBeNull();
  });

  it('renders ended state on 404', async () => {
    mockFetch(async () => ({
      ok: false, status: 404, json: async () => ({ status: 'ended' }),
    }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/This link has ended/i)).toBeTruthy();
    expect(screen.getByText(/Ask the parent for a new one/i)).toBeTruthy();
  });

  it('renders server-error state on 500', async () => {
    mockFetch(async () => ({
      ok: false, status: 500, json: async () => ({ status: 'error' }),
    }));
    render(<SitterShareView token="abc" />);
    expect(await screen.findByText(/Something went wrong/i)).toBeTruthy();
  });

  it('renders error state on network failure', async () => {
    mockFetch(async () => { throw new Error('network'); });
    render(<SitterShareView token="abc" />);
    await waitFor(() =>
      expect(screen.getByText(/Something went wrong/i)).toBeTruthy()
    );
  });
});

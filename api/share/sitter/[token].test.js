import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../_supabase.js', () => ({ getServiceClient: vi.fn() }));

import handler from './[token].js';
import { getServiceClient } from '../../_supabase.js';

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
  return res;
}

// Tiny fluent mock of the Supabase query builder for the calls this
// route makes: .from(table).select('...').eq(...).maybeSingle() and
// .from(table).select('...').eq(...).order(...).
function makeClient({ shareLinkRow, profile, kids, household, profileError, kidsError, householdError }) {
  return {
    from(table) {
      if (table === 'share_links') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: shareLinkRow ?? null, error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: profile ?? null, error: profileError ?? null }),
        };
      }
      if (table === 'kids') {
        return {
          select() { return this; },
          eq() { return this; },
          order: async () => ({ data: kids ?? [], error: kidsError ?? null }),
        };
      }
      if (table === 'household_items') {
        return {
          select() { return this; },
          eq() { return this; },
          order: async () => ({ data: household ?? [], error: householdError ?? null }),
        };
      }
      throw new Error('unexpected table: ' + table);
    },
  };
}

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/share/sitter/[token]', () => {
  it('returns 404 when token query param is missing', async () => {
    getServiceClient.mockReturnValue(makeClient({}));
    const req = { query: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 404 when token is unknown', async () => {
    getServiceClient.mockReturnValue(makeClient({ shareLinkRow: null }));
    const req = { query: { token: 'nope' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 404 when the token has been revoked', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: new Date().toISOString(),
      },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 404 when the token has expired', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: PAST,
        revoked_at: null,
      },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: 'ended' });
  });

  it('returns 200 with the full shape for a valid token', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1',
        tonight_plan: 'Bath at 7. Books, then lights.',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: null,
      },
      profile: { greeting_name: 'Tiff', sitter_notes: 'Mary naps at 1.' },
      kids: [
        { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
          shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
      ],
      household: [{ label: 'Pediatrician', value: 'Dr. Smith — 555-0100' }],
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      tonight_plan: 'Bath at 7. Books, then lights.',
      sitter_notes: 'Mary naps at 1.',
      owner_name: 'Tiff',
      kids: [
        { name: 'Mary', birthday: '2022-06-27', clothes_size: '3T',
          shoe_size: '7', diaper_size: 'Pull-Ups 3T', allergies: 'None' },
      ],
      household: [{ label: 'Pediatrician', value: 'Dr. Smith — 555-0100' }],
    });
    expect(res.body.created_at).toBeTruthy();
    expect(res.body.expires_at).toBeTruthy();
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 500 when the service client throws', async () => {
    getServiceClient.mockImplementation(() => {
      throw new Error('boom');
    });
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error' });
  });

  it('returns 500 when the profile query errors', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: null,
      },
      profileError: { message: 'profile boom' },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error' });
  });

  it('returns 500 when the kids query errors', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: null,
      },
      kidsError: { message: 'kids boom' },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error' });
  });

  it('returns 500 when the household query errors', async () => {
    getServiceClient.mockReturnValue(makeClient({
      shareLinkRow: {
        token: 'abc', owner_id: 'u1', tonight_plan: '',
        created_at: PAST, expires_at: FUTURE,
        revoked_at: null,
      },
      householdError: { message: 'household boom' },
    }));
    const req = { query: { token: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error' });
  });
});

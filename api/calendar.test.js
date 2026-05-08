import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from './calendar.js';

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
}

const ICS_BODY = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => ICS_BODY,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe('GET /api/calendar — input validation', () => {
  it('returns 400 when url is missing', async () => {
    const res = mockRes();
    await handler({ query: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing url parameter' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 for unparseable URLs', async () => {
    const res = mockRes();
    await handler({ query: { url: 'not a url' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid URL' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/calendar — host whitelist (security boundary)', () => {
  it('rejects arbitrary hosts', async () => {
    const res = mockRes();
    await handler({ query: { url: 'https://evil.com/feed.ics' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Only Google Calendar URLs are allowed' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects subdomain spoofing (calendar.google.com.evil.com)', async () => {
    const res = mockRes();
    await handler({ query: { url: 'https://calendar.google.com.evil.com/x' } }, res);
    expect(res.statusCode).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects userinfo-prefixed URLs (host is the part after @)', async () => {
    // URL parser sees hostname = evil.com here, so this must NOT be allowed.
    const res = mockRes();
    await handler({ query: { url: 'https://calendar.google.com@evil.com/x' } }, res);
    expect(res.statusCode).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows calendar.google.com', async () => {
    const res = mockRes();
    await handler(
      { query: { url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics' } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('allows www.google.com', async () => {
    const res = mockRes();
    await handler({ query: { url: 'https://www.google.com/calendar/ical/x' } }, res);
    expect(res.statusCode).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/calendar — proxy behavior', () => {
  it('forwards the body and sets Content-Type + Cache-Control on success', async () => {
    const res = mockRes();
    await handler(
      { query: { url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics' } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(ICS_BODY);
    expect(res.headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(res.headers['Cache-Control']).toMatch(/s-maxage=300/);
    expect(res.headers['Cache-Control']).toMatch(/stale-while-revalidate=600/);
  });

  it('sends a User-Agent header upstream', async () => {
    const res = mockRes();
    await handler(
      { query: { url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics' } },
      res
    );
    const [, opts] = globalThis.fetch.mock.calls[0];
    expect(opts.headers['User-Agent']).toBe('Maison/1.0');
  });

  it('forwards the upstream status code on non-2xx responses', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' }));
    const res = mockRes();
    await handler(
      { query: { url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics' } },
      res
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Calendar fetch failed: 404' });
  });

  it('returns 500 with a detail string when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom');
    });
    const res = mockRes();
    await handler(
      { query: { url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics' } },
      res
    );
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to fetch calendar');
    expect(res.body.detail).toContain('boom');
  });
});

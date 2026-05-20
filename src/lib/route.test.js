import { describe, it, expect } from 'vitest';
import { parseRoute } from './route.js';

describe('parseRoute', () => {
  it('returns app mode for / and unknown paths', () => {
    expect(parseRoute('/')).toEqual({ mode: 'app' });
    expect(parseRoute('/anything-else')).toEqual({ mode: 'app' });
    expect(parseRoute('')).toEqual({ mode: 'app' });
  });

  it('returns share-sitter mode + token for /share/sitter/:token', () => {
    expect(parseRoute('/share/sitter/abc123')).toEqual({
      mode: 'share-sitter', token: 'abc123',
    });
    expect(parseRoute('/share/sitter/AB-CD_ef')).toEqual({
      mode: 'share-sitter', token: 'AB-CD_ef',
    });
  });

  it('returns app mode when token is missing', () => {
    expect(parseRoute('/share/sitter/')).toEqual({ mode: 'app' });
    expect(parseRoute('/share/sitter')).toEqual({ mode: 'app' });
  });

  it('returns app mode for share paths with extra segments', () => {
    expect(parseRoute('/share/sitter/abc/extra')).toEqual({ mode: 'app' });
  });
});

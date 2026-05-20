// Parse window.location.pathname into an app mode. Returns either
// { mode: 'app' } (mount the normal app tree with AuthProvider)
// or { mode: 'share-sitter', token: '...' } (mount SitterShareView
// alone, no AuthProvider — visitors don't get stray anon accounts).

export function parseRoute(pathname) {
  if (typeof pathname !== 'string') return { mode: 'app' };
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'share' && parts[1] === 'sitter') {
    return { mode: 'share-sitter', token: parts[2] };
  }
  return { mode: 'app' };
}

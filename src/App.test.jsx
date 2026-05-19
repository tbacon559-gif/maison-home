import { describe, it, expect } from 'vitest';
import App from './App.jsx';

// App.jsx now requires <AuthProvider> context and a live Supabase project.
// Substantive verification happens via the end-to-end smoke pass (Task 27),
// not unit tests. This file is kept only to verify the module imports cleanly.

describe('App module', () => {
  it('is importable', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});

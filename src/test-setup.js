import { vi } from 'vitest';

// Some test files transitively import src/lib/supabase.js, which throws at
// module-load time if these env vars are missing. Set dummy values so the
// client constructs cleanly. Tests that actually exercise Supabase calls
// mock the module directly via vi.mock('../lib/supabase.js', …).
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

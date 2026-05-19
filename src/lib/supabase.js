// ─── Supabase client singleton ────────────────────────────────────
// Env vars come from .env.local (development) and Vercel project settings
// (production). See docs/superpowers/specs/2026-05-19-maison-productize-design.md
// for the project setup steps.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your project URL and anon key.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

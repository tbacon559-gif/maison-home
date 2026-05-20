// Service-role Supabase client for Vercel serverless functions.
// Singleton across cold-start invocations. The service-role key
// bypasses RLS — never expose it to the browser or log it.

import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getServiceClient() {
  if (cached) return cached;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

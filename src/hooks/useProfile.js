// ─── useProfile — read/update the user's profile row ──────────────
// Profile is loaded by AuthProvider on signin; this hook exposes mutation
// methods that update the row and refresh local state.

import { useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useProfile() {
  const { profile, setProfile, userId } = useAuth();

  const update = useCallback(async (patch) => {
    if (!userId) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    const { error } = await supabase
      .from('profiles').update(patch).eq('id', userId);
    if (error) {
      // Revert on failure
      setProfile(profile);
      throw error;
    }
  }, [profile, setProfile, userId]);

  return { profile, update };
}

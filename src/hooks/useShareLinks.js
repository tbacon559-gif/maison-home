// ─── useShareLinks ─────────────────────────────────────────────────
// Owner-side hook for the share_links table. Reads/writes go through
// the standard Supabase client + RLS (owner_id = auth.uid()).
//
// The sitter never touches this hook — they hit /api/share/sitter/[token].

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { generateShareToken } from '../lib/shareToken.js';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function useShareLinks() {
  const { userId } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('share_links')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at');
      if (active && data) setLinks(data);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const create = useCallback(async (tonightPlan) => {
    const now = new Date();
    const row = {
      token: generateShareToken(),
      owner_id: userId,
      kind: 'sitter',
      tonight_plan: tonightPlan || '',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + TWELVE_HOURS_MS).toISOString(),
      revoked_at: null,
    };
    const { data, error } = await supabase
      .from('share_links')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    setLinks((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const updatePlan = useCallback(async (token, tonightPlan) => {
    const { error } = await supabase
      .from('share_links')
      .update({ tonight_plan: tonightPlan })
      .eq('owner_id', userId)
      .eq('token', token);
    if (error) throw error;
    setLinks((prev) => prev.map((l) =>
      l.token === token ? { ...l, tonight_plan: tonightPlan } : l));
  }, [userId]);

  const revoke = useCallback(async (token) => {
    const revokedAt = new Date().toISOString();
    const { error } = await supabase
      .from('share_links')
      .update({ revoked_at: revokedAt })
      .eq('owner_id', userId)
      .eq('token', token);
    if (error) throw error;
    setLinks((prev) => prev.map((l) =>
      l.token === token ? { ...l, revoked_at: revokedAt } : l));
  }, [userId]);

  const active = useMemo(() => {
    const now = Date.now();
    return links.filter((l) =>
      !l.revoked_at && new Date(l.expires_at).getTime() > now
    );
  }, [links]);

  return { links, active, loading, create, updatePlan, revoke };
}

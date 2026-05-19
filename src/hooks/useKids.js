// ─── useKids — list, add, edit, remove kids ───────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useKids() {
  const { userId } = useAuth();
  const [kids, setKids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('kids', userId);
      if (cached && active) { setKids(cached); setLoading(false); }
      const { data } = await supabase
        .from('kids').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setKids(data);
        await cache.write('kids', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const add = useCallback(async (fields = {}) => {
    const position = kids.length;
    const { data, error } = await supabase
      .from('kids')
      .insert({ user_id: userId, position, ...fields })
      .select().single();
    if (error) throw error;
    setKids((prev) => [...prev, data]);
    await cache.write('kids', userId, [...kids, data]);
  }, [kids, userId]);

  const edit = useCallback(async (id, fields) => {
    await withOptimistic(
      setKids,
      (prev) => prev.map((k) => (k.id === id ? { ...k, ...fields } : k)),
      async () => {
        const { error } = await supabase.from('kids').update(fields).eq('id', id);
        if (error) throw error;
        await cache.write('kids', userId, kids.map((k) => (k.id === id ? { ...k, ...fields } : k)));
      }
    );
  }, [kids, userId]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setKids,
      (prev) => prev.filter((k) => k.id !== id),
      async () => {
        const { error } = await supabase.from('kids').delete().eq('id', id);
        if (error) throw error;
        await cache.write('kids', userId, kids.filter((k) => k.id !== id));
      }
    );
  }, [kids, userId]);

  return { kids, loading, add, edit, remove };
}

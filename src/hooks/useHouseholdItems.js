// ─── useHouseholdItems — the "If You Need It" key/value list ──────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useHouseholdItems() {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('household_items', userId);
      if (cached && active) { setItems(cached); setLoading(false); }
      const { data } = await supabase
        .from('household_items').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setItems(data);
        await cache.write('household_items', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const add = useCallback(async (label = '', value = '') => {
    const position = items.length;
    const { data, error } = await supabase
      .from('household_items')
      .insert({ user_id: userId, position, label, value })
      .select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
    await cache.write('household_items', userId, [...items, data]);
  }, [items, userId]);

  const edit = useCallback(async (id, fields) => {
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)),
      async () => {
        const { error } = await supabase.from('household_items').update(fields).eq('id', id);
        if (error) throw error;
        await cache.write('household_items', userId, items.map((i) => (i.id === id ? { ...i, ...fields } : i)));
      }
    );
  }, [items, userId]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setItems,
      (prev) => prev.filter((i) => i.id !== id),
      async () => {
        const { error } = await supabase.from('household_items').delete().eq('id', id);
        if (error) throw error;
        await cache.write('household_items', userId, items.filter((i) => i.id !== id));
      }
    );
  }, [items, userId]);

  return { items, loading, add, edit, remove };
}

// ─── useListItems — grocery OR tobuy, distinguished by 'list' arg ──

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useListItems(list) {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cacheKey = `list_items:${list}`;
      const cached = await cache.read(cacheKey, userId);
      if (cached && active) { setItems(cached); setLoading(false); }
      const { data } = await supabase
        .from('list_items').select('*')
        .eq('user_id', userId).eq('list', list).order('position');
      if (data && active) {
        setItems(data);
        await cache.write(cacheKey, userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, list]);

  const toggle = useCallback(async (id) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, got: !i.got } : i)),
      async () => {
        const { error } = await supabase.from('list_items')
          .update({ got: !current.got }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [items]);

  const add = useCallback(async (item = '') => {
    const position = items.length;
    const { data, error } = await supabase
      .from('list_items')
      .insert({ user_id: userId, list, position, item, got: false })
      .select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
  }, [items, list, userId]);

  const edit = useCallback(async (id, item) => {
    await withOptimistic(
      setItems,
      (prev) => prev.map((i) => (i.id === id ? { ...i, item } : i)),
      async () => {
        const { error } = await supabase.from('list_items').update({ item }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setItems,
      (prev) => prev.filter((i) => i.id !== id),
      async () => {
        const { error } = await supabase.from('list_items').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  return { items, loading, toggle, add, edit, remove };
}

// ─── useThoughtItems ───────────────────────────────────────────────
// Per-list item hook for thought_items. Instantiated once per list
// card in ThoughtsTab. Local state is the items for THIS list only.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useThoughtItems(listId) {
  const { userId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !listId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('thought_items')
        .select('*')
        .eq('user_id', userId)
        .eq('list_id', listId)
        .order('position');
      if (alive && data) setItems(data);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, listId]);

  const add = useCallback(async (text) => {
    const position = items.length;
    const row = {
      list_id: listId,
      user_id: userId,
      text: text || '',
      done: false,
      position,
    };
    const { data, error } = await supabase
      .from('thought_items').insert(row).select().single();
    if (error) throw error;
    setItems((prev) => [...prev, data]);
    return data;
  }, [items.length, listId, userId]);

  const toggle = useCallback(async (id) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const next = !current.done;
    const { error } = await supabase
      .from('thought_items')
      .update({ done: next })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: next } : i)));
  }, [items, userId]);

  const edit = useCallback(async (id, text) => {
    const { error } = await supabase
      .from('thought_items')
      .update({ text })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }, [userId]);

  const remove = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_items')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [userId]);

  return { items, loading, add, toggle, edit, remove };
}

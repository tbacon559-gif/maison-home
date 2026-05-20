// ─── useThoughtLists ───────────────────────────────────────────────
// Owner-side hook for the thought_lists table. Active vs archived
// rows are surfaced as two arrays; the component never has to filter.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export function useThoughtLists() {
  const { userId } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('thought_lists')
        .select('*')
        .eq('user_id', userId)
        .order('position');
      if (alive && data) setLists(data);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const create = useCallback(async (title) => {
    const activeCount = lists.filter((l) => !l.archived).length;
    const row = {
      user_id: userId,
      title: title || '',
      archived: false,
      archived_at: null,
      position: activeCount,
    };
    const { data, error } = await supabase
      .from('thought_lists').insert(row).select().single();
    if (error) throw error;
    setLists((prev) => [...prev, data]);
    return data;
  }, [lists, userId]);

  const rename = useCallback(async (id, title) => {
    const { error } = await supabase
      .from('thought_lists')
      .update({ title })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title } : l)));
  }, [userId]);

  const archive = useCallback(async (id) => {
    const archived_at = new Date().toISOString();
    const { error } = await supabase
      .from('thought_lists')
      .update({ archived: true, archived_at })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) =>
      l.id === id ? { ...l, archived: true, archived_at } : l));
  }, [userId]);

  const restore = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_lists')
      .update({ archived: false, archived_at: null })
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.map((l) =>
      l.id === id ? { ...l, archived: false, archived_at: null } : l));
  }, [userId]);

  const removeList = useCallback(async (id) => {
    const { error } = await supabase
      .from('thought_lists')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, [userId]);

  const active = useMemo(
    () => lists.filter((l) => !l.archived)
      .slice()
      .sort((a, b) => a.position - b.position),
    [lists]
  );

  const archived = useMemo(
    () => lists.filter((l) => l.archived)
      .slice()
      .sort((a, b) => {
        const ax = a.archived_at ?? '';
        const bx = b.archived_at ?? '';
        return ax > bx ? -1 : ax < bx ? 1 : 0;
      }),
    [lists]
  );

  return { active, archived, loading, create, rename, archive, restore, removeList };
}

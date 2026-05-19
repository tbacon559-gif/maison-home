// ─── useWeeklyTasks — the weekly "bigger stuff" list ──────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

export function useWeeklyTasks() {
  const { userId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('weekly_tasks', userId);
      if (cached && active) { setTasks(cached); setLoading(false); }
      const { data } = await supabase
        .from('weekly_tasks').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        setTasks(data);
        await cache.write('weekly_tasks', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const toggle = useCallback(async (id) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    await withOptimistic(
      setTasks,
      (prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      async () => {
        const { error } = await supabase.from('weekly_tasks')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [tasks]);

  const add = useCallback(async (label = '') => {
    const position = tasks.length;
    const { data, error } = await supabase
      .from('weekly_tasks')
      .insert({ user_id: userId, position, label, done: false })
      .select().single();
    if (error) throw error;
    setTasks((prev) => [...prev, data]);
  }, [tasks, userId]);

  const edit = useCallback(async (id, label) => {
    await withOptimistic(
      setTasks,
      (prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)),
      async () => {
        const { error } = await supabase.from('weekly_tasks').update({ label }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setTasks,
      (prev) => prev.filter((t) => t.id !== id),
      async () => {
        const { error } = await supabase.from('weekly_tasks').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  // Bulk-reset all done flags to false. Used by App.jsx on weekly rollover.
  const resetAll = useCallback(async () => {
    if (!userId) return;
    setTasks((prev) => prev.map((t) => ({ ...t, done: false })));
    const { error } = await supabase.from('weekly_tasks')
      .update({ done: false }).eq('user_id', userId);
    if (error) throw error;
  }, [userId]);

  return { tasks, loading, toggle, add, edit, remove, resetAll };
}

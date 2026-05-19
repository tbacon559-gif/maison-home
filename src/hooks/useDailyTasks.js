// ─── useDailyTasks — day/night slot tasks ─────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

function groupBySlot(rows) {
  return {
    day: rows.filter((r) => r.slot === 'day'),
    night: rows.filter((r) => r.slot === 'night'),
  };
}

export function useDailyTasks() {
  const { userId } = useAuth();
  const [state, setState] = useState({ day: [], night: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('daily_tasks', userId);
      if (cached && active) { setState(groupBySlot(cached)); setLoading(false); }
      const { data } = await supabase
        .from('daily_tasks').select('*').eq('user_id', userId)
        .order('slot').order('position');
      if (data && active) {
        setState(groupBySlot(data));
        await cache.write('daily_tasks', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const toggle = useCallback(async (slot, id) => {
    const current = state[slot].find((t) => t.id === id);
    if (!current) return;
    await withOptimistic(
      setState,
      (prev) => ({ ...prev, [slot]: prev[slot].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
      async () => {
        const { error } = await supabase.from('daily_tasks')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [state]);

  const add = useCallback(async (slot, label = '') => {
    const position = state[slot].length;
    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({ user_id: userId, slot, position, label, done: false })
      .select().single();
    if (error) throw error;
    setState((prev) => ({ ...prev, [slot]: [...prev[slot], data] }));
  }, [state, userId]);

  const edit = useCallback(async (id, label) => {
    await withOptimistic(
      setState,
      (prev) => ({
        day: prev.day.map((t) => (t.id === id ? { ...t, label } : t)),
        night: prev.night.map((t) => (t.id === id ? { ...t, label } : t)),
      }),
      async () => {
        const { error } = await supabase.from('daily_tasks').update({ label }).eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setState,
      (prev) => ({
        day: prev.day.filter((t) => t.id !== id),
        night: prev.night.filter((t) => t.id !== id),
      }),
      async () => {
        const { error } = await supabase.from('daily_tasks').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  // Bulk-reset all done flags to false. Used by App.jsx on day rollover.
  const resetAll = useCallback(async () => {
    if (!userId) return;
    setState((prev) => ({
      day: prev.day.map((t) => ({ ...t, done: false })),
      night: prev.night.map((t) => ({ ...t, done: false })),
    }));
    const { error } = await supabase.from('daily_tasks')
      .update({ done: false }).eq('user_id', userId);
    if (error) throw error;
  }, [userId]);

  return { day: state.day, night: state.night, loading, toggle, add, edit, remove, resetAll };
}

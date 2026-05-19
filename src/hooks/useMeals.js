// ─── useMeals — week × {Lunch, Dinner} grid ───────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { withOptimistic } from '../lib/optimistic.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function rowsToMap(rows) {
  const out = {};
  for (const d of DAYS) out[d] = { L: '', D: '' };
  for (const r of rows) {
    out[r.day][r.slot] = r.text;
  }
  return out;
}

export function useMeals() {
  const { userId } = useAuth();
  const [meals, setMeals] = useState(rowsToMap([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await cache.read('meals', userId);
      if (cached && active) { setMeals(rowsToMap(cached)); setLoading(false); }
      const { data } = await supabase
        .from('meals').select('*').eq('user_id', userId);
      if (data && active) {
        setMeals(rowsToMap(data));
        await cache.write('meals', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const setMeal = useCallback(async (day, slot, text) => {
    await withOptimistic(
      setMeals,
      (prev) => ({ ...prev, [day]: { ...prev[day], [slot]: text } }),
      async () => {
        const { error } = await supabase.from('meals').upsert(
          { user_id: userId, day, slot, text },
          { onConflict: 'user_id,day,slot' }
        );
        if (error) throw error;
      }
    );
  }, [userId]);

  return { meals, loading, setMeal };
}

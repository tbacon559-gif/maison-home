// ─── useNotes — Quick Notes with E2E encrypted text ───────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { encryptText, decryptText } from '../lib/crypto.js';
import { withOptimistic } from '../lib/optimistic.js';

async function decryptRows(rows, key) {
  if (!key) return rows.map((r) => ({ ...r, text: '' }));
  const out = [];
  for (const r of rows) {
    try {
      const text = r.text_encrypted ? await decryptText(key, r.text_encrypted) : '';
      out.push({ ...r, text });
    } catch {
      out.push({ ...r, text: '[decrypt error]' });
    }
  }
  return out;
}

export function useNotes() {
  const { userId, encryptionKey } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !encryptionKey) return;
    let active = true;
    (async () => {
      // Cache stores already-decrypted notes (with .text field) — but only for THIS session.
      // To stay simple, cache stores the encrypted rows; we decrypt on every load.
      const cached = await cache.read('notes', userId);
      if (cached && active) {
        const decrypted = await decryptRows(cached, encryptionKey);
        setNotes(decrypted);
        setLoading(false);
      }
      const { data } = await supabase
        .from('notes').select('*').eq('user_id', userId).order('position');
      if (data && active) {
        const decrypted = await decryptRows(data, encryptionKey);
        setNotes(decrypted);
        await cache.write('notes', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, encryptionKey]);

  const add = useCallback(async (text) => {
    if (!encryptionKey) throw new Error('no key');
    const trimmed = text.trim();
    if (!trimmed) return;
    const cipher = await encryptText(encryptionKey, trimmed);
    const position = notes.length;
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, position, text_encrypted: cipher, done: false })
      .select().single();
    if (error) throw error;
    setNotes((prev) => [...prev, { ...data, text: trimmed }]);
  }, [notes, userId, encryptionKey]);

  const toggle = useCallback(async (id) => {
    const current = notes.find((n) => n.id === id);
    if (!current) return;
    await withOptimistic(
      setNotes,
      (prev) => prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n)),
      async () => {
        const { error } = await supabase.from('notes')
          .update({ done: !current.done }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [notes]);

  const edit = useCallback(async (id, text) => {
    if (!encryptionKey) throw new Error('no key');
    const cipher = await encryptText(encryptionKey, text);
    await withOptimistic(
      setNotes,
      (prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)),
      async () => {
        const { error } = await supabase.from('notes')
          .update({ text_encrypted: cipher }).eq('id', id);
        if (error) throw error;
      }
    );
  }, [encryptionKey]);

  const remove = useCallback(async (id) => {
    await withOptimistic(
      setNotes,
      (prev) => prev.filter((n) => n.id !== id),
      async () => {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) throw error;
      }
    );
  }, []);

  return { notes, loading, add, toggle, edit, remove };
}

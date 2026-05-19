// ─── useNotes — Quick Notes ───────────────────────────────────────
// When encryptionKey is present (email+password users), text is E2E
// encrypted on write and decrypted on read. When encryptionKey is null
// (anonymous users from the V1 pivot), text is stored plaintext in the
// text_encrypted column — RLS still guarantees the row is only readable
// by its owner. The column name stays as-is to keep the schema stable
// for when a user upgrades from anonymous to email.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { encryptText, decryptText } from '../lib/crypto.js';
import { withOptimistic } from '../lib/optimistic.js';

async function decryptRows(rows, key) {
  if (!key) {
    // No key — text_encrypted column holds plaintext for anonymous users.
    return rows.map((r) => ({ ...r, text: r.text_encrypted || '' }));
  }
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

async function maybeEncrypt(key, plaintext) {
  if (!key) return plaintext;
  return encryptText(key, plaintext);
}

export function useNotes() {
  const { userId, encryptionKey } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
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
    const trimmed = text.trim();
    if (!trimmed) return;
    const stored = await maybeEncrypt(encryptionKey, trimmed);
    const position = notes.length;
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, position, text_encrypted: stored, done: false })
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
    const stored = await maybeEncrypt(encryptionKey, text);
    await withOptimistic(
      setNotes,
      (prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)),
      async () => {
        const { error } = await supabase.from('notes')
          .update({ text_encrypted: stored }).eq('id', id);
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

// ─── useMoments — photo journal with E2E encryption ───────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { cache } from '../lib/cache.js';
import { photoCache } from '../lib/photoCache.js';
import { encryptText, decryptText, encryptBlob, decryptBlob } from '../lib/crypto.js';

async function decryptCaptions(rows, key) {
  if (!key) return rows.map((r) => ({ ...r, text: '' }));
  const out = [];
  for (const r of rows) {
    try {
      const text = r.caption_encrypted ? await decryptText(key, r.caption_encrypted) : '';
      out.push({ ...r, text });
    } catch {
      out.push({ ...r, text: '[decrypt error]' });
    }
  }
  return out;
}

export function useMoments() {
  const { userId, encryptionKey } = useAuth();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !encryptionKey) return;
    let active = true;
    (async () => {
      const cached = await cache.read('moments', userId);
      if (cached && active) {
        const decrypted = await decryptCaptions(cached, encryptionKey);
        setMoments(decrypted);
        setLoading(false);
      }
      const { data } = await supabase
        .from('moments').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data && active) {
        const decrypted = await decryptCaptions(data, encryptionKey);
        setMoments(decrypted);
        await cache.write('moments', userId, data);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, encryptionKey]);

  const add = useCallback(async ({ dateLabel, caption, photoArrayBuffer }) => {
    if (!encryptionKey) throw new Error('no key');
    const captionCipher = await encryptText(encryptionKey, caption || '');

    // Generate the moment id client-side so we can use it in the Storage path.
    const id = crypto.randomUUID();
    let photoPath = null;

    if (photoArrayBuffer) {
      const encrypted = await encryptBlob(encryptionKey, photoArrayBuffer);
      photoPath = `${userId}/${id}.bin`;
      const { error: upErr } = await supabase.storage
        .from('moments').upload(photoPath, new Blob([encrypted]));
      if (upErr) throw upErr;
      // Cache the decrypted bytes so the just-uploaded photo renders without a refetch.
      await photoCache.put(userId, id, photoArrayBuffer);
    }

    const { data, error } = await supabase
      .from('moments').insert({
        id,
        user_id: userId,
        date_label: dateLabel || '',
        caption_encrypted: captionCipher,
        photo_storage_path: photoPath,
      }).select().single();
    if (error) throw error;

    setMoments((prev) => [{ ...data, text: caption || '' }, ...prev]);
  }, [userId, encryptionKey]);

  const remove = useCallback(async (id) => {
    const current = moments.find((m) => m.id === id);
    setMoments((prev) => prev.filter((m) => m.id !== id));
    if (current?.photo_storage_path) {
      await supabase.storage.from('moments').remove([current.photo_storage_path]);
    }
    const { error } = await supabase.from('moments').delete().eq('id', id);
    if (error) throw error;
  }, [moments]);

  const getPhoto = useCallback(async (momentId) => {
    if (!encryptionKey) return null;
    const cached = await photoCache.getPhoto(userId, momentId);
    if (cached) return cached;
    const moment = moments.find((m) => m.id === momentId);
    if (!moment?.photo_storage_path) return null;
    const { data, error } = await supabase.storage
      .from('moments').download(moment.photo_storage_path);
    if (error || !data) return null;
    const encrypted = await data.arrayBuffer();
    const decrypted = await decryptBlob(encryptionKey, encrypted);
    await photoCache.put(userId, momentId, decrypted);
    return decrypted;
  }, [moments, userId, encryptionKey]);

  return { moments, loading, add, remove, getPhoto };
}

// ─── Auth provider — session + status routing ─────────────────────
// V1 pivot (2026-05-19): app auto-signs-in anonymous users. No signup
// screen. Encryption is no-op for anonymous users (notes/captions/
// photos stored plaintext under RLS). E2E re-enables later when an
// anonymous user upgrades to an email+password account.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase.js';
import { generateSalt } from './crypto.js';
import { cache } from './cache.js';
import { photoCache } from './photoCache.js';

const AuthContext = createContext(null);

function computeEffectiveStatus(profile) {
  if (!profile) return null;
  const now = new Date();
  if (profile.subscription_status === 'trialing'
      && profile.trial_ends_at
      && new Date(profile.trial_ends_at) < now) return 'trial_expired';
  if (profile.subscription_status === 'hardship_granted'
      && profile.hardship_granted_until
      && new Date(profile.hardship_granted_until) < now) return 'trial_expired';
  return profile.subscription_status;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [status, setStatus] = useState('loading');

  // Bootstrap: re-use existing session or auto-anonymous-signin.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (!active) return;
      if (existing) {
        setSession(existing);
        await loadOrInitProfile(existing.user.id);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!active) return;
      if (error || !data?.session) {
        console.error('Anonymous signin failed', error);
        setStatus('signed_out');
        return;
      }
      setSession(data.session);
      await loadOrInitProfile(data.session.user.id);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile if it exists, otherwise create one and seed defaults.
  // Anonymous users: no trial_ends_at (so the trial-ended banner never fires).
  const loadOrInitProfile = useCallback(async (userId) => {
    const { data: existing, error: getErr } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!getErr && existing) {
      setProfile(existing);
      setStatus(existing.greeting_name ? 'authenticated' : 'onboarding');
      return;
    }
    const salt = generateSalt();
    const { data: newProf, error: insErr } = await supabase.from('profiles').insert({
      id: userId,
      subscription_status: 'trialing',
      trial_ends_at: null, // anonymous users: trial never expires by date
      encryption_salt: salt,
      is_founding_member: false,
    }).select().single();
    if (insErr) {
      console.error('Profile create failed', insErr);
      setStatus('signed_out');
      return;
    }
    const { error: seedErr } = await supabase.rpc('seed_new_user', { target_user: userId });
    if (seedErr) {
      console.error('Seed function failed', seedErr);
      // Profile exists; seed failed. Don't block — they can still proceed but with empty lists.
    }
    setProfile(newProf);
    setStatus('onboarding');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await cache.clear();
    await photoCache.clear();
    setProfile(null);
    setEncryptionKey(null);
    setSession(null);
    setStatus('signed_out');
  }, []);

  const deleteAccount = useCallback(async () => {
    if (session?.user?.id) {
      const { data: files } = await supabase.storage
        .from('moments').list(session.user.id);
      if (files && files.length) {
        await supabase.storage.from('moments').remove(
          files.map((f) => `${session.user.id}/${f.name}`)
        );
      }
    }
    await supabase.rpc('delete_user_account');
    await cache.clear();
    await photoCache.clear();
    setProfile(null);
    setEncryptionKey(null);
    setSession(null);
    setStatus('signed_out');
  }, [session]);

  const finishOnboarding = useCallback(() => setStatus('authenticated'), []);

  const value = {
    session,
    userId: session?.user?.id ?? null,
    profile,
    effectiveStatus: computeEffectiveStatus(profile),
    encryptionKey, // always null for anonymous users — useNotes/useMoments handle this
    status,
    signOut,
    deleteAccount,
    finishOnboarding,
    setProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}

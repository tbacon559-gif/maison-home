// ─── Auth provider — session + encryption key + status routing ────
// Wraps the entire app. Components access via useAuth(). The status
// string drives top-level routing in App.jsx.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase.js';
import { deriveKey, generateSalt } from './crypto.js';
import { cache } from './cache.js';
import { photoCache } from './photoCache.js';

const AuthContext = createContext(null);

const TRIAL_DAYS = 14;

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
  const [pendingPassword, setPendingPassword] = useState(null); // held across signup-then-sign-in

  // Bootstrap on mount: check for existing session
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (!active) return;
      setSession(existing);
      if (!existing) {
        setStatus('signed_out');
      } else {
        // Existing session — but we don't have the password, so we can't
        // re-derive the encryption key. User must sign in again to read
        // E2E content. Treat as signed_out for app-level gating, but keep
        // the session alive so the next signin is one tap.
        // (Future enhancement: prompt for password to "unlock" content.)
        setStatus('signed_out');
      }
    })();
    return () => { active = false; };
  }, []);

  // Watch for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Helper: fetch profile, derive key, route
  const completeSignin = useCallback(async (password) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('signed_out');
      return;
    }
    const { data: prof, error } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    if (error || !prof) {
      setStatus('signed_out');
      return;
    }
    setProfile(prof);
    const key = await deriveKey(password, prof.encryption_salt);
    setEncryptionKey(key);
    setStatus('authenticated');
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
    await completeSignin(password);
  }, [completeSignin]);

  const signUp = useCallback(async (email, password) => {
    // Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Signup did not return a user');

    // Create profile row with salt + trial window
    const salt = generateSalt();
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      subscription_status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
      encryption_salt: salt,
      is_founding_member: false,
    });
    if (profileErr) throw profileErr;

    // Run seed function
    await supabase.rpc('seed_new_user', { target_user: data.user.id });

    // Derive key and route to onboarding (consumer decides between onboarding vs. import)
    const key = await deriveKey(password, salt);
    setEncryptionKey(key);
    setSession(data.session);
    // Fetch the profile we just inserted
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single();
    setProfile(prof);
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

  const requestHardship = useCallback(async (email, reason) => {
    // Create auth user with random placeholder password (the user resets later via email link).
    const placeholderPw = crypto.randomUUID() + crypto.randomUUID();
    const { data, error } = await supabase.auth.signUp({ email, password: placeholderPw });
    if (error) throw error;
    if (!data.user) throw new Error('Signup did not return a user');

    const salt = generateSalt();
    await supabase.from('profiles').insert({
      id: data.user.id,
      subscription_status: 'hardship_pending',
      encryption_salt: salt,
      is_founding_member: false,
    });
    await supabase.from('hardship_requests').insert({
      user_id: data.user.id,
      email,
      reason: reason || null,
    });
    await supabase.auth.signOut(); // don't auto-sign-in pending users
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    // Clear Storage first (server function doesn't reach Storage).
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

  // Allow onboarding to advance status
  const finishOnboarding = useCallback(() => setStatus('authenticated'), []);

  const value = {
    session,
    userId: session?.user?.id ?? null,
    profile,
    effectiveStatus: computeEffectiveStatus(profile),
    encryptionKey,
    status,
    signIn,
    signUp,
    signOut,
    requestHardship,
    resetPassword,
    deleteAccount,
    finishOnboarding,
    setProfile, // exposed so useProfile can update parent state after a profile mutation
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}

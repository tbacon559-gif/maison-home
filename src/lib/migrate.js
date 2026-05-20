// ─── Migration — local PWA data → cloud account ──────────────────
// One-time, opt-in (with sensible default). Runs after a fresh signup
// when localStorage has any tracked content.

import { supabase } from './supabase.js';
import { encryptText } from './crypto.js';

const LS_PREFIX = 'maison.';
const IMPORTED_FLAG = 'maison.imported_to_cloud';

const TRACKED_KEYS = [
  'daily', 'weekly', 'meals', 'groceries', 'toBuy',
  'notes', 'girls', 'household', 'sitterNotes',
  'settings', 'lastDailyResetDate', 'lastWeeklyResetDate',
];

function isNonTrivial(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function lsGetRaw(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

export function hasLocalData() {
  if (localStorage.getItem(IMPORTED_FLAG)) return false;
  for (const key of TRACKED_KEYS) {
    const v = lsGetRaw(key);
    if (isNonTrivial(v)) return true;
  }
  return false;
}


// Main importer. Throws on first table that fails so caller can surface and offer retry.
export async function importLocalData(userId, encryptionKey) {
  // ─ profile fields (sitter_notes, calendar_url, last reset dates, greeting_name) ─
  const settings = lsGetRaw('settings') || {};
  const sitterNotes = lsGetRaw('sitterNotes');
  const lastDaily = lsGetRaw('lastDailyResetDate');
  const lastWeekly = lsGetRaw('lastWeeklyResetDate');
  const profilePatch = {};
  if (settings.calendarUrl) profilePatch.calendar_url = settings.calendarUrl;
  if (typeof sitterNotes === 'string' && sitterNotes.trim()) profilePatch.sitter_notes = sitterNotes;
  if (typeof lastDaily === 'string') profilePatch.last_daily_reset_date = lastDaily;
  if (typeof lastWeekly === 'string') profilePatch.last_weekly_reset_date = lastWeekly;
  if (Object.keys(profilePatch).length) {
    const { error } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
    if (error) throw new Error(`profile: ${error.message}`);
  }

  // ─ kids ─
  const girls = lsGetRaw('girls') || [];
  if (girls.length) {
    const rows = girls.map((g, i) => ({
      user_id: userId, position: i,
      name: g.name || '',
      birthday: g.birthday || null,
      clothes_size: g.clothes || null,
      shoe_size: g.shoe || null,
      diaper_size: g.diaper || null,
      allergies: g.allergies || null,
    }));
    const { error } = await supabase.from('kids').insert(rows);
    if (error) throw new Error(`kids: ${error.message}`);
  }

  // ─ household_items (replace seeded defaults) ─
  const household = lsGetRaw('household') || [];
  if (household.length) {
    await supabase.from('household_items').delete().eq('user_id', userId);
    const rows = household.map((h, i) => ({
      user_id: userId, position: i, label: h.key || '', value: h.value || '',
    }));
    const { error } = await supabase.from('household_items').insert(rows);
    if (error) throw new Error(`household_items: ${error.message}`);
  }

  // ─ daily_tasks (replace seeded defaults) ─
  const daily = lsGetRaw('daily');
  if (daily && (daily.day?.length || daily.night?.length)) {
    await supabase.from('daily_tasks').delete().eq('user_id', userId);
    const rows = [];
    (daily.day || []).forEach((t, i) => rows.push({
      user_id: userId, slot: 'day', position: i, label: t.label || '', done: !!t.done,
    }));
    (daily.night || []).forEach((t, i) => rows.push({
      user_id: userId, slot: 'night', position: i, label: t.label || '', done: !!t.done,
    }));
    if (rows.length) {
      const { error } = await supabase.from('daily_tasks').insert(rows);
      if (error) throw new Error(`daily_tasks: ${error.message}`);
    }
  }

  // ─ weekly_tasks (replace seeded defaults) ─
  const weekly = lsGetRaw('weekly');
  if (Array.isArray(weekly) && weekly.length) {
    await supabase.from('weekly_tasks').delete().eq('user_id', userId);
    const rows = weekly.map((t, i) => ({
      user_id: userId, position: i, label: t.label || '', done: !!t.done,
    }));
    const { error } = await supabase.from('weekly_tasks').insert(rows);
    if (error) throw new Error(`weekly_tasks: ${error.message}`);
  }

  // ─ meals (UPSERT each cell) ─
  const meals = lsGetRaw('meals');
  if (meals && typeof meals === 'object') {
    const rows = [];
    for (const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) {
      const m = meals[day] || {};
      for (const slot of ['L', 'D']) {
        if (m[slot] !== undefined) {
          rows.push({ user_id: userId, day, slot, text: m[slot] || '' });
        }
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('meals').upsert(rows, { onConflict: 'user_id,day,slot' });
      if (error) throw new Error(`meals: ${error.message}`);
    }
  }

  // ─ list_items (groceries + toBuy) ─
  const groceries = lsGetRaw('groceries') || [];
  const toBuy = lsGetRaw('toBuy') || [];
  const listRows = [];
  groceries.forEach((g, i) => listRows.push({
    user_id: userId, list: 'grocery', position: i, item: g.item || '', got: !!g.got,
  }));
  toBuy.forEach((t, i) => listRows.push({
    user_id: userId, list: 'tobuy', position: i, item: t.item || '', got: !!t.got,
  }));
  if (listRows.length) {
    const { error } = await supabase.from('list_items').insert(listRows);
    if (error) throw new Error(`list_items: ${error.message}`);
  }

  // ─ notes (encrypt) ─
  const notes = lsGetRaw('notes') || [];
  if (notes.length) {
    const rows = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const cipher = encryptionKey
        ? await encryptText(encryptionKey, n.text || '')
        : (n.text || '');
      rows.push({
        user_id: userId, position: i, text_encrypted: cipher, done: !!n.done,
      });
    }
    const { error } = await supabase.from('notes').insert(rows);
    if (error) throw new Error(`notes: ${error.message}`);
  }

  // ─ Mark complete ─
  localStorage.setItem(IMPORTED_FLAG, '1');
}

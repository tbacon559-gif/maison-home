// ─── Web Crypto helpers for E2E content ──────────────────────────
// Used by useNotes and useMoments to encrypt/decrypt journal-like content
// before it leaves the device. Spec: see Section 4 of the Productize design.

const PBKDF2_ITERATIONS = 100_000;
const KEY_BITS = 256;
const IV_BYTES = 12; // AES-GCM standard

const enc = new TextEncoder();
const dec = new TextDecoder();

// Fail loud if Web Crypto is unavailable. Per spec Section 4, the failure
// mode is "refuse to save", not "silently fall back to plaintext."
if (typeof crypto === 'undefined' || !crypto.subtle) {
  throw new Error('Web Crypto API unavailable — this browser is unsupported.');
}

// ─── Base64 helpers (browser-safe) ────────────────────────────────
function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─── Salt generation ───────────────────────────────────────────────
export function generateSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToB64(salt);
}

// ─── Key derivation (PBKDF2 → AES-256-GCM key) ────────────────────
export async function deriveKey(password, saltB64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

// ─── Text encrypt/decrypt ─────────────────────────────────────────
export async function encryptText(key, plaintext) {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  // Concat iv ‖ ciphertext, then base64.
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return bytesToB64(out);
}

export async function decryptText(key, b64) {
  const bytes = b64ToBytes(b64);
  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ct
  );
  return dec.decode(ptBuf);
}

// ─── Blob encrypt/decrypt (for photos) ────────────────────────────
export async function encryptBlob(key, arrayBuffer) {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, arrayBuffer
  );
  // Return iv ‖ ciphertext as ArrayBuffer.
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out.buffer;
}

export async function decryptBlob(key, arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ct
  );
  return ptBuf;
}

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateSalt,
  deriveKey,
  encryptText,
  decryptText,
  encryptBlob,
  decryptBlob,
} from './crypto.js';

// jsdom does not include crypto.subtle by default; vitest's environment must include it.
// Node 20+ provides globalThis.crypto.subtle natively, which jsdom inherits.

beforeAll(() => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Test env missing crypto.subtle — requires Node 20+');
  }
});

describe('generateSalt', () => {
  it('returns a base64 string with 16 bytes of entropy', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    const decoded = atob(salt);
    expect(decoded.length).toBe(16);
  });

  it('produces a different salt on each call', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});

describe('deriveKey', () => {
  it('produces a CryptoKey usable by AES-GCM', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.algorithm.length).toBe(256);
  });

  it('is deterministic — same password + salt → same key bits', async () => {
    const salt = generateSalt();
    const a = await deriveKey('password', salt);
    const b = await deriveKey('password', salt);
    // Both encrypt the same plaintext + same IV to the same ciphertext.
    const plain = 'hello';
    const ivA = new Uint8Array(12);
    const ivB = new Uint8Array(12);
    const ctA = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivA }, a, new TextEncoder().encode(plain)));
    const ctB = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivB }, b, new TextEncoder().encode(plain)));
    expect(Array.from(ctA)).toEqual(Array.from(ctB));
  });

  it('differs when password differs', async () => {
    const salt = generateSalt();
    const a = await deriveKey('passwordA', salt);
    const b = await deriveKey('passwordB', salt);
    const iv = new Uint8Array(12);
    const plain = 'hello';
    const ctA = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, a, new TextEncoder().encode(plain)));
    const ctB = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, b, new TextEncoder().encode(plain)));
    expect(Array.from(ctA)).not.toEqual(Array.from(ctB));
  });
});

describe('encryptText / decryptText', () => {
  it('round-trips plaintext through ciphertext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    const ct = await encryptText(key, 'a quiet note');
    expect(typeof ct).toBe('string');
    expect(ct).not.toContain('a quiet note');
    const pt = await decryptText(key, ct);
    expect(pt).toBe('a quiet note');
  });

  it('produces a different ciphertext each call (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password', salt);
    const a = await encryptText(key, 'same text');
    const b = await encryptText(key, 'same text');
    expect(a).not.toBe(b);
  });

  it('throws on decrypt with wrong key', async () => {
    const salt = generateSalt();
    const keyA = await deriveKey('pwA', salt);
    const keyB = await deriveKey('pwB', salt);
    const ct = await encryptText(keyA, 'secret');
    await expect(decryptText(keyB, ct)).rejects.toThrow();
  });

  it('handles unicode text', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const text = 'Café — 日本語 — 🌿';
    const ct = await encryptText(key, text);
    expect(await decryptText(key, ct)).toBe(text);
  });
});

describe('encryptBlob / decryptBlob', () => {
  it('round-trips a binary buffer', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const original = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const encrypted = await encryptBlob(key, original.buffer);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(original.byteLength); // includes IV + GCM tag
    const decrypted = await decryptBlob(key, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(original);
  });

  it('produces different ciphertexts for same input (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('p', salt);
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const a = new Uint8Array(await encryptBlob(key, buf));
    const b = new Uint8Array(await encryptBlob(key, buf));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('decrypt fails with wrong key', async () => {
    const salt = generateSalt();
    const keyA = await deriveKey('a', salt);
    const keyB = await deriveKey('b', salt);
    const buf = new Uint8Array([9, 9, 9]).buffer;
    const encrypted = await encryptBlob(keyA, buf);
    await expect(decryptBlob(keyB, encrypted)).rejects.toThrow();
  });
});

// ─── Storage layer ────────────────────────────────────────────────
// localStorage for small structured data (~5MB limit, plenty for our needs)
// IndexedDB for photo blobs (which can be large)

const LS_PREFIX = 'maison.';

// ─── Local storage (small JSON blobs) ─────────────────────────────

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('lsSet failed', key, err);
  }
}

export function lsRemove(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

// ─── IndexedDB (for photos) ───────────────────────────────────────

const DB_NAME = 'maison';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function photoSave(id, dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function photoGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function photoDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function photoGetAll(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const store = tx.objectStore(PHOTO_STORE);
    const out = {};
    let pending = ids.length;
    if (pending === 0) return resolve(out);
    ids.forEach((id) => {
      const r = store.get(id);
      r.onsuccess = () => {
        if (r.result) out[id] = r.result;
        if (--pending === 0) resolve(out);
      };
      r.onerror = () => {
        if (--pending === 0) resolve(out);
      };
    });
    tx.onerror = () => reject(tx.error);
  });
}

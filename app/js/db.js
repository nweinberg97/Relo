// Thin IndexedDB wrapper. Every store is keyed by `id`.
// The app keeps the whole workspace in memory and writes changes through here.

const DB_NAME = 'relo';
const DB_VERSION = 1;
export const STORES = ['cards', 'boards', 'stages', 'placements', 'reminders', 'touchpoints', 'tags', 'relationships', 'meta'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available in this browser.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Relo is open in another tab with an older version. Close it and reload.'));
  });
  return dbPromise;
}

export async function loadAll() {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readonly');
  const out = {};
  await Promise.all(STORES.map((name) => new Promise((resolve, reject) => {
    const r = tx.objectStore(name).getAll();
    r.onsuccess = () => { out[name] = r.result; resolve(); };
    r.onerror = () => reject(r.error);
  })));
  return out;
}

// ops: [{ store, id, value }] where value === null means delete.
export async function writeOps(ops) {
  if (!ops.length) return;
  const db = await openDB();
  const names = [...new Set(ops.map((o) => o.store))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const op of ops) {
      const s = tx.objectStore(op.store);
      if (op.value === null) s.delete(op.id);
      else s.put(op.value);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Write aborted'));
  });
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    for (const name of STORES) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

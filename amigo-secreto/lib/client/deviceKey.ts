const DB_NAME = "amigo-secreto-keys";
const STORE_NAME = "keys";
const RECORD_KEY = "current";

type StoredKey = { userId: string; wrapKey: CryptoKey };

// In-memory fallback for environments without IndexedDB (e.g. restricted private browsing or tests).
let memoryKey: StoredKey | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists the user's non-extractable wrapKey on this device (IndexedDB) so they never have to
 * type their PIN again after logging in. The key cannot be exported as raw bytes and is cleared on logout.
 */
export async function saveDeviceWrapKey(userId: string, wrapKey: CryptoKey): Promise<void> {
  memoryKey = { userId, wrapKey };
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ userId, wrapKey } satisfies StoredKey, RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Loads the stored non-extractable wrapKey if it belongs to `userId`. */
export async function loadDeviceWrapKey(userId: string): Promise<CryptoKey | null> {
  if (memoryKey?.userId === userId) return memoryKey.wrapKey;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => {
        const saved = req.result as StoredKey | undefined;
        db.close();
        if (saved && saved.userId === userId && saved.wrapKey) {
          memoryKey = saved;
          resolve(saved.wrapKey);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Removes the stored device key (logout, or when a stale key no longer matches after a PIN reset). */
export async function clearDeviceWrapKey(): Promise<void> {
  memoryKey = null;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

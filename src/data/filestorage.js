/**
 * PAPER MAX - FileStorage (IndexedDB Abstraction)
 * Specifically handles binary Blobs, base PDFs, and generated artwork.
 * NEVER stores large binaries in localStorage.
 */

const DB_NAME = 'papermax_filestorage';
const DB_VERSION = 1;
const STORE_FILES = 'files';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[FileStorage] IndexedDB not available in this environment');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[FileStorage] Error opening IndexedDB:', request.error);
      resolve(null);
    };
  });

  return dbPromise;
}

export const fileStorage = {
  async saveFile(id, blob, metadata = {}) {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const record = {
          id,
          blob,
          name: metadata.name || 'arquivo.pdf',
          size: blob.size || 0,
          type: blob.type || 'application/pdf',
          updatedAt: new Date().toISOString(),
          metadata
        };
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          console.error('[FileStorage] Error saving file:', tx.error);
          resolve(false);
        };
      } catch (err) {
        console.error('[FileStorage] Save exception:', err);
        resolve(false);
      }
    });
  },

  async getFile(id) {
    const db = await openDB();
    if (!db) return null;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
          console.error('[FileStorage] Error getting file:', request.error);
          resolve(null);
        };
      } catch (err) {
        console.error('[FileStorage] Get exception:', err);
        resolve(null);
      }
    });
  },

  async deleteFile(id) {
    const db = await openDB();
    if (!db) return false;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },

  async listFiles() {
    const db = await openDB();
    if (!db) return [];

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.getAll();
        request.onsuccess = () => {
          const files = (request.result || []).map(r => ({
            id: r.id,
            name: r.name,
            size: r.size,
            type: r.type,
            updatedAt: r.updatedAt,
            metadata: r.metadata
          }));
          resolve(files);
        };
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
};

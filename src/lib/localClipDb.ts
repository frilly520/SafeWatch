export interface LocalClip {
  id: number;
  cameraName: string;
  createdAt: number;
  blob: Blob;
  type: string;
}

const DB_NAME = 'safewatch-x5-local-db';
const DB_STORE = 'clips';

function openClipDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not available in this browser.'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Could not open local clip storage.'));
  });
}

export async function readLocalClips(): Promise<LocalClip[]> {
  const db = await openClipDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(DB_STORE, 'readonly')
      .objectStore(DB_STORE)
      .getAll();
    request.onsuccess = () => {
      db.close();
      resolve(
        (request.result as LocalClip[]).sort((a, b) => b.createdAt - a.createdAt)
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error('Could not read saved clips.'));
    };
  });
}

export async function saveLocalClip(clip: LocalClip): Promise<void> {
  const db = await openClipDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(clip);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Storage is full or unavailable.'));
    };
  });
}

export async function removeLocalClip(id: number): Promise<void> {
  const db = await openClipDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Could not remove clip.'));
    };
  });
}

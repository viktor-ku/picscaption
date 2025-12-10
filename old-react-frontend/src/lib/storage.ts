// IndexedDB storage layer for auto-persisting caption sessions

const DB_NAME = "picscaption";
const DB_VERSION = 3;
const STORE_NAME = "captions";

export interface StoredCaption {
  /** Compound key: "directoryPath/fileName" */
  key: string;
  /** Full directory path (or as much as available from browser APIs) */
  directory: string;
  fileName: string;
  caption: string;
  updatedAt: string;
}

/** Create a storage key from directory and filename */
export function makeKey(directory: string, fileName: string): string {
  return `${directory}/${fileName}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Delete old store if upgrading from v1
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }

      // Create new store with compound key
      const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
      store.createIndex("directory", "directory", { unique: false });
    };
  });

  return dbPromise;
}

export async function saveCaption(data: StoredCaption): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(data);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveCaptions(data: StoredCaption[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    let completed = 0;
    let hasError = false;

    for (const item of data) {
      const request = store.put(item);
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
      request.onsuccess = () => {
        completed++;
        if (completed === data.length && !hasError) {
          resolve();
        }
      };
    }

    // Handle empty array
    if (data.length === 0) {
      resolve();
    }
  });
}

export async function getCaption(
  key: string,
): Promise<StoredCaption | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/** Get captions for a directory, returns Map keyed by fileName */
export async function getCaptionsByDirectory(
  directory: string,
): Promise<Map<string, StoredCaption>> {
  const db = await openDB();
  const results = new Map<string, StoredCaption>();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("directory");
    const request = index.getAll(directory);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      for (const item of request.result as StoredCaption[]) {
        results.set(item.fileName, item);
      }
      resolve(results);
    };
  });
}

export async function getAllCaptions(): Promise<StoredCaption[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteCaption(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteCaptions(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    let completed = 0;
    let hasError = false;

    for (const key of keys) {
      const request = store.delete(key);
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
      request.onsuccess = () => {
        completed++;
        if (completed === keys.length && !hasError) {
          resolve();
        }
      };
    }
  });
}

/** Clear all data from IndexedDB */
export async function clearAllData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Persist and restore FileSystemDirectoryHandle using IndexedDB.
 *
 * The File System Access API allows handles to be stored in IndexedDB,
 * but permission must be re-requested on page load.
 */

const DB_NAME = "picscaption-storage";
const DB_VERSION = 1;
const STORE_NAME = "directory-handles";
const HANDLE_KEY = "current-directory";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save a directory handle to IndexedDB.
 */
export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, HANDLE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Load a directory handle from IndexedDB.
 * Returns null if no handle is stored.
 */
export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);

      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Clear the stored directory handle.
 */
export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(HANDLE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();

      transaction.oncomplete = () => db.close();
    });
  } catch {
    // Ignore errors when clearing
  }
}

/**
 * Try to restore a directory handle and verify permission.
 * Returns the handle if permission is granted, null otherwise.
 */
export async function restoreDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadDirectoryHandle();
  if (!handle) return null;

  try {
    // Check if we still have permission
    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") {
      return handle;
    }

    // Try to request permission (requires user gesture, so this will likely fail on load)
    // But we keep the handle stored for when user clicks something
    return null;
  } catch {
    // Handle is no longer valid
    await clearDirectoryHandle();
    return null;
  }
}

/**
 * Request permission on a stored handle.
 * Must be called from a user gesture (click handler).
 * Returns the handle if permission is granted, null otherwise.
 */
export async function requestStoredHandlePermission(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadDirectoryHandle();
  if (!handle) return null;

  try {
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission === "granted") {
      return handle;
    }
    return null;
  } catch {
    await clearDirectoryHandle();
    return null;
  }
}

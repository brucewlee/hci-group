const DB_NAME = 'linkly-paper-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'paperId' });
      }
    };
  });
}

function withStore(mode, handler) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error || new Error('IndexedDB transaction failed.'));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error || new Error('IndexedDB transaction aborted.'));
        };

        handler(store, resolve, reject);
      }),
  );
}

export function loadPaperFiles() {
  return withStore('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error('Failed to load paper files.'));
    request.onsuccess = () => {
      const filesById = Object.fromEntries(
        (request.result || []).map(({ paperId, file }) => [paperId, file]),
      );
      resolve(filesById);
    };
  });
}

export function savePaperFile(paperId, file) {
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.put({ paperId, file });
    request.onerror = () => reject(request.error || new Error('Failed to save paper file.'));
    request.onsuccess = () => resolve();
  });
}

export function deletePaperFile(paperId) {
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.delete(paperId);
    request.onerror = () => reject(request.error || new Error('Failed to delete paper file.'));
    request.onsuccess = () => resolve();
  });
}

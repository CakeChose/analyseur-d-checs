/**
 * Cache des analyses dans IndexedDB, pour ne pas réanalyser une partie déjà vue.
 * Toute erreur (navigation privée, stockage bloqué…) est ignorée : le cache est un bonus.
 */
const DB = 'analyseur-echecs';
const STORE = 'analyses';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export const cacheGet = <T>(key: string) => run<T>('readonly', (s) => s.get(key));
export const cachePut = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key));

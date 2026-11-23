/**
 * Analyses enregistrées dans IndexedDB : une fiche par partie (voir `Fiche` dans profile.ts).
 * Toute erreur (navigation privée, stockage bloqué…) est ignorée : on réanalysera simplement.
 */
const DB = 'analyseur-echecs';
const STORE = 'games';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Version 2 : une fiche par partie (la v1 stockait par partie ET par profondeur).
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains('analyses')) db.deleteObjectStore('analyses');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
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
export const cacheAll = async <T>() => (await run<T[]>('readonly', (s) => s.getAll())) ?? [];

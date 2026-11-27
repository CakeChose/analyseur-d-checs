/**
 * Analyses enregistrées dans IndexedDB : une fiche par partie (voir `Fiche` dans profile.ts),
 * et le résumé de chaque partie pour le profil (`summaries`), pour ne pas le recalculer à chaque visite.
 * Toute erreur (navigation privée, stockage bloqué…) est ignorée : on réanalysera simplement.
 */
const DB = 'analyseur-echecs';
const STORE = 'games';
const SUMMARIES = 'summaries';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    // Version 2 : une fiche par partie (la v1 stockait par partie ET par profondeur).
    // Version 3 : résumés des parties pour le profil.
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains('analyses')) db.deleteObjectStore('analyses');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(SUMMARIES)) db.createObjectStore(SUMMARIES);
    };
    req.onsuccess = () => {
      // Une version plus récente du site, ouverte dans un autre onglet, doit pouvoir mettre la base à jour.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    // Un ancien onglet garde la base ouverte : on fait sans cache pour cette fois, et on réessaiera.
    req.onblocked = () => reject(new Error('base bloquée par un autre onglet'));
  }).catch((e) => {
    opening = null;
    throw e;
  });
  return opening;
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore, tx: IDBTransaction) => IDBRequest | void,
  store = STORE,
): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(mode === 'readwrite' ? [STORE, SUMMARIES] : store, mode);
      const req = fn(tx.objectStore(store), tx);
      let result: T | undefined;
      if (req) req.onsuccess = () => (result = req.result as T);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return undefined;
  }
}

/** Les résumés d'une partie (un par joueur), rangés sous « id|pseudo ». */
const summaryRange = (id: string) => IDBKeyRange.bound(`${id}|`, `${id}|\uffff`);

export const cacheGet = <T>(key: string) => run<T>('readonly', (s) => s.get(key));
/** Enregistre une fiche ; ses résumés, devenus faux, sont effacés (ils seront recalculés). */
export const cachePut = (key: string, value: unknown) => {
  for (const k of memory?.keys() ?? []) if (k.startsWith(`${key}|`)) memory!.delete(k);
  return run('readwrite', (s, tx) => {
    tx.objectStore(SUMMARIES).delete(summaryRange(key));
    return s.put(value, key);
  });
};
export const cacheAll = async <T>() => (await run<T[]>('readonly', (s) => s.getAll())) ?? [];
export const cacheKeys = async () => (await run<string[]>('readonly', (s) => s.getAllKeys() as IDBRequest)) ?? [];

/** Résumés déjà lus pendant cette visite (le profil est rechargé à chaque onglet). */
let memory: Map<string, unknown> | null = null;

/** Tous les résumés enregistrés : clé « id|pseudo » → valeur. */
export async function summaryAll<T>(): Promise<Map<string, T>> {
  if (memory) return memory as Map<string, T>;
  const out = new Map<string, T>();
  await run(
    'readonly',
    (s) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.set(c.key as string, c.value as T);
        c.continue();
      };
    },
    SUMMARIES,
  );
  memory = out;
  return out;
}

export const summaryKey = (id: string, user: string) => `${id}|${user.toLowerCase()}`;

/** Enregistre plusieurs résumés d'un coup (une seule transaction). */
export const summaryPutMany = (items: [string, unknown][]) => {
  for (const [k, v] of items) memory?.set(k, v);
  return run('readwrite', (_, tx) => {
    const s = tx.objectStore(SUMMARIES);
    for (const [k, v] of items) s.put(v, k);
  });
};

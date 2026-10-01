import { BUILTIN_PACK, validatePack, type DungeonPack } from './pack';

/**
 * Where adventures live:
 *  - the built-in Underrealm (compiled in)
 *  - bundled adventures listed in public/dungeons/index.json
 *  - adventures the player uploads, kept in IndexedDB (room for packs with
 *    embedded images and music, unlike localStorage)
 */

export type AdventureSource = 'builtin' | 'bundled' | 'uploaded';

export interface AdventureEntry {
  pack: DungeonPack;
  source: AdventureSource;
}

const DB_NAME = 'game-arcade-underrealm';
const STORE = 'packs';
const LEGACY_KEY = 'game-arcade.underrealm.packs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

/** Packs saved by an earlier version in localStorage move into IndexedDB once. */
async function migrateLegacy(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    for (const p of JSON.parse(raw) as unknown[]) await savePack(validatePack(p));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore - nothing to migrate
  }
}

export async function savePack(pack: DungeonPack): Promise<void> {
  if (pack.id === BUILTIN_PACK.id) throw new Error('That id is reserved for the built-in adventure');
  await tx('readwrite', (s) => s.put(pack));
}

export async function deletePack(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function uploadedPacks(): Promise<DungeonPack[]> {
  try {
    await migrateLegacy();
    const all = await tx<DungeonPack[]>('readonly', (s) => s.getAll() as IDBRequest<DungeonPack[]>);
    return all.map((p) => validatePack(p));
  } catch {
    return [];
  }
}

let bundledCache: DungeonPack[] | null = null;

export async function bundledPacks(): Promise<DungeonPack[]> {
  if (bundledCache) return bundledCache;
  try {
    const res = await fetch('dungeons/index.json');
    if (!res.ok) return [];
    const list = (await res.json()) as { file: string }[];
    const out: DungeonPack[] = [];
    for (const item of list) {
      try {
        const r = await fetch(`dungeons/${item.file}`);
        if (r.ok) out.push(validatePack(await r.json()));
      } catch {
        // skip a broken bundled pack rather than hide the rest
      }
    }
    bundledCache = out;
    return out;
  } catch {
    return [];
  }
}

/** Every adventure available in the Hall, built-in first. */
export async function allAdventures(): Promise<AdventureEntry[]> {
  const [bundled, uploaded] = await Promise.all([bundledPacks(), uploadedPacks()]);
  const out: AdventureEntry[] = [{ pack: BUILTIN_PACK, source: 'builtin' }];
  for (const p of bundled) out.push({ pack: p, source: 'bundled' });
  for (const p of uploaded) if (!out.some((e) => e.pack.id === p.id)) out.push({ pack: p, source: 'uploaded' });
  return out;
}

export async function findAdventure(id: string): Promise<DungeonPack | null> {
  if (id === BUILTIN_PACK.id) return BUILTIN_PACK;
  const all = await allAdventures();
  return all.find((e) => e.pack.id === id)?.pack ?? null;
}

import { onLocalWrote, pulledFromServer, withoutEcho, type SyncCollection } from './syncBus';
import { SYNC_COLLECTIONS, type SyncCollectionDef } from './syncCollections';
import { diffRows, hashAll, mergeRows, rowHash, type Base, type Rows } from './syncMerge';
import type { RemoteDataService } from './remoteDataService';

// Cloud sync (step 2): this device's stores stay the source the screens read;
// signed in, they're merged with the account's rows on sign-in and whenever
// the app comes back to the front, and each local change is sent up shortly after.

const MARKER_KEY = 'goodroot:sync:v1';
/** Strokes and drags write many times a second; send once things settle. */
export const PUSH_DELAY_MS = 1500;

/** Which account this device last synced with, and per collection the hashes agreed on. */
export interface SyncMarker {
  userId: string;
  base: Partial<Record<SyncCollection, Base>>;
}

export function loadMarker(): SyncMarker | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MARKER_KEY) ?? 'null') as SyncMarker | null;
    if (!raw || typeof raw.userId !== 'string' || !raw.base || typeof raw.base !== 'object') return null;
    return raw;
  } catch {
    return null;
  }
}

function saveMarker(marker: SyncMarker): void {
  try {
    window.localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    // Without it the next sign-in merges as if for the first time: nothing lost, rows just compared again.
  }
}

function sameRows(a: Rows, b: Rows): boolean {
  if (a.size !== b.size) return false;
  for (const [id, row] of a) {
    const other = b.get(id);
    if (!other || rowHash(other) !== rowHash(row)) return false;
  }
  return true;
}

export type SyncPlan = 'merge' | 'replace';

/**
 * How a pull treats this device's rows:
 * - same account as last time → three-way merge against the stored base;
 * - another account synced here before → replace (that account's data is on its server);
 * - never synced → merge with an empty base, so everything here is added to the account
 *   (unless the account has its own already: then categories still at their seeds count as
 *   agreed, so ones the account deleted don't come back).
 */
export function planFor(marker: SyncMarker | null, userId: string, def: SyncCollectionDef, accountEmpty: boolean): { plan: SyncPlan; base: Base } {
  if (marker?.userId === userId) return { plan: 'merge', base: marker.base[def.name] ?? {} };
  if (marker) return { plan: 'replace', base: {} };
  return { plan: 'merge', base: def.seeds && !accountEmpty ? hashAll(def.seeds()) : {} };
}

export interface CloudSync {
  signedIn(userId: string): Promise<boolean>;
  signedOut(): void;
  /** Pull again (the app came back to the front). */
  refresh(): Promise<boolean>;
  /** Starts sending this device's writes up; returns the stop (an effect's cleanup). */
  watchLocal(): () => void;
}

export interface CloudSyncDeps {
  remote: RemoteDataService;
  collections?: readonly SyncCollectionDef[];
  /** A pull or push failed (null: all good again). */
  onProblem?: (failed: boolean) => void;
  /** For tests: run pushes now instead of after PUSH_DELAY_MS. */
  schedule?: (run: () => void, ms: number) => () => void;
}

export function createCloudSync({ remote, collections = SYNC_COLLECTIONS, onProblem, schedule }: CloudSyncDeps): CloudSync {
  let userId: string | null = null;
  let synced = false;
  let queue: Promise<unknown> = Promise.resolve();
  const timers = new Map<SyncCollection, () => void>();
  const later =
    schedule ??
    ((run: () => void, ms: number) => {
      const t = setTimeout(run, ms);
      return () => clearTimeout(t);
    });

  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job, job);
    queue = next.catch(() => undefined);
    return next;
  };

  const storeBase = (id: string, name: SyncCollection, base: Base) => {
    const marker = loadMarker();
    saveMarker({ userId: id, base: { ...(marker?.userId === id ? marker.base : {}), [name]: base } });
  };

  const pull = async (id: string): Promise<boolean> => {
    const marker = loadMarker();
    // Read everything first: a half-fetched account must not replace or merge anything.
    const fetched: { def: SyncCollectionDef; remote: Rows }[] = [];
    for (const def of collections) {
      const raw = await remote.list(def, id);
      if (raw === 'error' || userId !== id) return false;
      const rows: Rows = new Map();
      for (const item of raw) {
        const row = def.fromRemote(item);
        if (row) rows.set(String(row[def.idColumn]), row);
      }
      fetched.push({ def, remote: rows });
    }

    const changed = new Set<SyncCollection>();
    let ok = true;
    for (const { def, remote: there } of fetched) {
      const { plan, base } = planFor(marker, id, def, there.size === 0);
      const here = def.readLocal();
      let rows: Rows;
      let upsert: Record<string, unknown>[] = [];
      let remove: string[] = [];
      if (plan === 'replace') {
        // A fresh account has no categories yet: it starts from the seeds, like a new device.
        rows = there.size || !def.seeds ? there : def.seeds();
        if (!there.size && def.seeds) upsert = [...rows.values()];
        if (!sameRows(rows, here)) changed.add(def.name);
      } else {
        const merged = mergeRows(here, there, base);
        rows = merged.rows;
        ({ upsert, remove } = merged);
        if (merged.localChanged) changed.add(def.name);
      }
      if (changed.has(def.name)) withoutEcho(() => def.writeLocal(rows));
      const sent = (!upsert.length || (await remote.upsert(def, id, upsert))) && (!remove.length || (await remote.remove(def, id, remove)));
      if (userId !== id) return false;
      // Until the server has everything, the old base stays: the next sync redoes what's missing.
      if (sent) storeBase(id, def.name, hashAll(rows));
      else {
        ok = false;
        storeBase(id, def.name, plan === 'merge' ? base : {});
      }
    }
    pulledFromServer(changed);
    return ok;
  };

  const push = async (id: string, name: SyncCollection): Promise<boolean> => {
    const def = collections.find((c) => c.name === name);
    const marker = loadMarker();
    if (!def || marker?.userId !== id) return true;
    const base = marker.base[name] ?? {};
    const here = def.readLocal();
    const { upsert, remove } = diffRows(here, base);
    if (!upsert.length && !remove.length) return true;
    const okUp = !upsert.length || (await remote.upsert(def, id, upsert));
    const okDel = !remove.length || (await remote.remove(def, id, remove));
    if (userId !== id) return false;
    // Record exactly what got through, so a failed half is retried.
    const next = { ...base };
    if (okUp) upsert.forEach((row) => (next[String(row[def.idColumn])] = rowHash(row)));
    if (okDel) remove.forEach((rid) => delete next[rid]);
    storeBase(id, name, next);
    return okUp && okDel;
  };

  const report = (ok: boolean) => {
    onProblem?.(!ok);
    return ok;
  };

  const onWrote = (name: SyncCollection) => {
    if (!userId || !synced) return;
    const id = userId;
    timers.get(name)?.();
    timers.set(
      name,
      later(() => {
        timers.delete(name);
        void enqueue(() => push(id, name)).then(report);
      }, PUSH_DELAY_MS),
    );
  };

  const clearTimers = () => {
    timers.forEach((cancel) => cancel());
    timers.clear();
  };

  return {
    signedIn(id) {
      if (userId !== id) synced = false;
      userId = id;
      return enqueue(async () => {
        if (userId !== id) return false;
        const ok = await pull(id);
        if (userId === id) synced = true;
        return report(ok);
      });
    },
    signedOut() {
      userId = null;
      synced = false;
      clearTimers();
    },
    refresh() {
      const id = userId;
      if (!id || !synced) return Promise.resolve(true);
      clearTimers(); // the pull sends whatever was waiting
      return enqueue(() => pull(id)).then(report);
    },
    watchLocal() {
      const stop = onLocalWrote(onWrote);
      return () => {
        stop();
        clearTimers();
      };
    },
  };
}

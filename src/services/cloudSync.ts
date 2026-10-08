import { onLocalWrote, pulledFromServer, withoutEcho, type SyncCollection } from './syncBus';
import { SYNC_COLLECTIONS, type SyncCollectionDef } from './syncCollections';
import { diffRows, hashAll, mergeDelta, mergeRows, rowHash, type Base, type Rows } from './syncMerge';
import type { RemoteDataService } from './remoteDataService';

// Cloud sync (step 2): this device's stores stay the source the screens read;
// signed in, they're merged with the account's rows on sign-in and whenever
// the app comes back to the front, and each local change is sent up shortly after.

const MARKER_KEY = 'goodroot:sync:v1';
/** Strokes and drags write many times a second; send once things settle. */
export const PUSH_DELAY_MS = 1500;
/**
 * A pull asks for rows written since its cursor minus this: a write that began
 * before the cursor's row but committed after it carries the earlier stamp.
 * Fetching a few rows twice is harmless (they merge as unchanged).
 */
export const CURSOR_OVERLAP_MS = 2 * 60_000;
/**
 * Deletion marks are purged after 30 days (purge_sync_tombstones); a cursor
 * older than this reads everything again so no deletion is missed.
 */
export const CURSOR_MAX_AGE_MS = 21 * 24 * 3600_000;

/** Which account this device last synced with, and per collection the hashes agreed on. */
export interface SyncMarker {
  userId: string;
  base: Partial<Record<SyncCollection, Base>>;
  /** Per collection, the latest server_updated_at pulled (absent: next pull reads everything). */
  cursor?: Partial<Record<SyncCollection, string>>;
}

export function loadMarker(): SyncMarker | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MARKER_KEY) ?? 'null') as SyncMarker | null;
    if (!raw || typeof raw.userId !== 'string' || !raw.base || typeof raw.base !== 'object') return null;
    if (raw.cursor !== undefined && (!raw.cursor || typeof raw.cursor !== 'object')) return { userId: raw.userId, base: raw.base };
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

/** Where an incremental pull starts, or undefined for a full read (first sync, other account, stale cursor). */
export function sinceFor(marker: SyncMarker | null, userId: string, name: SyncCollection, now = Date.now()): string | undefined {
  if (marker?.userId !== userId) return undefined;
  const cursor = Date.parse(marker.cursor?.[name] ?? '');
  if (Number.isNaN(cursor) || now - cursor > CURSOR_MAX_AGE_MS) return undefined;
  return new Date(cursor - CURSOR_OVERLAP_MS).toISOString();
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

  /** `cursor` undefined keeps the stored one; null drops it (next pull reads everything). */
  const storeBase = (id: string, name: SyncCollection, base: Base, cursor?: string | null) => {
    const marker = loadMarker();
    const same = marker?.userId === id;
    const cursors = { ...(same ? marker.cursor : {}) };
    if (cursor === null) delete cursors[name];
    else if (cursor !== undefined) cursors[name] = cursor;
    saveMarker({ userId: id, base: { ...(same ? marker.base : {}), [name]: base }, cursor: cursors });
  };

  const pull = async (id: string): Promise<boolean> => {
    const marker = loadMarker();
    // Read everything first: a half-fetched account must not replace or merge anything.
    const fetched: { def: SyncCollectionDef; remote: Rows; deleted: Set<string>; delta: boolean; cursor: string | null }[] = [];
    for (const def of collections) {
      const since = sinceFor(marker, id, def.name);
      const batch = await remote.list(def, id, since);
      if (batch === 'error' || userId !== id) return false;
      const rows: Rows = new Map();
      const deleted = new Set(batch.deleted);
      for (const item of batch.rows) {
        const row = def.fromRemote(item);
        if (row) rows.set(String(row[def.idColumn]), row);
        // A server row this device can't read counts as gone, as in a full read.
        else if (since && typeof item[def.idColumn] === 'string') deleted.add(item[def.idColumn] as string);
      }
      // Nothing new since the cursor: keep it.
      const cursor = batch.cursor ?? (since ? (marker?.cursor?.[def.name] ?? null) : null);
      fetched.push({ def, remote: rows, deleted, delta: !!since, cursor });
    }

    const changed = new Set<SyncCollection>();
    let ok = true;
    for (const { def, remote: there, deleted, delta, cursor } of fetched) {
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
        const merged = delta ? mergeDelta(here, there, deleted, base) : mergeRows(here, there, base);
        rows = merged.rows;
        ({ upsert, remove } = merged);
        if (merged.localChanged) changed.add(def.name);
      }
      if (changed.has(def.name)) withoutEcho(() => def.writeLocal(rows));
      const sent = (!upsert.length || (await remote.upsert(def, id, upsert))) && (!remove.length || (await remote.remove(def, id, remove)));
      if (userId !== id) return false;
      // Until the server has everything, the old base and cursor stay: the next sync redoes what's missing.
      if (sent) storeBase(id, def.name, hashAll(rows), cursor);
      else {
        ok = false;
        storeBase(id, def.name, plan === 'merge' ? base : {}, plan === 'merge' ? undefined : null);
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

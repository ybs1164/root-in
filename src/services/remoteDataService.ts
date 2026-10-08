import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { SyncCollectionDef } from './syncCollections';
import type { SyncRow } from './syncMerge';

// The account's synced rows on the server. Row level security limits every
// call to the signed-in user's rows; user_id is sent anyway because the
// tables are keyed by it. Never rejects: a failure comes back as false/'error'.
//
// Deleting only marks a row (deleted_at), so a pull that asks for what changed
// since its cursor also hears about deletions; the server stamps
// server_updated_at on every write (supabase/migrations …_sync_cursor.sql).

export interface RemoteBatch {
  /** Live rows, as stored (sync columns stripped). */
  rows: Record<string, unknown>[];
  /** Ids deleted since `since` (always empty for a full read). */
  deleted: string[];
  /** The latest server_updated_at seen, for the next pull (null: nothing read). */
  cursor: string | null;
}

export interface RemoteDataService {
  /** Without `since`, every live row; with it, rows written at or after it, deletions included. */
  list(def: SyncCollectionDef, userId: string, since?: string): Promise<RemoteBatch | 'error'>;
  upsert(def: SyncCollectionDef, userId: string, rows: SyncRow[]): Promise<boolean>;
  remove(def: SyncCollectionDef, userId: string, ids: string[]): Promise<boolean>;
}

// PostgREST returns at most 1000 rows per request by default.
const PAGE = 1000;
const WRITE_CHUNK = 200;

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

export function createSupabaseDataService(getClient: () => Promise<SupabaseClient | null> = getSupabase): RemoteDataService {
  return {
    async list(def, userId, since) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        const batch: RemoteBatch = { rows: [], deleted: [], cursor: null };
        let latest = -Infinity;
        for (let from = 0; ; from += PAGE) {
          const base = client
            .from(def.table)
            .select([...def.columns, 'server_updated_at', 'deleted_at'].join(','))
            .eq('user_id', userId);
          const { data, error } = await (since ? base.gte('server_updated_at', since) : base.is('deleted_at', null))
            .order(def.idColumn)
            .range(from, from + PAGE - 1);
          if (error || !Array.isArray(data)) return 'error';
          for (const raw of data as unknown as Record<string, unknown>[]) {
            const { server_updated_at: stamp, deleted_at: deletedAt, ...row } = raw;
            const time = typeof stamp === 'string' ? Date.parse(stamp) : NaN;
            if (time > latest) {
              latest = time;
              batch.cursor = new Date(time).toISOString();
            }
            if (deletedAt) batch.deleted.push(String(row[def.idColumn]));
            else batch.rows.push(row);
          }
          if (data.length < PAGE) return batch;
        }
      } catch {
        return 'error';
      }
    },

    async upsert(def, userId, rows) {
      try {
        const client = await getClient();
        if (!client) return false;
        for (const part of chunks(rows, WRITE_CHUNK)) {
          // deleted_at: null brings back a row deleted elsewhere and edited here.
          const body = part.map((row) => ({ ...(def.toServer ? def.toServer(row) : row), user_id: userId, deleted_at: null }));
          const { error } = await client.from(def.table).upsert(body, { onConflict: `user_id,${def.idColumn}` });
          if (error) return false;
        }
        return true;
      } catch {
        return false;
      }
    },

    async remove(def, userId, ids) {
      try {
        const client = await getClient();
        if (!client) return false;
        for (const part of chunks(ids, WRITE_CHUNK)) {
          // Marked, not deleted, so other devices' next pull hears of it. The content
          // stays until purge_sync_tombstones clears old marks.
          const { error } = await client
            .from(def.table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('user_id', userId)
            .in(def.idColumn, part);
          if (error) return false;
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const remoteDataService: RemoteDataService = createSupabaseDataService();

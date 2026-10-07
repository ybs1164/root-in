import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { SyncCollectionDef } from './syncCollections';
import type { SyncRow } from './syncMerge';

// The account's synced rows on the server. Row level security limits every
// call to the signed-in user's rows; user_id is sent anyway because the
// tables are keyed by it. Never rejects: a failure comes back as false/'error'.

export interface RemoteDataService {
  list(def: SyncCollectionDef, userId: string): Promise<Record<string, unknown>[] | 'error'>;
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
    async list(def, userId) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        const all: Record<string, unknown>[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await client
            .from(def.table)
            .select(def.columns.join(','))
            .eq('user_id', userId)
            .order(def.idColumn)
            .range(from, from + PAGE - 1);
          if (error || !Array.isArray(data)) return 'error';
          all.push(...(data as unknown as Record<string, unknown>[]));
          if (data.length < PAGE) return all;
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
          const body = part.map((row) => ({ ...(def.toServer ? def.toServer(row) : row), user_id: userId }));
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
          const { error } = await client.from(def.table).delete().eq('user_id', userId).in(def.idColumn, part);
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

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createSupabaseDataService } from './remoteDataService';
import { pinsCollection } from './syncCollections';

// A fake client: records each query builder call and answers with `data`.
function fakeClient(data: Record<string, unknown>[]) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const name of ['from', 'select', 'eq', 'gte', 'is', 'order', 'in', 'upsert', 'update']) {
    builder[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return builder;
    };
  }
  builder.range = (...args: unknown[]) => {
    calls.push(['range', ...args]);
    return Promise.resolve({ data, error: null });
  };
  builder.then = (resolve: (v: unknown) => void) => resolve({ error: null });
  const client = { from: builder.from } as unknown as SupabaseClient;
  return { client, calls };
}

const row = (id: string, stamp: string, deleted: string | null = null) => ({
  id,
  category_id: 'none',
  place: { id: `p${id}`, name: id, center: [127, 37.5] },
  memo: null,
  created_at: '2026-10-01T00:00:00+00:00',
  updated_at: null,
  server_updated_at: stamp,
  deleted_at: deleted,
});

describe('remoteDataService', () => {
  it('reads only live rows without a cursor', async () => {
    const { client, calls } = fakeClient([row('a', '2026-10-08T01:00:00.123456+00:00')]);
    const batch = await createSupabaseDataService(async () => client).list(pinsCollection, 'u1');
    expect(calls).toContainEqual(['is', 'deleted_at', null]);
    expect(calls.some(([name]) => name === 'gte')).toBe(false);
    expect(batch).toEqual({ rows: [expect.not.objectContaining({ server_updated_at: expect.anything() })], deleted: [], cursor: '2026-10-08T01:00:00.123Z' });
  });

  it('with a cursor, reads what changed since and splits out deletions', async () => {
    const { client, calls } = fakeClient([row('a', '2026-10-08T01:00:00+00:00'), row('b', '2026-10-08T02:00:00+00:00', '2026-10-08T02:00:00+00:00')]);
    const batch = await createSupabaseDataService(async () => client).list(pinsCollection, 'u1', '2026-10-08T00:00:00.000Z');
    expect(calls).toContainEqual(['gte', 'server_updated_at', '2026-10-08T00:00:00.000Z']);
    expect(calls.some(([name]) => name === 'is')).toBe(false);
    expect(batch).toMatchObject({ deleted: ['b'], cursor: '2026-10-08T02:00:00.000Z' });
    expect(batch !== 'error' && batch.rows.map((r) => r.id)).toEqual(['a']);
  });

  it('marks deletions instead of deleting, and clears the mark on upsert', async () => {
    const { client, calls } = fakeClient([]);
    const service = createSupabaseDataService(async () => client);
    expect(await service.remove(pinsCollection, 'u1', ['a'])).toBe(true);
    expect(calls).toContainEqual(['update', { deleted_at: expect.any(String) }]);
    expect(calls.some(([name]) => name === 'delete')).toBe(false);
    expect(await service.upsert(pinsCollection, 'u1', [{ id: 'a' }])).toBe(true);
    expect(calls).toContainEqual(['upsert', [{ id: 'a', user_id: 'u1', deleted_at: null }], { onConflict: 'user_id,id' }]);
  });
});

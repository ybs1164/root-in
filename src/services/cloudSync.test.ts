import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudSync, CURSOR_MAX_AGE_MS, CURSOR_OVERLAP_MS, loadMarker, sinceFor } from './cloudSync';
import { localCourses } from './courseRepository';
import { readStoredCategories, readStoredPins, writeStoredPins } from './pinRepository';
import type { RemoteDataService } from './remoteDataService';
import { onPulled } from './syncBus';
import { SYNC_COLLECTIONS } from './syncCollections';
import { DEFAULT_CATEGORIES } from '../domain/pin';
import type { Pin } from '../types/pin';

type ServerRow = Record<string, unknown> & { server_updated_at: string; deleted_at: string | null };

// An in-memory server: per table and user, rows as Postgres would hand them
// back. Like the real one it stamps server_updated_at on each write (here ten
// minutes apart, well past the pull overlap) and only marks deletions.
function fakeServer() {
  const tables = new Map<string, Map<string, ServerRow>>();
  const store = (name: string, user: string) => {
    const key = `${name}/${user}`;
    if (!tables.has(key)) tables.set(key, new Map());
    return tables.get(key)!;
  };
  let clock = Date.now();
  const stamp = () => new Date((clock += 10 * 60_000)).toISOString();
  /** Live rows only, without the sync columns. */
  const table = (name: string, user: string) =>
    new Map([...store(name, user)].filter(([, r]) => !r.deleted_at).map(([id, { server_updated_at: _s, deleted_at: _d, ...row }]) => [id, row]));
  /** A write from another phone. */
  const write = (name: string, user: string, row: Record<string, unknown>) =>
    store(name, user).set(String(row.id), JSON.parse(JSON.stringify({ ...row, user_id: user, server_updated_at: stamp(), deleted_at: null })));
  const erase = (name: string, user: string, id: string) => {
    const row = store(name, user).get(id);
    if (row) row.deleted_at = row.server_updated_at = stamp();
  };
  let failing = false;
  const service: RemoteDataService = {
    list: vi.fn(async (def, user, since) => {
      if (failing) return 'error';
      const rows = [...store(def.table, user).values()].filter((r) => (since ? r.server_updated_at >= since : !r.deleted_at));
      return {
        rows: rows.filter((r) => !r.deleted_at).map(({ server_updated_at: _s, deleted_at: _d, ...row }) => JSON.parse(JSON.stringify(row))),
        deleted: rows.filter((r) => r.deleted_at).map((r) => String(r[def.idColumn])),
        cursor: rows.map((r) => r.server_updated_at).sort().at(-1) ?? null,
      };
    }),
    upsert: vi.fn(async (def, user, rows) => {
      if (failing) return false;
      rows.forEach((row: Record<string, unknown>) => write(def.table, user, { ...row, id: row[def.idColumn] }));
      return true;
    }),
    remove: vi.fn(async (def, user, ids) => {
      if (failing) return false;
      ids.forEach((id: string) => erase(def.table, user, id));
      return true;
    }),
  };
  return { service, table, write, erase, fail: (on: boolean) => (failing = on) };
}

const pin = (id: string, extra: Partial<Pin> = {}): Pin => ({
  id,
  userId: 'device',
  place: { id: `place-${id}`, name: id, center: [127, 37.5] },
  categoryId: 'none',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

/** Another phone: this test's storage swapped out and back. */
function onOtherPhone<T>(run: () => T): T {
  const mine = new Map<string, string>();
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i)!;
    mine.set(k, window.localStorage.getItem(k)!);
  }
  window.localStorage.clear();
  const result = run();
  const theirs = new Map<string, string>();
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i)!;
    theirs.set(k, window.localStorage.getItem(k)!);
  }
  window.localStorage.clear();
  mine.forEach((v, k) => window.localStorage.setItem(k, v));
  return Object.assign(result as object, { storage: theirs }) as T;
}

const now = (run: () => void) => {
  run();
  return () => undefined;
};

describe('cloudSync', () => {
  let server: ReturnType<typeof fakeServer>;
  beforeEach(() => {
    server = fakeServer();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'device');
  });

  it('puts everything on this device into the account on the first sign-in', async () => {
    writeStoredPins([pin('a'), pin('b')]);
    const sync = createCloudSync({ remote: server.service });
    const stop = sync.watchLocal();
    expect(await sync.signedIn('u1')).toBe(true);
    expect([...server.table('pins', 'u1').keys()].sort()).toEqual(['a', 'b']);
    expect(server.table('pin_categories', 'u1').size).toBe(DEFAULT_CATEGORIES.length);
    expect(loadMarker()?.userId).toBe('u1');
    stop();
  });

  it("brings the account's rows to a new phone, without the new phone's seed categories coming back", async () => {
    writeStoredPins([pin('a')]);
    const first = createCloudSync({ remote: server.service });
    const stopFirst = first.watchLocal();
    await first.signedIn('u1');
    stopFirst();
    // The first phone's owner deleted a default category.
    server.erase('pin_categories', 'u1', DEFAULT_CATEGORIES[0].id);

    const other = await onOtherPhone(async () => {
      const second = createCloudSync({ remote: server.service });
    const stopSecond = second.watchLocal();
      await second.signedIn('u1');
      stopSecond();
      return { pins: readStoredPins(), categories: readStoredCategories() };
    });
    expect(other.pins.map((p) => p.id)).toEqual(['a']);
    expect(other.categories?.map((c) => c.id)).not.toContain(DEFAULT_CATEGORIES[0].id);
  });

  it('sends changes made here shortly after, deletions too', async () => {
    writeStoredPins([pin('a'), pin('b')]);
    const sync = createCloudSync({ remote: server.service, schedule: now });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    writeStoredPins([pin('a', { memo: '메모', updatedAt: '2026-10-08T00:00:00.000Z' })]);
    await vi.waitFor(() => expect(server.table('pins', 'u1').has('b')).toBe(false));
    expect(server.table('pins', 'u1').get('a')).toMatchObject({ memo: '메모' });
    stop();
  });

  it("takes another phone's edits and deletions on the next pull, and tells the screens", async () => {
    writeStoredPins([pin('a'), pin('b')]);
    const sync = createCloudSync({ remote: server.service });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    server.erase('pins', 'u1', 'b');
    server.write('pins', 'u1', { ...server.table('pins', 'u1').get('a'), memo: '다른 폰' });
    const seen: string[][] = [];
    const stopPulled = onPulled((changed) => seen.push([...changed]));
    await sync.refresh();
    stopPulled();
    expect(readStoredPins()).toEqual([expect.objectContaining({ id: 'a', memo: '다른 폰' })]);
    expect(seen).toEqual([['pins']]);
    stop();
  });

  it("doesn't echo what it pulled back to the server", async () => {
    writeStoredPins([pin('a')]);
    const sync = createCloudSync({ remote: server.service, schedule: now });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    server.write('pins', 'u1', { ...server.table('pins', 'u1').get('a'), id: 'c' });
    vi.mocked(server.service.upsert).mockClear();
    await sync.refresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(server.service.upsert).not.toHaveBeenCalled();
    stop();
  });

  it("replaces this phone's data when a different account signs in", async () => {
    writeStoredPins([pin('a')]);
    const sync = createCloudSync({ remote: server.service });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    sync.signedOut();
    server.write('pins', 'u2', { id: 'z', category_id: 'none', place: { id: 'pz', name: 'z', center: [127, 37] }, created_at: '2026-10-01T00:00:00+00:00' });
    await sync.signedIn('u2');
    expect(readStoredPins().map((p) => p.id)).toEqual(['z']);
    expect(server.table('pins', 'u2').has('a')).toBe(false);
    expect(server.table('pin_categories', 'u2').size).toBe(DEFAULT_CATEGORIES.length); // a fresh account starts from the seeds
    stop();
  });

  it('changes nothing here when the server is unreachable, and catches up later', async () => {
    writeStoredPins([pin('a')]);
    server.fail(true);
    const problems: boolean[] = [];
    const sync = createCloudSync({ remote: server.service, onProblem: (p) => problems.push(p) });
    const stop = sync.watchLocal();
    expect(await sync.signedIn('u1')).toBe(false);
    expect(readStoredPins().map((p) => p.id)).toEqual(['a']);
    expect(loadMarker()).toBeNull();
    server.fail(false);
    expect(await sync.refresh()).toBe(true);
    expect(server.table('pins', 'u1').has('a')).toBe(true);
    expect(problems).toEqual([true, false]);
    stop();
  });

  it('keeps courses and their folders together', async () => {
    const routes = SYNC_COLLECTIONS.find((d) => d.name === 'routes')!;
    localCourses.write([{ id: 'c1', userId: 'device', title: 'r', theme: 'etc', travelMode: 'walk', stops: [], createdAt: '2026-10-01T00:00:00.000Z' }]);
    const sync = createCloudSync({ remote: server.service });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    expect(server.table(routes.table, 'u1').get('c1')).toMatchObject({ title: 'r', folder_id: null });
    stop();
  });

  it('after the first sync, reads only what changed since — deletions included', async () => {
    writeStoredPins([pin('a'), pin('b'), pin('c')]);
    const sync = createCloudSync({ remote: server.service });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    expect(vi.mocked(server.service.list).mock.calls.every(([, , since]) => since === undefined)).toBe(true);
    // The account was empty: no stamp to start from yet, so one more full read sets the cursor.
    await sync.refresh();

    server.erase('pins', 'u1', 'b');
    server.write('pins', 'u1', { ...server.table('pins', 'u1').get('c'), memo: '다른 폰' });
    vi.mocked(server.service.list).mockClear();
    await sync.refresh();
    const pinsCall = vi.mocked(server.service.list).mock.calls.find(([def]) => def.table === 'pins')!;
    expect(pinsCall[2]).toEqual(expect.any(String));
    const read = await vi.mocked(server.service.list).mock.results[vi.mocked(server.service.list).mock.calls.indexOf(pinsCall)].value;
    expect(read.rows.map((r: { id: string }) => r.id)).toEqual(['c']);
    expect(read.deleted).toEqual(['b']);
    expect(readStoredPins().map((p) => [p.id, p.memo])).toEqual([['a', undefined], ['c', '다른 폰']]);
    stop();
  });

  it('keeps an edit made here over a deletion from another phone, and brings the row back', async () => {
    writeStoredPins([pin('a')]);
    const sync = createCloudSync({ remote: server.service, schedule: () => () => undefined });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    server.erase('pins', 'u1', 'a');
    writeStoredPins([pin('a', { memo: '여기서 고침', updatedAt: '2026-10-08T00:00:00.000Z' })]);
    await sync.refresh();
    expect(readStoredPins().map((p) => p.memo)).toEqual(['여기서 고침']);
    expect(server.table('pins', 'u1').get('a')).toMatchObject({ memo: '여기서 고침' });
    stop();
  });

  it('sends what changed here while also reading a delta', async () => {
    writeStoredPins([pin('a')]);
    const sync = createCloudSync({ remote: server.service, schedule: () => () => undefined });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    writeStoredPins([pin('b')]); // a deleted, b added here, not pushed yet
    await sync.refresh();
    expect([...server.table('pins', 'u1').keys()]).toEqual(['b']);
    stop();
  });

  it('keeps the cursor when a pull fails to send, so the same rows are read again', async () => {
    writeStoredPins([pin('a')]);
    const sync = createCloudSync({ remote: server.service, schedule: () => () => undefined });
    const stop = sync.watchLocal();
    await sync.signedIn('u1');
    await sync.refresh();
    const before = loadMarker()?.cursor?.pins;
    expect(before).toEqual(expect.any(String));
    server.write('pins', 'u1', { ...server.table('pins', 'u1').get('a'), id: 'n' });
    writeStoredPins([...readStoredPins(), pin('x')]);
    vi.mocked(server.service.upsert).mockResolvedValueOnce(false);
    expect(await sync.refresh()).toBe(false);
    expect(loadMarker()?.cursor?.pins).toBe(before);
    expect(await sync.refresh()).toBe(true);
    expect(loadMarker()?.cursor?.pins! > before!).toBe(true);
    expect([...server.table('pins', 'u1').keys()].sort()).toEqual(['a', 'n', 'x']);
    stop();
  });
});

describe('sinceFor', () => {
  const marker = { userId: 'u1', base: {}, cursor: { pins: '2026-10-08T12:00:00.000Z' } };
  const now = Date.parse('2026-10-09T00:00:00.000Z');

  it('starts a little before the cursor', () => {
    expect(sinceFor(marker, 'u1', 'pins', now)).toBe(new Date(Date.parse('2026-10-08T12:00:00.000Z') - CURSOR_OVERLAP_MS).toISOString());
  });

  it('reads everything with no cursor, for another account, or when the cursor is too old', () => {
    expect(sinceFor(marker, 'u1', 'days', now)).toBeUndefined();
    expect(sinceFor(marker, 'u2', 'pins', now)).toBeUndefined();
    expect(sinceFor({ userId: 'u1', base: {} }, 'u1', 'pins', now)).toBeUndefined();
    expect(sinceFor(marker, 'u1', 'pins', Date.parse(marker.cursor.pins) + CURSOR_MAX_AGE_MS + 1)).toBeUndefined();
  });
});

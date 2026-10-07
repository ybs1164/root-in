import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudSync, loadMarker } from './cloudSync';
import { localCourses } from './courseRepository';
import { readStoredCategories, readStoredPins, writeStoredPins } from './pinRepository';
import type { RemoteDataService } from './remoteDataService';
import { onPulled } from './syncBus';
import { SYNC_COLLECTIONS } from './syncCollections';
import { DEFAULT_CATEGORIES } from '../domain/pin';
import type { Pin } from '../types/pin';

// An in-memory server: per table and user, rows as Postgres would hand them back.
function fakeServer() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const table = (name: string, user: string) => {
    const key = `${name}/${user}`;
    if (!tables.has(key)) tables.set(key, new Map());
    return tables.get(key)!;
  };
  let failing = false;
  const service: RemoteDataService = {
    list: vi.fn(async (def, user) => (failing ? 'error' : [...table(def.table, user).values()].map((r) => JSON.parse(JSON.stringify(r))))),
    upsert: vi.fn(async (def, user, rows) => {
      if (failing) return false;
      rows.forEach((row: Record<string, unknown>) => table(def.table, user).set(String(row[def.idColumn]), JSON.parse(JSON.stringify({ ...row, user_id: user }))));
      return true;
    }),
    remove: vi.fn(async (def, user, ids) => {
      if (failing) return false;
      ids.forEach((id: string) => table(def.table, user).delete(id));
      return true;
    }),
  };
  return { service, table, fail: (on: boolean) => (failing = on) };
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
    server.table('pin_categories', 'u1').delete(DEFAULT_CATEGORIES[0].id);

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
    server.table('pins', 'u1').delete('b');
    server.table('pins', 'u1').set('a', { ...server.table('pins', 'u1').get('a'), memo: '다른 폰' });
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
    server.table('pins', 'u1').set('c', { ...server.table('pins', 'u1').get('a'), id: 'c' });
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
    server.table('pins', 'u2').set('z', { id: 'z', category_id: 'none', place: { id: 'pz', name: 'z', center: [127, 37] }, created_at: '2026-10-01T00:00:00+00:00' });
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
});

import { beforeEach, describe, expect, it } from 'vitest';
import { saveRouteFolders, loadRouteFolders } from './routeFolderRepository';
import { localCourses } from './courseRepository';
import { loadDays, saveDays } from './dayRepository';
import { readStoredCategories, readStoredPins, writeStoredCategories, writeStoredPins } from './pinRepository';
import { SYNC_COLLECTIONS, type SyncCollectionDef } from './syncCollections';
import { rowHash, type SyncRow } from './syncMerge';
import type { Course } from '../types/course';

// What Postgres hands back: keys in its own order, timestamps as +00:00.
function asFromServer(def: SyncCollectionDef, row: SyncRow): Record<string, unknown> {
  const sent = { ...(def.toServer ? def.toServer(row) : row), user_id: 'u1' };
  const back = Object.fromEntries(Object.entries(sent).reverse());
  for (const k of ['created_at', 'updated_at']) {
    if (typeof back[k] === 'string') back[k] = (back[k] as string).replace('Z', '+00:00');
  }
  return JSON.parse(JSON.stringify(back));
}

const place = { id: 'p1', name: '카페', center: [127.0, 37.5] as [number, number], address: '서울 성동구' };

function seed() {
  window.localStorage.setItem('goodroot:anonymous-user-id', 'device');
  writeStoredCategories([{ id: 'cat', name: '카페', icon: 'cafe', color: 2, order: 0 }, { id: 'mine', name: '내 색', icon: 'pin', color: '#12abef', order: 1 }]);
  writeStoredPins([
    { id: 'pin1', userId: 'device', place, categoryId: 'cat', memo: '라떼', createdAt: '2026-10-01T10:00:00.000Z' },
    { id: 'pin2', userId: 'device', place: { ...place, id: 'p2' }, categoryId: 'none', createdAt: '2026-10-02T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z' },
  ]);
  const course: Course = {
    id: 'c1',
    userId: 'device',
    title: '성수 산책',
    theme: 'etc',
    travelMode: 'walk',
    stops: [{ place }, { place: { ...place, id: 'p2' }, memo: '여기' }],
    note: '설명',
    stopShapes: ['star', null],
    edgeStyles: ['dashed'],
    shareCount: 3,
    createdAt: '2026-10-01T10:00:00.000Z',
  };
  localCourses.write([course, { ...course, id: 'c2', title: '둘째', note: undefined, stopShapes: undefined, edgeStyles: undefined, shareCount: undefined }]);
  saveRouteFolders({ folders: [{ id: 'f1', name: '#1', icon: '❤️' }], assign: { c1: 'f1' }, order: ['c2', 'c1'] });
  saveDays({
    decor: { '2026-10-03': { stickers: [], strokes: [{ tool: 'pen', color: 'ink-black', width: 'thin', points: [[0.1, 0.2]] }], theme: 'sky' } },
    shapes: { '2026-10-03|10:00|카페': 'star' },
    edges: {},
  } as never);
}

describe('syncCollections', () => {
  beforeEach(seed);

  it.each(SYNC_COLLECTIONS.map((def) => [def.name, def] as const))('%s: a row reads back from the server as the same row', (_name, def) => {
    const rows = def.readLocal();
    expect(rows.size).toBeGreaterThan(0);
    rows.forEach((row) => {
      const back = def.fromRemote(asFromServer(def, row));
      expect(back && rowHash(back)).toBe(rowHash(row));
    });
  });

  it.each(SYNC_COLLECTIONS.map((def) => [def.name, def] as const))('%s: writing the rows back keeps this device as it was', (_name, def) => {
    const rows = def.readLocal();
    def.writeLocal(rows);
    const again = def.readLocal();
    expect([...again.entries()].map(([id, r]) => [id, rowHash(r)])).toEqual([...rows.entries()].map(([id, r]) => [id, rowHash(r)]));
  });

  it('keeps the share count and the folder order on this device', () => {
    const routes = SYNC_COLLECTIONS.find((d) => d.name === 'routes')!;
    routes.writeLocal(routes.readLocal());
    expect(localCourses.read().find((c) => c.id === 'c1')?.shareCount).toBe(3);
    expect(loadRouteFolders()).toMatchObject({ assign: { c1: 'f1' }, order: ['c2', 'c1'] });
  });

  it('checks server rows like stored data', () => {
    const [cats, pins, folders, routes, days] = SYNC_COLLECTIONS;
    expect(cats.fromRemote({ id: 'x', name: 'n', icon: 'nope', color: '1', position: 0 })).toBeNull();
    expect(cats.fromRemote({ id: 'x', name: 'n', icon: 'cafe', color: '3', position: 2 })).toMatchObject({ color: '3' });
    expect(pins.fromRemote({ id: 'x', category_id: 'c', place: { name: 'a', center: ['x', 1] } })).toBeNull();
    expect(folders.fromRemote({ id: 'f', name: '아주아주아주아주긴폴더이름이다', icon: '💣' })).toMatchObject({ name: '아주아주아주아주긴폴더이', icon: '📁' });
    expect(routes.fromRemote({ id: 'r', title: 't', stops: 'nope' })).toBeNull();
    const route = routes.fromRemote({ id: 'r', title: 't', theme: 'evil', stops: [{ place: { id: 'p', name: 'n', center: [1, 2] } }, { place: { name: 'no id' } }] });
    expect(route).toMatchObject({ theme: 'etc', stops: [{ place: { id: 'p' } }] });
    expect(days.fromRemote({ day: '2026-10-03', decor: {}, looks: { shapes: { '2026-10-04|x': 'star' } } })).toBeNull();
    expect(days.fromRemote({ day: 'drop table', decor: {} })).toBeNull();
  });

  it('writes pins under this device id, whatever the server row says', () => {
    const pins = SYNC_COLLECTIONS.find((d) => d.name === 'pins')!;
    const rows = pins.readLocal();
    window.localStorage.setItem('goodroot:anonymous-user-id', 'other-device');
    pins.writeLocal(rows);
    expect(readStoredPins().every((p) => p.userId === 'other-device')).toBe(true);
    expect(readStoredCategories()).toHaveLength(2);
    expect(loadDays().decor['2026-10-03']?.theme).toBe('sky');
  });
});

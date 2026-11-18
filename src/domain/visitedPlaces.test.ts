import { describe, expect, it } from 'vitest';
import type { StoredPing } from './dayPings';
import { dayPingOfPlace, placePhotos, visitedPlaces } from './visitedPlaces';
import type { Pin } from '../types/pin';

const ping = (id: string, name: string, center: [number, number], at: string, extra: Partial<StoredPing> = {}): StoredPing => ({
  id,
  day: at.slice(0, 10),
  at,
  name,
  center,
  ...extra,
});

const pin = (id: string, name: string, center: [number, number]): Pin => ({
  id,
  userId: 'me',
  createdAt: '2026-11-01T00:00:00.000Z',
  categoryId: 'cafe',
  place: { id: `place-${id}`, name, center },
});

const CAFE: [number, number] = [126.97, 37.57];
const NEAR_CAFE: [number, number] = [126.9702, 37.5701];
const PARK: [number, number] = [126.99, 37.58];

describe('visitedPlaces', () => {
  it('pins each place I pinged once, as 미분류 to be', () => {
    const pings = [
      ping('a', '서촌 카페', CAFE, '2026-11-01T01:00:00.000Z'),
      ping('b', '서촌 카페', NEAR_CAFE, '2026-11-02T01:00:00.000Z'),
      ping('c', '공원', PARK, '2026-11-02T02:00:00.000Z', { address: '서울 종로구' }),
    ];
    const { places, settled } = visitedPlaces(pings, [], new Set());
    expect(places.map((p) => [p.id, p.name])).toEqual([
      ['visit:a', '서촌 카페'],
      ['visit:c', '공원'],
    ]);
    expect(places[1].address).toBe('서울 종로구');
    expect(settled).toEqual(['a', 'b', 'c']);
  });

  it('leaves places that are pins already, pings already looked at and 제외 주소 pings', () => {
    const pings = [
      ping('a', '서촌 카페', CAFE, '2026-11-01T01:00:00.000Z'),
      ping('b', '집 앞', PARK, '2026-11-01T02:00:00.000Z', { local: true }),
      ping('c', '어딘가', [127.01, 37.6], '2026-11-01T03:00:00.000Z', { pinId: 'p2' }),
      ping('d', '공원', PARK, '2026-11-01T04:00:00.000Z'),
    ];
    const pins = [pin('p1', '서촌 카페', NEAR_CAFE), pin('p2', '다른 이름', [127.01, 37.6])];
    const { places, settled } = visitedPlaces(pings, pins, new Set(['d']));
    expect(places).toEqual([]);
    expect(settled).toEqual(['a', 'b', 'c']);
  });
});

describe('placePhotos', () => {
  const pings = [
    ping('old', '서촌 카페', CAFE, '2026-11-01T01:00:00.000Z'),
    ping('new', '서촌 카페', NEAR_CAFE, '2026-11-03T01:00:00.000Z'),
    ping('pinned', '다른 이름', PARK, '2026-11-02T01:00:00.000Z', { pinId: 'p1' }),
    ping('nophoto', '서촌 카페', CAFE, '2026-11-04T01:00:00.000Z'),
    ping('elsewhere', '공원', PARK, '2026-11-05T01:00:00.000Z'),
  ];
  const one = (id: string, src: string) => [{ id, src }];
  const photos = { old: one('old', 'data:o'), new: one('new', 'data:n'), pinned: one('pinned', 'data:p'), elsewhere: one('elsewhere', 'data:e') };

  it("are the place's photos, newest first", () => {
    const got = placePhotos({ id: 'place-p1', name: '서촌 카페', center: CAFE }, 'p1', pings, photos);
    expect(got.map((p) => p.id)).toEqual(['new', 'pinned', 'old']);
    expect(got[0].url).toBe('data:n');
  });

  it('list every photo stacked on a ping, each by when it was taken', () => {
    const stacked = { ...photos, new: [{ id: 'new', src: 'data:n' }, { id: 'new~2', src: 'data:n2', at: '2026-11-03T05:00:00.000Z' }] };
    const got = placePhotos({ id: 'place-p1', name: '서촌 카페', center: CAFE }, 'p1', pings, stacked);
    expect(got.map((p) => p.id)).toEqual(['new~2', 'new', 'pinned', 'old']);
  });

  it('keep the visit a pin was made from through a rename', () => {
    const got = placePhotos({ id: 'visit:old', name: '내 카페', center: CAFE }, 'p9', pings, photos);
    expect(got.map((p) => p.id)).toEqual(['old']);
  });

  it('a pin made from a ping keeps what kind of place it was', () => {
    const { places } = visitedPlaces([ping('k', '내 카페', CAFE, '2026-11-04T10:00:00.000Z', { kind: 'cafe' })], [], new Set());
    expect(places[0].kind).toBe('cafe');
  });
});

describe('dayPingOfPlace', () => {
  const DAY = '2026-11-19';
  // 직접 입력 '숑숑' pinged without a pin, then pinned as 미분류 from that visit.
  const typed = ping('t1', '숑숑', CAFE, `${DAY}T03:00:00.000Z`);
  const visitPin: Pin = { ...pin('v', '숑숑', CAFE), place: { id: 'visit:t1', name: '숑숑', center: CAFE } };

  it("finds the typed place's ping when the next shot picks the pin its visit made", () => {
    expect(dayPingOfPlace(DAY, visitPin.place, visitPin.id, [typed])?.id).toBe('t1');
  });

  it('still finds it after that pin is renamed, by the visit it came from', () => {
    const renamed = { ...visitPin.place, name: '숑숑 카페' };
    expect(dayPingOfPlace(DAY, renamed, visitPin.id, [typed])?.id).toBe('t1');
  });

  it("finds a pin's own ping, and the same place by name within 50m", () => {
    const fromPin = ping('p', '서촌 카페', PARK, `${DAY}T01:00:00.000Z`, { pinId: 'p1' });
    expect(dayPingOfPlace(DAY, { id: 'x', name: '다른 이름', center: PARK }, 'p1', [fromPin])?.id).toBe('p');
    expect(dayPingOfPlace(DAY, { id: 'around', name: '숑숑', center: NEAR_CAFE }, null, [typed])?.id).toBe('t1');
  });

  it('leaves other days, other names and places farther than 50m', () => {
    const yesterday = ping('y', '숑숑', CAFE, '2026-11-18T03:00:00.000Z');
    expect(dayPingOfPlace(DAY, visitPin.place, null, [yesterday])).toBeNull();
    expect(dayPingOfPlace(DAY, { id: 'a', name: '다른 곳', center: CAFE }, null, [typed])).toBeNull();
    expect(dayPingOfPlace(DAY, { id: 'b', name: '숑숑', center: PARK }, null, [typed])).toBeNull();
  });
});

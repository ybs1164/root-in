import { describe, expect, it } from 'vitest';
import type { StoredPing } from './dayPings';
import { placePhotos, visitedPlaces } from './visitedPlaces';
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
  const photos = { old: 'data:o', new: 'data:n', pinned: 'data:p', elsewhere: 'data:e' };

  it("are the place's photos, newest first", () => {
    const got = placePhotos({ id: 'place-p1', name: '서촌 카페', center: CAFE }, 'p1', pings, photos);
    expect(got.map((p) => p.id)).toEqual(['new', 'pinned', 'old']);
    expect(got[0].url).toBe('data:n');
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

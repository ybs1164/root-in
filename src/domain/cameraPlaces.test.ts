import { describe, expect, it } from 'vitest';
import type { PlaceRef } from '../types/course';
import { cameraPlaces, CAMERA_PLACE_LIMIT, HERE_NAME } from './cameraPlaces';
import type { ExcludedPlace } from './privacy';

const here: [number, number] = [127.0582, 37.5447];
// ~11m per 0.0001° of latitude here.
const at = (id: string, name: string, dLat: number, address?: string): PlaceRef => ({
  id,
  name,
  center: [here[0], here[1] + dLat],
  ...(address ? { address } : {}),
});

describe('cameraPlaces (where a camera shot says it was taken)', () => {
  it('puts the spot itself first, then my pins within 50m, then places around, each nearest first', () => {
    const spot = at('pin:spot', '성수동1가 656', 0.00001);
    const pins = [{ place: at('kakao:2', '먼 핀', 0.003) }, { place: at('kakao:3', '내 카페', 0.0003) }, { place: at('kakao:4', '가까운 핀', 0.0001) }];
    const around = [at('kakao:6', '식당', 0.0008), at('kakao:5', '어니언', 0.0005)];
    const places = cameraPlaces(here, spot, pins, around, []);
    expect(places.map((p) => p.name)).toEqual(['성수동1가 656', '가까운 핀', '내 카페', '어니언', '식당']);
    // The spot is exactly where I am, not where reverse geocoding put it.
    expect(places[0].center).toEqual(here);
  });

  it('names the spot 현재 위치 when nothing was found', () => {
    expect(cameraPlaces(here, null, [], [], [])[0]).toMatchObject({ name: HERE_NAME, center: here });
  });

  it('lists a place once, by id or by name', () => {
    const cafe = at('kakao:1', '어니언', 0.0002);
    const places = cameraPlaces(here, null, [{ place: cafe }], [cafe, at('kakao:9', '어니언', 0.0002)], []);
    expect(places.map((p) => p.name)).toEqual([HERE_NAME, '어니언']);
  });

  it('leaves out places near a 제외 주소', () => {
    const home: ExcludedPlace = { id: 'home', kind: 'home', address: '성수이로 88', center: [here[0], here[1] + 0.01] };
    const near = at('kakao:1', '집 앞 카페', 0.0101);
    const byAddress = at('kakao:2', '같은 건물', 0.0004, '서울 성동구 성수이로 88');
    expect(cameraPlaces(here, null, [], [near, byAddress, at('kakao:3', '어니언', 0.0005)], [home]).map((p) => p.name)).toEqual([
      HERE_NAME,
      '어니언',
    ]);
  });

  it('offers at most CAMERA_PLACE_LIMIT', () => {
    const around = Array.from({ length: 20 }, (_, i) => at(`kakao:${i}`, `곳 ${i}`, 0.0001 * (i + 1)));
    expect(cameraPlaces(here, null, [], around, [])).toHaveLength(CAMERA_PLACE_LIMIT);
  });
});

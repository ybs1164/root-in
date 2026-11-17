import { describe, expect, it } from 'vitest';
import type { PlaceRef } from '../types/course';
import { cameraPlaces, CAMERA_PLACE_LIMIT, firstCameraPlace, HERE_NAME, TYPED_PLACE_MAX, typedCameraPlace } from './cameraPlaces';
import type { StoredPing } from './dayPings';
import type { ExcludedPlace } from './privacy';

const here: [number, number] = [127.0582, 37.5447];
// ~11m per 0.0001° of latitude here.
const at = (id: string, name: string, dLat: number, address?: string): PlaceRef => ({
  id,
  name,
  center: [here[0], here[1] + dLat],
  ...(address ? { address } : {}),
});

const ping = (id: string, name: string, dLat: number, more: Partial<StoredPing> = {}): StoredPing => ({
  id,
  day: '2026-11-01',
  at: '2026-11-01T03:00:00.000Z',
  name,
  center: [here[0], here[1] + dLat],
  ...more,
});
const names = (places: PlaceRef[]) => places.map((p) => p.name);

describe('cameraPlaces (where a camera shot says it was taken)', () => {
  it('puts the spot itself first, then my pins within 50m, then places around, each nearest first', () => {
    const spot = at('pin:spot', '성수동1가 656', 0.00001);
    const pins = [{ place: at('kakao:2', '먼 핀', 0.003) }, { place: at('kakao:3', '내 카페', 0.0003) }, { place: at('kakao:4', '가까운 핀', 0.0001) }];
    const around = [at('kakao:6', '식당', 0.0008), at('kakao:5', '어니언', 0.0005)];
    const places = cameraPlaces(here, spot, pins, around, []);
    expect(places.visited).toEqual([]);
    expect(names(places.others)).toEqual(['성수동1가 656', '가까운 핀', '내 카페', '어니언', '식당']);
    // The spot is exactly where I am, not where reverse geocoding put it.
    expect(places.others[0].center).toEqual(here);
    expect(places.here).toBe(places.others[0]);
  });

  it('names the spot 현재 위치 when nothing was found', () => {
    expect(cameraPlaces(here, null, [], [], []).others[0]).toMatchObject({ name: HERE_NAME, center: here });
  });

  it('lists a place once, by id or by name', () => {
    const cafe = at('kakao:1', '어니언', 0.0002);
    const places = cameraPlaces(here, null, [{ place: cafe }], [cafe, at('kakao:9', '어니언', 0.0002)], []);
    expect(names(places.others)).toEqual([HERE_NAME, '어니언']);
  });

  it('leaves out places near a 제외 주소', () => {
    const home: ExcludedPlace = { id: 'home', kind: 'home', address: '성수이로 88', center: [here[0], here[1] + 0.01] };
    const near = at('kakao:1', '집 앞 카페', 0.0101);
    const byAddress = at('kakao:2', '같은 건물', 0.0004, '서울 성동구 성수이로 88');
    expect(names(cameraPlaces(here, null, [], [near, byAddress, at('kakao:3', '어니언', 0.0005)], [home]).others)).toEqual([HERE_NAME, '어니언']);
  });

  it('offers at most CAMERA_PLACE_LIMIT', () => {
    const around = Array.from({ length: 20 }, (_, i) => at(`kakao:${i}`, `곳 ${i}`, 0.0001 * (i + 1)));
    expect(cameraPlaces(here, null, [], around, []).others).toHaveLength(CAMERA_PLACE_LIMIT);
  });
});

describe('cameraPlaces: 방문한 적 있는 장소 on top', () => {
  const around = [at('kakao:5', '어니언', 0.0005), at('kakao:6', '식당', 0.0008)];
  // The 미분류 pins my earlier pings made (`visitedPlaces`).
  const hall = { id: 'pin-hall', place: at('visit:p1', '정보과학관', 0.0002) };
  const diner = { id: 'pin-diner', place: at('visit:p2', '나만아는맛집', 0.0004) };
  const pings = [ping('p1', '정보과학관', 0.0002), ping('p2', '나만아는맛집', 0.0004)];

  it('example 1: a place I visited, shot within 50m of it — it alone on top, picked to start with', () => {
    const places = cameraPlaces(here, null, [hall], around, [], [pings[0]]);
    expect(names(places.visited)).toEqual(['정보과학관']);
    expect(names(places.others)).toEqual([HERE_NAME, '어니언', '식당']);
    expect(firstCameraPlace(places)?.name).toBe('정보과학관');
  });

  it('example 2: nowhere visited — no group, the spot itself picked to start with', () => {
    const places = cameraPlaces(here, null, [], around, [], []);
    expect(places.visited).toEqual([]);
    expect(names(places.others)).toEqual([HERE_NAME, '어니언', '식당']);
    expect(firstCameraPlace(places)).toBe(places.here);
  });

  it('example 3: two visited places near — both on top, the nearer first', () => {
    const places = cameraPlaces(here, null, [diner, hall], around, [], pings);
    expect(names(places.visited)).toEqual(['정보과학관', '나만아는맛집']);
    expect(names(places.others)).toEqual([HERE_NAME, '어니언', '식당']);
  });

  it('counts a pin of my own that I pinged from, not one I only dropped', () => {
    const mine = { id: 'pin-1', place: at('kakao:3', '내 카페', 0.0003) };
    const dropped = { id: 'pin-2', place: at('kakao:4', '가볼 곳', 0.0001) };
    const places = cameraPlaces(here, null, [mine, dropped], [], [], [ping('p9', '옛 이름', 0.0003, { pinId: 'pin-1' })]);
    expect(names(places.visited)).toEqual(['내 카페']);
    expect(names(places.others)).toEqual([HERE_NAME, '가볼 곳']);
  });

  it('keeps a visit whose pin was deleted, and a renamed visit pin under its new name', () => {
    const renamed = { id: 'pin-hall', place: at('visit:p1', '우리 과 건물', 0.0002) };
    const places = cameraPlaces(here, null, [renamed], [], [], pings);
    expect(places.visited.map((p) => [p.id, p.name])).toEqual([
      ['visit:p1', '우리 과 건물'],
      ['visit:p2', '나만아는맛집'],
    ]);
  });

  it('never repeats a visited place below, and leaves out far, 제외 주소 and local visits', () => {
    const home: ExcludedPlace = { id: 'home', kind: 'home', address: '성수이로 88', center: [here[0], here[1] + 0.01] };
    const places = cameraPlaces(
      here,
      at('pin:spot', '정보과학관', 0),
      [hall],
      [at('kakao:7', '정보과학관', 0.0002)],
      [home],
      [pings[0], ping('p3', '먼 곳', 0.003), ping('p4', '집 근처', 0.0001, { local: true }), ping('p5', '같은 건물', 0.0003, { address: '서울 성동구 성수이로 88' })],
    );
    expect(names(places.visited)).toEqual(['정보과학관']);
    expect(places.others).toEqual([]);
    // 직접 입력 still has the spot to land on.
    expect(places.here?.center).toEqual(here);
  });

  it('keeps a slot for the spot however many places I have been to', () => {
    const many = Array.from({ length: 15 }, (_, i) => ping(`m${i}`, `곳 ${i}`, 0.00002 * (i + 1)));
    const places = cameraPlaces(here, null, [], [], [], many);
    expect(places.visited).toHaveLength(CAMERA_PLACE_LIMIT - 1);
    expect(names(places.others)).toEqual([HERE_NAME]);
  });
});

describe('typedCameraPlace', () => {
  const spot = { id: 'here:127,37.5', name: '서울 종로구 세종대로 172', center: [127, 37.5] as [number, number], address: '서울 종로구 세종대로 172' };
  it('names the spot I am on by hand, keeping its nearest address', () => {
    expect(typedCameraPlace(spot, '  우리 집 앞 벤치 ')).toEqual({ id: 'typed:127,37.5', name: '우리 집 앞 벤치', center: [127, 37.5], address: '서울 종로구 세종대로 172' });
  });
  it('is nothing while the name is blank, and caps a long one', () => {
    expect(typedCameraPlace(spot, '  ')).toBeNull();
    expect(typedCameraPlace(spot, '가'.repeat(60))?.name).toHaveLength(TYPED_PLACE_MAX);
    expect(typedCameraPlace({ ...spot, address: undefined }, '벤치')).not.toHaveProperty('address');
  });
});

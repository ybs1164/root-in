import { describe, expect, it, vi } from 'vitest';
import type { KakaoMapsNamespace, KakaoPlaceResult } from '../../lib/kakaoSdk';
import { KakaoPlaceSearch } from './kakaoPlaceSearch';
import { PhotonPlaceSearch } from './photonPlaceSearch';

const kakaoResult = (overrides: Partial<KakaoPlaceResult> = {}): KakaoPlaceResult => ({
  id: '12345',
  place_name: '어니언 성수',
  category_name: '음식점 > 카페 > 베이커리카페',
  category_group_name: '카페',
  road_address_name: '서울 성동구 아차산로9길 8',
  address_name: '서울 성동구 성수동2가 277-135',
  x: '127.0582',
  y: '37.5447',
  ...overrides,
});

// A stand-in for the SDK: only what KakaoPlaceSearch touches.
const fakeKakao = (respond: (query: string) => [KakaoPlaceResult[], string]) => {
  const keywordSearch = vi.fn((query: string, cb: (d: KakaoPlaceResult[], s: string) => void, _options?: unknown) => {
    const [data, status] = respond(query);
    cb(data, status);
  });
  const maps = {
    LatLng: class {
      constructor(
        public lat: number,
        public lng: number,
      ) {}
    },
    services: {
      Places: class {
        keywordSearch = keywordSearch;
      },
      Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
    },
  } as unknown as KakaoMapsNamespace;
  return { maps, keywordSearch };
};

describe('KakaoPlaceSearch', () => {
  it('maps results to PlaceRef with kakao ids, short category and road address', async () => {
    const { maps } = fakeKakao(() => [[kakaoResult()], 'OK']);
    expect(await new KakaoPlaceSearch(maps).search('성수 카페')).toEqual([
      {
        id: 'kakao:12345',
        name: '어니언 성수',
        center: [127.0582, 37.5447],
        category: '베이커리카페',
        address: '서울 성동구 아차산로9길 8',
      },
    ]);
  });

  it('passes the map center as location bias', async () => {
    const { maps, keywordSearch } = fakeKakao(() => [[], 'ZERO_RESULT']);
    await new KakaoPlaceSearch(maps).search('카페', { near: [127, 37.5] });
    expect(keywordSearch.mock.calls[0][2]).toMatchObject({ location: { lat: 37.5, lng: 127 } });
  });

  it('resolves [] on error status, bad rows, or an SDK throw', async () => {
    expect(await new KakaoPlaceSearch(fakeKakao(() => [[], 'ERROR']).maps).search('x')).toEqual([]);
    expect(await new KakaoPlaceSearch(fakeKakao(() => [[kakaoResult({ x: 'nope' })], 'OK']).maps).search('x')).toEqual([]);
    const throwing = fakeKakao(() => {
      throw new Error('boom');
    });
    expect(await new KakaoPlaceSearch(throwing.maps).search('x')).toEqual([]);
  });
});

describe('PhotonPlaceSearch', () => {
  const feature = {
    geometry: { coordinates: [127.0374, 37.5444] },
    properties: { osm_type: 'W', osm_id: 42, name: '서울숲', osm_value: 'park', city: '서울', district: '성동구' },
  };

  it('maps features and sends the location bias', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ features: [feature, { properties: {} }] })));
    vi.stubGlobal('fetch', fetchMock);
    const results = await new PhotonPlaceSearch().search('서울숲', { near: [127, 37.5] });
    expect(results).toEqual([
      { id: 'osm:W42', name: '서울숲', center: [127.0374, 37.5444], category: 'park', address: '서울 성동구' },
    ]);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('lat')).toBe('37.5');
    expect(url.searchParams.get('lon')).toBe('127');
  });

  it('resolves [] on network error instead of rejecting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(await new PhotonPlaceSearch().search('서울숲')).toEqual([]);
  });
});

describe('reverse lookup and nearby places (pin naming, route-in)', () => {
  const kakaoWith = (geocode: unknown[], status: string, nearby: KakaoPlaceResult[]) =>
    ({
      LatLng: class {
        constructor(
          public lat: number,
          public lng: number,
        ) {}
      },
      services: {
        Places: class {
          keywordSearch() {}
          categorySearch(code: string, cb: (d: KakaoPlaceResult[], s: string) => void) {
            cb(code === 'CE7' ? nearby : [], 'OK');
          }
        },
        Geocoder: class {
          coord2Address(_x: number, _y: number, cb: (r: unknown[], s: string) => void) {
            cb(geocode, status);
          }
        },
        Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
        SortBy: { DISTANCE: 'distance', ACCURACY: 'accuracy' },
      },
    }) as unknown as KakaoMapsNamespace;

  it('Kakao names a dropped pin by its building or address, keeping the dropped point as its id', async () => {
    const maps = kakaoWith([{ road_address: { address_name: '서울 성동구 아차산로9길 8', building_name: '어니언' }, address: null }], 'OK', []);
    expect(await new KakaoPlaceSearch(maps).reverse([127.0582, 37.5447])).toEqual({
      id: 'pin:127.0582,37.5447',
      name: '어니언',
      center: [127.0582, 37.5447],
      address: '서울 성동구 아차산로9길 8',
    });
  });

  it('reverse geocoding failure names the pin "지정한 위치" without rejecting', async () => {
    expect(await new KakaoPlaceSearch(kakaoWith([], 'ERROR', [])).reverse([127, 37.5])).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(await new PhotonPlaceSearch().reverse([127, 37.5])).toBeNull();
    expect(await new PhotonPlaceSearch().nearby([127, 37.5])).toEqual([]);
    // The caller's fallback:
    const { pointPlace } = await import('./placeSearchService');
    expect(pointPlace([127, 37.5]).name).toBe('지정한 위치');
  });

  it('Kakao nearby merges categories, nearest first', async () => {
    const far = kakaoResult({ id: '1', place_name: '먼 카페', x: '127.0600', y: '37.5447' });
    const near = kakaoResult({ id: '2', place_name: '가까운 카페', x: '127.0583', y: '37.5447' });
    const result = await new KakaoPlaceSearch(kakaoWith([], 'OK', [far, near])).nearby([127.0582, 37.5447]);
    expect(result.map((p) => p.name)).toEqual(['가까운 카페', '먼 카페']);
  });

  it('Photon nearby skips roads and far results', async () => {
    const feature = (osm_key: string, name: string, lon: number) => ({
      geometry: { coordinates: [lon, 37.5447] },
      properties: { osm_type: 'N', osm_id: name.length, osm_key, name },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            features: [feature('highway', '아차산로9길', 127.0582), feature('amenity', '어니언', 127.0583), feature('amenity', '먼 곳', 127.07)],
          }),
        ),
      ),
    );
    expect((await new PhotonPlaceSearch().nearby([127.0582, 37.5447])).map((p) => p.name)).toEqual(['어니언']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { pointPlace } from './placeSearch/placeSearchService';
import { parseKindShops, StaticPlaceKindService } from './placeKindService';

const file = { v: 1, k: ['bakery', 'nope', 'salon'], r: [['어니언', 12705820, 3754480, 0], ['미용실', 12705822, 3754472, 2], ['이상한', 12705820, 3754470, 1]] };
const onion = { id: 'kakao:1', name: '어니언 성수', center: [127.0582, 37.5447] as [number, number] };

const service = (areaCode: string | null = '11200') => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(file)));
  vi.stubGlobal('fetch', fetchMock);
  return { svc: new StaticPlaceKindService(async () => areaCode, '/korea/places/'), fetchMock };
};

describe('parseKindShops', () => {
  it('keeps good rows and skips unknown kinds and bad rows', () => {
    const shops = parseKindShops({ ...file, r: [...file.r, ['x', 1.5, 2, 0], [1, 2, 3, 0], 'junk'] });
    expect(shops?.map((s) => s.name)).toEqual(['어니언', '미용실']);
    expect(parseKindShops({ v: 2, k: [], r: [] })).toBeNull();
    expect(parseKindShops(null)).toBeNull();
  });
});

describe('StaticPlaceKindService', () => {
  it("fetches the point's 시군구 file once and matches by name", async () => {
    const { svc, fetchMock } = service();
    expect(await svc.lookup(onion)).toBe('bakery');
    expect(await svc.lookup({ ...onion, id: 'kakao:2' })).toBe('bakery');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/korea/places/11200.json');
  });

  it('a picked spot named only by its address goes by distance', async () => {
    const { svc } = service();
    // Two kinds within 15m: no answer.
    expect(await svc.lookup(pointPlace([127.0582, 37.5447], '서울 성동구 아차산로9길 8', '서울 성동구 아차산로9길 8'))).toBeNull();
    // Right on the salon, with the bakery 9m off but its name not given: still two kinds.
    expect(await svc.lookup(pointPlace([127.05822, 37.54472]))).toBeNull();
    // Named by its building, which is the shop.
    expect(await svc.lookup(pointPlace([127.0582, 37.5447], '어니언'))).toBe('bakery');
  });

  it('gives null, never rejects, on a missing area, file or network', async () => {
    expect(await service(null).svc.lookup(onion)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await new StaticPlaceKindService(async () => '11200').lookup(onion)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(await new StaticPlaceKindService(async () => '11200').lookup(onion)).toBeNull();
    const failing = new StaticPlaceKindService(async () => {
      throw new Error('boom');
    });
    expect(await failing.lookup(onion)).toBeNull();
  });

  it('stops when the card is closed', async () => {
    const { svc } = service();
    const controller = new AbortController();
    controller.abort();
    expect(await svc.lookup(onion, controller.signal)).toBeNull();
  });
});

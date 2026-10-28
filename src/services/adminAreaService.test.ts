import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAreas, StaticAdminAreaService } from './adminAreaService';

const area = (code: string, west: number, south: number, size: number) => ({
  code, name: `area${code}`, bbox: [west, south, west + size, south + size],
  rings: [[[[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]]]],
});
const files: Record<string, unknown> = {
  '/korea/admin/sido.json': { version: 1, areas: [area('11', 126.8, 37.4, 0.4), area('41', 127.2, 37.4, 0.4)] },
  '/korea/admin/sgg/11.json': [area('11110', 126.8, 37.4, 0.2), area('11140', 127, 37.4, 0.2)],
  '/korea/admin/sgg/41.json': [area('41110', 127.2, 37.4, 0.2)],
  '/korea/admin/dong/11140.json': [area('1114051000', 127, 37.4, 0.1), area('1114052000', 127.1, 37.4, 0.1)],
  '/korea/admin/dong/11110.json': [area('1111051000', 126.9, 37.4, 0.1)],
  // Road-cut files below 읍면동: still on the server, never read (M9).
  '/korea/admin/section/11140.json': [
    area('1114051000-0', 127, 37.4, 0.05), area('1114051000-1', 127.05, 37.4, 0.05), area('1114052000-0', 127.1, 37.4, 0.1),
  ],
  // Blocks only for 1114051000 (1114052000 has no file); footways split block 0-0 only.
  '/korea/admin/block/11140/1114051000.json': [area('1114051000-0-0', 127, 37.4, 0.025), area('1114051000-0-1', 127.025, 37.4, 0.025)],
  '/korea/admin/walk/11140/1114051000.json': [area('1114051000-0-0-0', 127, 37.4, 0.0125), area('1114051000-0-0-1', 127.0125, 37.4, 0.0125)],
  // Roads cut the first walk piece in two; the others have no road pieces.
  '/korea/admin/road/11140/1114051000.json': [area('1114051000-0-0-0-0', 127, 37.4, 0.006), area('1114051000-0-0-0-1', 127.006, 37.4, 0.006)],
};
const stubFiles = (data = files) => {
  const fetcher = vi.fn(async (url: string) => (url in data
    ? { ok: true, json: async () => data[url] }
    : { ok: false, json: async () => null }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
afterEach(() => vi.unstubAllGlobals());

describe('administrative area files', () => {
  it('loads all nearby districts across province borders without fetching dong files', async () => {
    const fetcher = stubFiles();
    const districts = await new StaticAdminAreaService().sggAreasInBounds({ west: 127.04, south: 37.4, east: 127.3, north: 37.6 });
    expect(districts.map((a) => a.code).sort()).toEqual(['11140', '41110']);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/dong/'))).toBe(false);
  });
  it('splits areas at the viewport edges too, including across a 시도 border', async () => {
    const fetcher = stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.04, south: 37.45, east: 127.15, north: 37.55 }, widthPx: 375 });
    expect(map?.focus.code).toBe('11140');
    expect(map?.parts.map((a) => a.code).sort()).toEqual(['1111051000', '1114051000', '1114052000', '41110']);
    expect(map?.others).toEqual([]);
    expect(fetcher.mock.calls.map(([url]) => url)).toContain('/korea/admin/dong/11110.json');
  });

  it('splits every visible 시도 into 시군구 when zoomed out', async () => {
    stubFiles();
    // The entire viewport and a margin are included.
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 126, south: 37, east: 128, north: 38 }, widthPx: 375 });
    expect(map?.focus.code).toBe('11');
    expect(map?.alsoFocus?.map((f) => f.code)).toEqual(['41']);
    expect(map?.parts.map((a) => a.code).sort()).toEqual(['11110', '11140', '41110']);
    expect(map?.others).toEqual([]);
  });

  it('draws more than four visible districts without leaving edge areas blank', async () => {
    const districts = Array.from({ length: 6 }, (_, i) => area(`1111${i}`, 127 + i * 0.05, 37.4, 0.04));
    const data: Record<string, unknown> = {
      '/korea/admin/sido.json': { areas: [area('11', 126.5, 37.3, 1)] },
      '/korea/admin/sgg/11.json': districts,
    };
    for (const [i, district] of districts.entries()) {
      data[`/korea/admin/dong/${district.code}.json`] = [area(`${district.code}51000`, 127 + i * 0.05, 37.4, 0.04)];
    }
    stubFiles(data);
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127, south: 37.4, east: 127.3, north: 37.44 }, widthPx: 375 });
    expect(map?.parts.map((a) => a.code).sort()).toEqual(districts.map((a) => `${a.code}51000`).sort());
    expect(map?.alsoFocus).toHaveLength(5);
    expect(map?.others).toEqual([]);
  });

  it('keeps a parent shape visible when its child data cannot be loaded', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.23, south: 37.43, east: 127.28, north: 37.48 }, widthPx: 375 });
    expect(map?.parts.map((a) => a.code)).toContain('41110');
  });

  it('splits only the 시도 under a narrow range', async () => {
    stubFiles();
    const range = { west: 126.9, south: 37.5, east: 127, north: 37.6 };
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 126, south: 37, east: 128, north: 38 }, widthPx: 375 }, range);
    expect(map?.focus.code).toBe('11');
    expect(map?.alsoFocus).toEqual([]);
    expect(map?.parts.map((a) => a.code)).toEqual(['11110', '11140']);
    expect(map?.others.map((a) => a.code)).toEqual(['41']);
  });

  /** A 375px-wide screen at `mpp` meters per pixel around a point. */
  const screenAt = (lon: number, lat: number, mpp: number) => {
    const half = (375 * mpp) / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
    return { bounds: { west: lon - half, east: lon + half, south: lat - half, north: lat + half }, widthPx: 375 };
  };

  it('stays at 읍면동 however close in, and never reads the road-cut files', async () => {
    for (const mpp of [3, 1.5, 0.5, 0.2]) {
      const fetcher = stubFiles();
      const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.012, 37.412, mpp));
      expect(map?.focus.code, `${mpp} m/px`).toBe('11140');
      expect(map?.parts.map((a) => a.code)).toEqual(expect.arrayContaining(['1114051000', '1114052000']));
      expect(map?.parts.every((a) => /^\d{10}$/.test(a.code))).toBe(true);
      const urls = fetcher.mock.calls.map(([url]) => url as string);
      expect(urls.filter((url) => /\/(section|block|walk|road)\//.test(url))).toEqual([]);
    }
  });

  it('resolves to null instead of rejecting when files are missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127, south: 37, east: 127.1, north: 37.1 }, widthPx: 375 })).resolves.toBeNull();
  });

  it('rejects malformed or out-of-range data', () => {
    expect(parseAreas([area('11', 126, 37, 1)])).toHaveLength(1);
    expect(parseAreas([{ ...area('11', 126, 37, 1), name: 'x'.repeat(100) }])).toBeNull();
    expect(parseAreas([area('11', 10, 37, 1)])).toBeNull();
    expect(parseAreas([{ ...area('11', 126, 37, 1), code: '<b>' }])).toBeNull();
    expect(parseAreas({})).toBeNull();
    expect(parseAreas([area('1114051000-12', 126, 37, 1)])).toHaveLength(1);
    expect(parseAreas([area('1114051000-12-3-4', 126, 37, 1)])).toHaveLength(1);
    expect(parseAreas([area('1114051000-1-2-3-4', 126, 37, 1)])).toHaveLength(1);
    expect(parseAreas([area('1114051000-1-2-3-4-5', 126, 37, 1)])).toBeNull();
  });
});

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
  '/korea/admin/section/11140.json': [
    area('1114051000-0', 127, 37.4, 0.05), area('1114051000-1', 127.05, 37.4, 0.05), area('1114052000-0', 127.1, 37.4, 0.1),
  ],
  // Blocks only for 1114051000 (1114052000 has no file); footways split block 0-0 only.
  '/korea/admin/block/11140/1114051000.json': [area('1114051000-0-0', 127, 37.4, 0.025), area('1114051000-0-1', 127.025, 37.4, 0.025)],
  '/korea/admin/walk/11140/1114051000.json': [area('1114051000-0-0-0', 127, 37.4, 0.0125), area('1114051000-0-0-1', 127.0125, 37.4, 0.0125)],
  // Roads cut the first walk piece in two; the others have no road pieces.
  '/korea/admin/road/11140/1114051000.json': [area('1114051000-0-0-0-0', 127, 37.4, 0.006), area('1114051000-0-0-0-1', 127.006, 37.4, 0.006)],
};
const stubFiles = () => {
  const fetcher = vi.fn(async (url: string) => (url in files
    ? { ok: true, json: async () => files[url] }
    : { ok: false, json: async () => null }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
afterEach(() => vi.unstubAllGlobals());

describe('administrative area files', () => {
  it('splits the 시군구 at the center into 읍면동 and keeps neighbors whole', async () => {
    const fetcher = stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.04, south: 37.45, east: 127.15, north: 37.55 }, widthPx: 375 });
    expect(map?.focus.code).toBe('11140');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000', '1114052000']);
    // Neighbors across the 시도 border too, but never the focus itself.
    expect(map?.others.map((a) => a.code).sort()).toEqual(['11110', '41110']);
    expect(fetcher.mock.calls.map(([url]) => url)).not.toContain('/korea/admin/dong/11110.json');
  });

  it('splits every 시도 reaching into the center range into 시군구 when zoomed out', async () => {
    stubFiles();
    // The default range (the middle 40% of 126..128) reaches into 경기 too.
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 126, south: 37, east: 128, north: 38 }, widthPx: 375 });
    expect(map?.focus.code).toBe('11');
    expect(map?.alsoFocus?.map((f) => f.code)).toEqual(['41']);
    expect(map?.parts.map((a) => a.code).sort()).toEqual(['11110', '11140', '41110']);
    expect(map?.others).toEqual([]);
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

  it('splits the 읍면동 at the center into sections when zoomed in close', async () => {
    stubFiles();
    // About 3 m/px on a 375px screen.
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.085, south: 37.44, east: 127.098, north: 37.46 }, widthPx: 375 });
    expect(map?.focus.code).toBe('1114051000');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0', '1114051000-1']);
    // The next 읍면동 just across the edge stays whole; far ones are left out.
    expect(map?.others.map((a) => a.code)).toEqual(['1114052000']);
  });

  /** A 375px-wide screen at `mpp` meters per pixel around a point. */
  const screenAt = (lon: number, lat: number, mpp: number) => {
    const half = (375 * mpp) / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
    return { bounds: { west: lon - half, east: lon + half, south: lat - half, north: lat + half }, widthPx: 375 };
  };

  it('splits the section at the center into blocks below 2 m/px', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.012, 37.412, 1.5));
    expect(map?.focus).toEqual({ code: '1114051000-0', name: 'area1114051000-0' });
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0-0', '1114051000-0-1']);
    // The focused 읍면동 itself is never drawn whole underneath.
    expect(map?.others.map((a) => a.code)).not.toContain('1114051000');
  });

  it('draws a section without block files whole', async () => {
    const fetcher = stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.15, 37.45, 1.5));
    expect(map?.focus.code).toBe('1114052000-0');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114052000-0']);
    expect(fetcher.mock.calls.map(([url]) => url)).toContain('/korea/admin/block/11140/1114052000.json');
  });

  it('splits the block at the center by footways below 0.7 m/px', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.012, 37.412, 0.5));
    expect(map?.focus.code).toBe('1114051000-0-0');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0-0-0', '1114051000-0-0-1']);
  });

  it('keeps the section-level drawing where footways split no focused block', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.037, 37.412, 0.5));
    expect(map?.focus.code).toBe('1114051000-0');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0-0', '1114051000-0-1']);
  });

  it('cuts the piece at the center by every road below 0.3 m/px', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.003, 37.403, 0.2));
    expect(map?.focus.code).toBe('1114051000-0-0-0');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0-0-0-0', '1114051000-0-0-0-1']);
    // The piece itself is never drawn whole underneath.
    expect(map?.others.map((a) => a.code)).not.toContain('1114051000-0-0-0');
  });

  it('keeps the walk-level drawing where no road file exists', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap(screenAt(127.037, 37.412, 0.2));
    expect(map?.focus.code).toBe('1114051000-0');
    expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0-0', '1114051000-0-1']);
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

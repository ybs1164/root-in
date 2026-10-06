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

  it('splits the 시도 at the center into 시군구 when zoomed out', async () => {
    stubFiles();
    const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 126, south: 37, east: 128, north: 38 }, widthPx: 375 });
    expect(map?.focus.code).toBe('11');
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

  it('shows the 읍면동 whole as its one section when its section file is missing', async () => {
    const saved = files['/korea/admin/section/11140.json'];
    delete files['/korea/admin/section/11140.json'];
    try {
      stubFiles();
      const map = await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.085, south: 37.44, east: 127.098, north: 37.46 }, widthPx: 375 });
      expect(map?.focus.code).toBe('1114051000');
      expect(map?.parts.map((a) => a.code)).toEqual(['1114051000-0']);
      expect(map?.parts[0].polygons).toEqual(map && (await new StaticAdminAreaService().fetchAreaMap({ bounds: { west: 127.04, south: 37.45, east: 127.15, north: 37.55 }, widthPx: 375 }))?.parts[0].polygons);
    } finally {
      files['/korea/admin/section/11140.json'] = saved;
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
  });
});

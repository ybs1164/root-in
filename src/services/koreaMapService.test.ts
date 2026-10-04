import { afterEach, describe, expect, it, vi } from 'vitest';
import { roadTierVisible, roadWidthPx } from '../domain/baseMap';
import { koreaMapLevelIndex, parseBaseTile, StaticKoreaMapService, visibleKoreaTiles } from './koreaMapService';

const ring: [number, number][] = [[126, 37], [127, 37], [127, 38], [126, 38], [126, 37]];
const tile = { land: [[ring]], parks: [], roads: [[4, [126.001, 37.001, 126.002, 37.002]], [1, [126.003, 37.003, 126.004, 37.004]]] };
const levels = [
  { name: 'detail', step: .05, tiles: ['2520_740'] },
  { name: 'city', step: .2, tiles: ['630_185'] },
  { name: 'region', step: 1, tiles: ['126_37'] },
  { name: 'country', step: 4, tiles: ['31_9'] },
];
const viewport = { bounds: { west: 126.001, south: 37.001, east: 126.01, north: 37.01 }, widthPx: 375 };
const manifest = { version: 1, levels };
afterEach(() => vi.unstubAllGlobals());

describe('national base map tiles', () => {
  it('omits lower road tiers as the viewport moves through Korean administrative scales', () => {
    const atScale = (mpp: number, widthPx = 375) => ({
      bounds: { west: 0, south: -1, east: mpp * widthPx / 111320, north: 1 }, widthPx,
    });
    for (const [mpp, index] of [[5.9, 0], [6.1, 1], [59.9, 1], [60.1, 2], [249.9, 2], [250.1, 3]]) {
      expect(koreaMapLevelIndex(atScale(mpp))).toBe(index);
      expect(koreaMapLevelIndex(atScale(mpp, 1440))).toBe(index);
    }
  });

  it('falls back to a coarser scale when a wide screen would load too many tiles', async () => {
    const manyTiles = Array.from({ length: 100 }, (_, i) => `${2520 + i % 10}_${740 + Math.floor(i / 10)}`);
    const crowdedManifest = { version: 1, levels: [{ ...levels[0], tiles: manyTiles }, ...levels.slice(1)] };
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('manifest.json') ? crowdedManifest : tile }));
    vi.stubGlobal('fetch', fetcher);
    await new StaticKoreaMapService().fetchBaseMap({ bounds: { west: 126, south: 37, east: 126.5, north: 37.5 }, widthPx: 10000 });
    expect(fetcher.mock.calls.slice(1).map(([url]) => url)).toEqual(['/korea/base/city/630_185.json']);
  });

  it('loads only visible local tiles, draws wide tiers last and reuses tiles after a pan back', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('manifest.json') ? manifest : tile }));
    vi.stubGlobal('fetch', fetcher);
    const service = new StaticKoreaMapService();
    const base = await service.fetchBaseMap(viewport);
    expect(base?.land).toEqual([[ring]]);
    expect(base?.roads.map((r) => r.tier)).toEqual([4, 1]);
    expect(base?.roads[0].path).toEqual([[126.001, 37.001], [126.002, 37.002]]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/korea/base/manifest.json', '/korea/base/detail/2520_740.json']);
    await service.fetchBaseMap(viewport);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the base map at nationwide zoom', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('manifest.json') ? manifest : tile }));
    vi.stubGlobal('fetch', fetcher);
    const result = await new StaticKoreaMapService().fetchBaseMap({ bounds: { west: 124, south: 32, east: 133, north: 40 }, widthPx: 375 });
    expect(result?.land).toHaveLength(1);
    // Streets are omitted at this scale even if a tile carries them.
    expect(result?.roads.map((r) => r.tier)).toEqual([1]);
    expect(fetcher.mock.calls[1][0]).toBe('/korea/base/country/31_9.json');
  });

  it('returns failure for missing assets, rather than pretending the region is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: url.endsWith('manifest.json'), json: async () => manifest })));
    expect(await new StaticKoreaMapService().fetchBaseMap(viewport)).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await new StaticKoreaMapService().fetchBaseMap(viewport)).toBeNull();
  });

  it('does not request ocean-only tiles or aborted/invalid viewports', async () => {
    expect(visibleKoreaTiles(levels[0], { west: 125, south: 32, east: 125.1, north: 32.1 })).toEqual([]);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const service = new StaticKoreaMapService();
    const controller = new AbortController(); controller.abort();
    expect(await service.fetchBaseMap(viewport, controller.signal)).toBeNull();
    expect(await service.fetchBaseMap({ ...viewport, widthPx: 0 })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects malformed tiles and keeps polygon holes', () => {
    expect(parseBaseTile({ ...tile, land: [[[[Infinity, 37]]]] })).toBeNull();
    expect(parseBaseTile({ ...tile, roads: [[9, [126, 37, 126.1, 37.1]]] })).toBeNull();
    expect(parseBaseTile({ ...tile, roads: [[2, [126, 37, 126.1]]] })).toBeNull();
    expect(parseBaseTile({ ...tile, roads: [[2, [126, 37, 126.1, 99]]] })).toBeNull();
    expect(parseBaseTile(null)).toBeNull();
    expect(parseBaseTile({ ...tile, parks: [[ring, ring]] })?.parks[0]).toEqual([ring, ring]);
  });
});

describe('road tier widths', () => {
  it('orders tiers from avenue to footpath at street scale', () => {
    const widths = ([2, 3, 4, 5] as const).map((tier) => roadWidthPx(tier, 1));
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    expect(widths[0] / widths[2]).toBeGreaterThan(2.5);
    // One line per direction: the pair is about one avenue wide.
    expect(roadWidthPx(1, 1) * 2).toBeGreaterThan(widths[0]);
  });

  it('omits narrower tiers first as the map zooms out', () => {
    const shown = (mpp: number) => ([1, 2, 3, 4, 5] as const).filter((tier) => roadTierVisible(tier, mpp));
    expect(shown(1)).toEqual([1, 2, 3, 4, 5]);
    expect(shown(4)).toEqual([1, 2, 3, 4]);
    expect(shown(20)).toEqual([1, 2, 3]);
    expect(shown(100)).toEqual([1, 2]);
    expect(shown(2000)).toEqual([1]);
    expect(roadWidthPx(5, 5)).toBe(0);
    expect(roadWidthPx(4, 5)).toBeGreaterThan(0);
    expect(roadWidthPx(2, 0.05)).toBeLessThanOrEqual(40);
  });
});

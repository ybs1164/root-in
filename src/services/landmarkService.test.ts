import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLandmarks, selectLandmarks } from '../domain/landmarkPlaces';
import { LandmarkService } from './landmarkService';

const view = { bounds: { west: 126.95, south: 37.49, east: 126.97, north: 37.51 }, widthPx: 400 };
const rows = { v: 1, r: [['r1', '숭실대학교', 12695700, 3749650, 'school', '대학교', 0],
  ['w2', '주변 건물', 12695800, 3749750, 'building', '건물', 2]] };
const index = { v: 2, levels: [
  { name: 'overview', step: .25, tiles: ['507_149', '520_140'] },
  { name: 'detail', step: .1, tiles: ['1269_374', '1300_350'] },
] };
afterEach(() => vi.unstubAllGlobals());

describe('orientation landmarks', () => {
  it('validates names, coordinates, identity and kind before creating markers', () => {
    const places = parseLandmarks(rows)!;
    expect(places[0]).toMatchObject({ id: 'landmark:r1', name: '숭실대학교', kind: 'school', category: '대학교', center: [126.957, 37.4965] });
    expect(parseLandmarks({ v: 1, r: [['r2', 'bad', 0, 0, 'school', '학교', 0], ...rows.r] })).toHaveLength(2);
    expect(parseLandmarks({ v: 2, r: [] })).toBeNull();
  });

  it('keeps campuses visible at district scale and adds named buildings when zoomed in', () => {
    const places = parseLandmarks(rows)!;
    expect(selectLandmarks(places, { ...view, widthPx: 100 }).map((p) => p.name)).toEqual(['숭실대학교']);
    expect(selectLandmarks(places, { ...view, widthPx: 800 }).map((p) => p.name)).toEqual(['숭실대학교', '주변 건물']);
    expect(selectLandmarks(places, { ...view, widthPx: 20 })).toEqual([]);
  });

  it('does not let a station at the same broad-scale cell displace the campus', () => {
    const places = parseLandmarks({ v: 1, r: [...rows.r, ['n1', '숭실대입구', 12695700, 3749650, 'station', '역·터미널', 0]] })!;
    expect(selectLandmarks(places, { ...view, widthPx: 100 }).map((p) => p.name)).toEqual(['숭실대학교']);
  });

  it('fetches only intersecting existing tiles and caches them across pans', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('index.json')
      ? index : rows }));
    vi.stubGlobal('fetch', fetcher);
    const service = new LandmarkService('/map-landmarks/');
    expect((await service.fetch(view)).map((p) => p.name)).toEqual(['숭실대학교']);
    await service.fetch(view);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/map-landmarks/index.json', '/map-landmarks/overview/507_149.json']);
    expect((await service.fetch({ ...view, widthPx: 800 })).map((p) => p.name)).toEqual(['숭실대학교', '주변 건물']);
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/map-landmarks/detail/1269_374.json');
  });

  it('retries failed tiles and does not request files at distant scales', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: url.endsWith('index.json'), json: async () => index }));
    vi.stubGlobal('fetch', fetcher);
    const service = new LandmarkService();
    expect(await service.fetch({ ...view, widthPx: 20 })).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await service.fetch(view);
    await service.fetch(view);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

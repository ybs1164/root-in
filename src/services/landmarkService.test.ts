import { afterEach, describe, expect, it, vi } from 'vitest';
import { eligibleLandmarks, landmarkFame, parseLandmarks } from '../domain/landmarkPlaces';
import { selectScene } from '../domain/poiScene';
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
    expect(eligibleLandmarks(places, { ...view, widthPx: 100 }).map((p) => p.name)).toEqual(['숭실대학교']);
    expect(eligibleLandmarks(places, { ...view, widthPx: 800 }).map((p) => p.name)).toEqual(['숭실대학교', '주변 건물']);
    expect(eligibleLandmarks(places, { ...view, widthPx: 20 })).toEqual([]);
  });

  it('reads OSM renown and lets the better known of two same-kind landmarks win', () => {
    const places = parseLandmarks({ v: 1, r: [
      ['n1', '작은역', 12695700, 3749650, 'station', '역·터미널', 0],
      ['n2', '큰역', 12696500, 3750500, 'station', '역·터미널', 0, { areaM2: 50000, f: 70 }],
      ['n3', '나쁜값', 12696000, 3750000, 'station', '역·터미널', 0, { f: 400 }],
    ] })!;
    expect(places.map((p) => p.fame)).toEqual([undefined, 70, undefined]);
    expect(landmarkFame(places[1])).toBeCloseTo(0.835);
    const scene = selectScene(places.map((place) => ({ place, fame: landmarkFame(place) })), view);
    expect(scene.map((p) => p.name)).toEqual(['큰역']);
  });

  it('shows a famous neighbourhood landmark as far out as campuses', () => {
    const places = parseLandmarks({ v: 1, r: [
      ['r1', '궁궐', 12695700, 3749650, 'attraction', '명소', 1, { f: 95 }],
      ['r2', '공원', 12695800, 3749750, 'park', '공원', 1, { f: 30 }],
    ] })!;
    expect(eligibleLandmarks(places, { ...view, widthPx: 100 }).map((p) => p.name)).toEqual(['궁궐']);
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

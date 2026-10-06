import { describe, expect, it, vi } from 'vitest';
import { areaAt, areasInRange, BLOCK_FOCUS_MAX_MPP, ROAD_FOCUS_MAX_MPP, SECTION_FOCUS_MAX_MPP, AreaShapeCache, DONG_FOCUS_MAX_MPP, focusLevel, rectangleBearing, renderAreaDraft, renderAreaMap, SIDO_FOCUS_MIN_MPP, visibleCenter, visibleRange, type AdminArea } from './adminAreas';
import type { MapViewport, Ring } from './districtMap';
import { screenProjection } from './districtRendering';

const square = (code: string, west: number, south: number, size: number): AdminArea => {
  const ring: Ring = [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];
  return { code, name: code, bbox: { west, south, east: west + size, north: south + size }, polygons: [[ring]] };
};
const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.04, north: 37.04 }, widthPx: 400 };

describe('administrative area map', () => {
  it('focuses a 시도 zoomed out, a 시군구 in between and a 읍면동 close up', () => {
    const atScale = (mpp: number): MapViewport => ({ bounds: { west: 127, south: 37, east: 127 + (mpp * 375) / 88_900, north: 37.1 }, widthPx: 375 });
    expect(focusLevel(atScale(SIDO_FOCUS_MIN_MPP * 0.9))).toBe('sgg');
    expect(focusLevel(atScale(SIDO_FOCUS_MIN_MPP * 1.1))).toBe('sido');
    expect(focusLevel(atScale(DONG_FOCUS_MAX_MPP * 1.1))).toBe('sgg');
    expect(focusLevel(atScale(DONG_FOCUS_MAX_MPP * 0.9))).toBe('dong');
    expect(focusLevel(atScale(SECTION_FOCUS_MAX_MPP * 1.1))).toBe('dong');
    expect(focusLevel(atScale(SECTION_FOCUS_MAX_MPP * 0.9))).toBe('section');
    expect(focusLevel(atScale(BLOCK_FOCUS_MAX_MPP * 1.1))).toBe('section');
    expect(focusLevel(atScale(BLOCK_FOCUS_MAX_MPP * 0.9))).toBe('block');
    expect(focusLevel(atScale(ROAD_FOCUS_MAX_MPP * 1.1))).toBe('block');
    expect(focusLevel(atScale(ROAD_FOCUS_MAX_MPP * 0.9))).toBe('road');
  });

  it('picks the area under the center, or the nearest one over water', () => {
    const areas = [square('a', 127, 37, 0.02), square('b', 127.02, 37, 0.02)];
    expect(areaAt(areas, [127.03, 37.01])?.code).toBe('b');
    expect(areaAt(areas, [126.99, 37.01])?.code).toBe('a');
    expect(areaAt([], [127, 37])).toBeNull();
  });

  it('focuses the middle of the map left uncovered by the top sheet', () => {
    const bounds = { west: 127, south: 37, east: 127.1, north: 37.2 };
    const [lon, lat] = visibleCenter(bounds, { width: 375, height: 800 }, { top: 400, right: 40, bottom: 0, left: 40 });
    expect(lon).toBeCloseTo(127.05);
    expect(lat).toBeCloseTo(37.05);
  });

  it('takes the middle part of the uncovered map as the focus range', () => {
    const bounds = { west: 127, south: 37, east: 127.1, north: 37.2 };
    const r = visibleRange(bounds, { width: 375, height: 800 }, { top: 400, right: 40, bottom: 0, left: 40 }, 0.5);
    expect((r.west + r.east) / 2).toBeCloseTo(127.05);
    expect((r.south + r.north) / 2).toBeCloseTo(37.05);
    // Half of the 295px-wide free strip (of 375px over 0.1deg) and of the 400px free height (of 800 over 0.2deg).
    expect(r.east - r.west).toBeCloseTo(0.1 * (295 / 375) * 0.5);
    expect(r.north - r.south).toBeCloseTo(0.2 * 0.5 * 0.5);
  });

  it('finds every area reaching into the range, the middle one first', () => {
    const areas = [square('a', 127, 37, 0.02), square('b', 127.02, 37, 0.02), square('c', 127.04, 37, 0.02)];
    const range = { west: 127.015, east: 127.03, south: 37.005, north: 37.015 };
    expect(areasInRange(areas, range).map((a) => a.code)).toEqual(['b', 'a']);
    expect(areasInRange(areas, { ...range, west: 127.022 }).map((a) => a.code)).toEqual(['b']);
    expect(areasInRange(areas, range, 1).map((a) => a.code)).toEqual(['b']);
    expect(areasInRange([], range)).toEqual([]);
  });

  it('keeps a polygon area straight along its edges, keeps its corners sharp and opens a gap', () => {
    const p = screenProjection(viewport);
    const shapes = renderAreaMap({
      focus: { code: 'f', name: 'f' },
      parts: [square('a', 127.005, 37.005, 0.015), square('b', 127.02, 37.005, 0.015)],
      others: [square('c', 127.005, 37.02, 0.03)],
    }, viewport);
    expect(shapes.parts).toHaveLength(2);
    expect(shapes.others).toHaveLength(1);
    const [a, b] = shapes.parts.map(([outer]) => outer.map(p.project));
    const minX = Math.min(...a.map((q) => q.X)), maxX = Math.max(...a.map((q) => q.X));
    const minY = Math.min(...a.map((q) => q.Y));
    // The corner stays sharp: a vertex sits at the bounding box corner.
    expect(a.some((q) => Math.abs(q.X - minX) < 200 && Math.abs(q.Y - minY) < 200)).toBe(true);
    // But the edges stay straight: the whole left side sits on one line.
    const left = a.filter((q) => q.X - minX < 50);
    const span = Math.max(...left.map((q) => q.Y)) - Math.min(...left.map((q) => q.Y));
    expect(span / 100).toBeGreaterThan(100);
    // The shared edge became a gap of 2×2px.
    const gap = Math.min(...b.map((q) => q.X)) - maxX;
    expect(gap / 100).toBeCloseTo(4, 0);
  });

  it('turns the map so an area looks most like a rectangle', () => {
    const rect = (angleDeg: number): AdminArea => {
      // A 2:1 rectangle around Seoul, its long side at angleDeg from east.
      const t = (angleDeg * Math.PI) / 180;
      const kx = Math.cos((37.5 * Math.PI) / 180);
      const corner = (u: number, v: number): [number, number] =>
        [127 + (u * Math.cos(t) - v * Math.sin(t)) / kx, 37.5 + u * Math.sin(t) + v * Math.cos(t)];
      const ring: Ring = [corner(-0.02, -0.01), corner(0.02, -0.01), corner(0.02, 0.01), corner(-0.02, 0.01), corner(-0.02, -0.01)];
      return { code: 'r', name: 'r', bbox: viewport.bounds, polygons: [[ring]] };
    };
    expect(rectangleBearing(rect(0).polygons)).toBe(0);
    expect(rectangleBearing(rect(30).polygons)).toBeCloseTo(-30, 0);
    // A quarter turn squares it too; the one nearest north-up wins.
    expect(rectangleBearing(rect(60).polygons)).toBeCloseTo(30, 0);
    const shapes = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [rect(30)], others: [] }, viewport);
    expect(shapes.focus?.code).toBe('f');
    expect(shapes.focus?.bearing).toBeCloseTo(-30, 0);
  });

  it('keeps even a tiny area', () => {
    // About 16px across on a 400px-wide, 0.04°-wide screen: kept.
    const small = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [square('small', 127.02, 37.02, 0.0016)], others: [] }, viewport);
    expect(small.parts).toHaveLength(1);
    // About 6px across: still kept.
    const speck = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [square('speck', 127.02, 37.02, 0.0006)], others: [] }, viewport);
    expect(speck.parts).toHaveLength(1);
  });

  it('reuses a cached shape after a pan, but not one cut at the edge or at another zoom', () => {
    const map = {
      focus: { code: 'f', name: 'f' },
      parts: [square('a', 127.005, 37.005, 0.015)],
      // Far larger than the screen: always cut at the drawn edge.
      others: [square('big', 126.8, 36.8, 0.6)],
    };
    const cache = new AreaShapeCache();
    const get = vi.spyOn(cache, 'get');
    const set = vi.spyOn(cache, 'set');
    const first = renderAreaMap(map, viewport, cache);
    expect(set).toHaveBeenCalledTimes(1);
    const panned: MapViewport = { ...viewport, bounds: { west: 127.003, south: 37.002, east: 127.043, north: 37.042 } };
    const again = renderAreaMap(map, panned, cache);
    expect(get.mock.results.filter((r) => r.value).length).toBe(1);
    // The same outline as drawing it fresh, to within rounding.
    const fresh = renderAreaMap(map, panned);
    const p = screenProjection(panned);
    const xs = (s: typeof first) => s.parts[0][0].map((q) => p.project(q).X);
    expect(Math.min(...xs(again))).toBeCloseTo(Math.min(...xs(fresh)), -1);
    expect(Math.max(...xs(again))).toBeCloseTo(Math.max(...xs(fresh)), -1);
    get.mockClear();
    const zoomedOut: MapViewport = { bounds: { west: 126.98, south: 36.98, east: 127.06, north: 37.06 }, widthPx: 400 };
    renderAreaMap(map, zoomedOut, cache);
    expect(get.mock.results.some((r) => r.value)).toBe(false);
  });

  it('drafts the same areas with the gap but sharp corners', () => {
    const map = {
      focus: { code: 'f', name: 'f' },
      parts: [square('a', 127.005, 37.005, 0.015), square('b', 127.02, 37.005, 0.015)],
      others: [square('c', 127.005, 37.02, 0.03)],
    };
    const draft = renderAreaDraft(map, viewport);
    expect(draft.parts).toHaveLength(2);
    expect(draft.others).toHaveLength(1);
    expect(draft.partTags?.map((t) => t.key)).toEqual(['a', 'b']);
    const p = screenProjection(viewport);
    const [a, b] = draft.parts.map(([outer]) => outer.map(p.project));
    const minX = Math.min(...a.map((q) => q.X)), maxX = Math.max(...a.map((q) => q.X));
    const minY = Math.min(...a.map((q) => q.Y));
    // A vertex right at the corner, unlike the full drawing.
    expect(a.some((q) => Math.abs(q.X - minX) < 2 && Math.abs(q.Y - minY) < 2)).toBe(true);
    expect((Math.min(...b.map((q) => q.X)) - maxX) / 100).toBeCloseTo(4, 0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { areaAt, areasInRange, AreaShapeCache, focusLevel, PART_TONES, rectangleBearing, renderAreaDraft, renderAreaMap, SIDO_FOCUS_MIN_MPP, TONE_SHARES, toneParts, visibleCenter, visibleRange, type AdminArea } from './adminAreas';
import type { MapViewport, Ring } from './districtMap';
import { screenProjection } from './districtRendering';

const square = (code: string, west: number, south: number, size: number): AdminArea => {
  const ring: Ring = [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];
  return { code, name: code, bbox: { west, south, east: west + size, north: south + size }, polygons: [[ring]] };
};
const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.04, north: 37.04 }, widthPx: 400 };

describe('administrative area map', () => {
  it('focuses a 시도 zoomed out and a 시군구 (split into 읍면동) at every closer zoom', () => {
    const atScale = (mpp: number): MapViewport => ({ bounds: { west: 127, south: 37, east: 127 + (mpp * 375) / 88_900, north: 37.1 }, widthPx: 375 });
    expect(focusLevel(atScale(SIDO_FOCUS_MIN_MPP * 1.1))).toBe('sido');
    expect(focusLevel(atScale(SIDO_FOCUS_MIN_MPP * 0.9))).toBe('sgg');
    // 읍면동 is the finest shape, however close in.
    for (const mpp of [8, 2, 0.7, 0.3, 0.1]) expect(focusLevel(atScale(mpp))).toBe('sgg');
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

  it('keeps a polygon area straight along its edges, rounds its corners and opens a thin gap', () => {
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
    // The corner is a curve (M10, M11): nothing right at the bounding box corner, but the outline comes near it.
    expect(a.some((q) => Math.abs(q.X - minX) < 50 && Math.abs(q.Y - minY) < 50)).toBe(false);
    expect(Math.min(...a.map((q) => Math.hypot(q.X - minX, q.Y - minY))) / 100).toBeLessThan(6);
    // But the edges stay straight: the whole left side sits on one line (within the curve's fraction of a pixel).
    const left = a.filter((q) => q.X - minX < 150);
    const span = Math.max(...left.map((q) => q.Y)) - Math.min(...left.map((q) => q.Y));
    expect(span / 100).toBeGreaterThan(100);
    // The shared edge became a gap of 2 x 1.5px, never under the 2.5px minimum.
    const gap = (Math.min(...b.map((q) => q.X)) - maxX) / 100;
    expect(gap).toBeGreaterThanOrEqual(2.45);
    expect(gap).toBeLessThanOrEqual(3.2);
  });

  it('tones the parts 7:2:1 by area and casts one outline around them all', () => {
    // A row of four touching squares and one apart.
    const parts = [0, 1, 2, 3].map((k) => square(`p${k}`, 127.005 + k * 0.006, 37.01, 0.006));
    const shapes = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [...parts, square('far', 127.005, 37.03, 0.006)], others: [] }, viewport);
    const tones = shapes.partTones!;
    expect(tones).toHaveLength(5);
    expect(tones.every((t) => t >= 0 && t < PART_TONES)).toBe(true);
    // The touching four make one silhouette (gaps closed, no little holes where gaps meet); the far one its own.
    expect(shapes.partsOutline).toHaveLength(2);
    expect(shapes.partsOutline!.every((polygon) => polygon.length === 1)).toBe(true);
  });

  it('tones a grid 7:2:1, the pastel and accent in one patch round the middle, never touching their own colour', () => {
    // A 10 x 10 grid of equal parts, each touching the four beside it.
    const size = 10;
    const parts = Array.from({ length: size * size }, (_, k) => ({ index: k, key: `a${k}`, area: 1, at: { X: k % size, Y: Math.floor(k / size) } }));
    const neighbours = new Map(parts.map((p) => [p.index, parts.filter((q) => Math.abs(q.at.X - p.at.X) + Math.abs(q.at.Y - p.at.Y) === 1).map((q) => q.index)]));
    const tones = toneParts(parts, neighbours, { X: 4.5, Y: 4.5 });
    TONE_SHARES.forEach((share, t) => {
      expect(Math.abs(tones.filter((x) => x === t).length / parts.length - share), `tone ${t}`).toBeLessThanOrEqual(0.05);
    });
    for (const p of parts) {
      if (tones[p.index] === 0) continue;
      for (const j of neighbours.get(p.index)!) expect(tones[j], `${p.index}/${j}`).not.toBe(tones[p.index]);
    }
    // One patch round the middle: no coloured part far out.
    for (const p of parts) if (tones[p.index]) expect(Math.hypot(p.at.X - 4.5, p.at.Y - 4.5), `${p.index}`).toBeLessThan(5);
    expect(tones[44] || tones[45] || tones[54] || tones[55]).toBeGreaterThan(0);
  });

  it('merges a part too small for the screen into the neighbour it touches most', () => {
    // A 100px square and a 12px one against its right side (1px = 0.0001 deg here).
    const big = square('big', 127.01, 37.01, 0.01);
    const small = square('small', 127.02, 37.014, 0.0012);
    const shapes = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [big, small], others: [] }, viewport);
    expect(shapes.parts).toHaveLength(1);
    expect(shapes.partTags?.map((t) => t.key)).toEqual(['big']);
    // The big one now reaches over where the small one was.
    const p = screenProjection(viewport);
    const maxX = Math.max(...shapes.parts[0][0].map((c) => p.project(c).X)) / 100;
    expect(maxX).toBeGreaterThan(p.project([127.0205, 37.014]).X / 100);
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

  it('smooths a 동 outline: a narrow notch along a street fills in and corners come out round', () => {
    // 100px square (1px = 0.0001° here) with a 4px-wide, 40px-deep notch cut down from the top middle.
    const [x0, y0, px] = [127.01, 37.01, 0.0001];
    const ring: Ring = [
      [x0, y0], [x0 + 100 * px, y0], [x0 + 100 * px, y0 + 100 * px],
      [x0 + 52 * px, y0 + 100 * px], [x0 + 52 * px, y0 + 60 * px], [x0 + 48 * px, y0 + 60 * px], [x0 + 48 * px, y0 + 100 * px],
      [x0, y0 + 100 * px], [x0, y0],
    ];
    const area: AdminArea = { code: 'n', name: 'n', bbox: { west: x0, south: y0, east: x0 + 100 * px, north: y0 + 100 * px }, polygons: [[ring]] };
    const shaped = renderAreaMap({ focus: { code: 'n', name: 'n' }, parts: [area], others: [] }, viewport);
    expect(shaped.parts).toHaveLength(1);
    const [outer] = shaped.parts[0];
    // No point of the outline reaches down into the notch.
    const inNotch = outer.filter(([x, y]) => x > x0 + 46 * px && x < x0 + 54 * px && y < y0 + 90 * px && y > y0 + 50 * px);
    expect(inNotch).toEqual([]);
    // The corner is round: nothing sits right at it (inside the 2px gap).
    expect(outer.some(([x, y]) => Math.abs(x - (x0 + 98 * px)) < 0.3 * px && Math.abs(y - (y0 + 2 * px)) < 0.3 * px)).toBe(false);
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
    expect((Math.min(...b.map((q) => q.X)) - maxX) / 100).toBeCloseTo(3, 0);
  });
});

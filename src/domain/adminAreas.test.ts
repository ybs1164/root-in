import { describe, expect, it } from 'vitest';
import { areaAt, DONG_FOCUS_MAX_MPP, focusLevel, polygonLike, rectangleBearing, renderAreaMap, SIDO_FOCUS_MIN_MPP, visibleCenter, type AdminArea } from './adminAreas';
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

  it('keeps a polygon area straight along its edges, rounds its corners and opens a gap', () => {
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
    // The corner is an arc: no vertex at the bounding box corner.
    expect(a.some((q) => Math.abs(q.X - minX) < 2 && Math.abs(q.Y - minY) < 2)).toBe(false);
    // But the edges stay straight: the whole left side sits on one line.
    const left = a.filter((q) => q.X - minX < 50);
    const span = Math.max(...left.map((q) => q.Y)) - Math.min(...left.map((q) => q.Y));
    expect(span / 100).toBeGreaterThan(100);
    // The shared edge became a gap of 2×2px.
    const gap = Math.min(...b.map((q) => q.X)) - maxX;
    expect(gap / 100).toBeCloseTo(4, 0);
  });

  it('straightens small bumps along an edge into one line', () => {
    const p = screenProjection(viewport);
    // A 200px square whose top edge zigzags 3px every 8px.
    const pts = [{ X: 10000, Y: 10000 }, { X: 30000, Y: 10000 }];
    for (let x = 30000; x >= 10000; x -= 800) pts.push({ X: x, Y: 30000 + ((x / 800) % 2 ? 300 : 0) });
    const ring: Ring = [...pts, pts[0]].map((q) => p.unproject(q));
    const area: AdminArea = { code: 'z', name: 'z', bbox: viewport.bounds, polygons: [[ring]] };
    const [outer] = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [area], others: [] }, viewport).parts[0];
    // The zigzag is gone: no vertices along the middle of the top edge, and
    // the edge is one level line.
    const top = outer.map(p.project).filter((q) => q.Y > 25000);
    expect(top.filter((q) => q.X > 13000 && q.X < 27000)).toHaveLength(0);
    const corners = top.filter((q) => q.X <= 13000 || q.X >= 27000).map((q) => q.Y);
    expect((Math.max(...corners) - Math.min(...corners)) / 100).toBeLessThan(10);
  });

  it('draws an area that is no polygon of a few sides smooth, inside its own outline', () => {
    const p = screenProjection(viewport);
    // A 150px-radius disc with 12px bumps all around: a polygon would need
    // far more than 12 sides to follow it.
    const pts = Array.from({ length: 180 }, (_, i) => {
      const t = (i / 180) * 2 * Math.PI;
      const r = 15000 + (i % 2 ? 1200 : 0);
      return { X: 20000 + r * Math.cos(t), Y: 20000 + r * Math.sin(t) };
    });
    const ring: Ring = [...pts, pts[0]].map((q) => p.unproject(q));
    const area: AdminArea = { code: 'w', name: 'w', bbox: viewport.bounds, polygons: [[ring]] };
    const [outer] = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [area], others: [] }, viewport).parts[0];
    const out = outer.map(p.project);
    // Smooth: many short steps instead of a few long edges.
    expect(out.length).toBeGreaterThan(40);
    // The bumps are evened out: the radius varies far less than 12px.
    const radii = out.map((q) => Math.hypot(q.X - 20000, q.Y - 20000) / 100);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(4);
    // Never beyond the area's outline shrunk by 1px.
    expect(Math.max(...radii)).toBeLessThan(162 - 1);
  });

  it('treats only outlines with few sides and at most two inside corners as polygons', () => {
    const path = (pts: number[][]) => pts.map(([X, Y]) => ({ X, Y }));
    expect(polygonLike(path([[0, 0], [200, 0], [200, 200], [0, 200]]))).toBe(true);
    // An L (one inside corner) and a T (two) are still polygons.
    expect(polygonLike(path([[0, 0], [200, 0], [200, 80], [80, 80], [80, 200], [0, 200]]))).toBe(true);
    expect(polygonLike(path([[0, 0], [300, 0], [300, 80], [190, 80], [190, 200], [110, 200], [110, 80], [0, 80]]))).toBe(true);
    // An E has only 12 sides but four inside corners: a zigzag, drawn smooth.
    const e = [[0, 0], [200, 0], [200, 50], [70, 50], [70, 80], [200, 80], [200, 120], [70, 120], [70, 150], [200, 150], [200, 200], [0, 200]];
    expect(polygonLike(path(e))).toBe(false);
    // Winding direction doesn't matter.
    expect(polygonLike(path([...e].reverse()))).toBe(false);
    // Too many sides, even if convex.
    const circle = Array.from({ length: 20 }, (_, i) => [Math.round(100 * Math.cos(i * 0.314)), Math.round(100 * Math.sin(i * 0.314))]);
    expect(polygonLike(path(circle))).toBe(false);
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

  it('keeps an area smaller than the corner radius but drops specks', () => {
    // About 16px across on a 400px-wide, 0.04°-wide screen: kept.
    const small = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [square('small', 127.02, 37.02, 0.0016)], others: [] }, viewport);
    expect(small.parts).toHaveLength(1);
    // About 6px across: a speck, dropped as noise.
    const speck = renderAreaMap({ focus: { code: 'f', name: 'f' }, parts: [square('speck', 127.02, 37.02, 0.0006)], others: [] }, viewport);
    expect(speck.parts).toHaveLength(0);
  });
});

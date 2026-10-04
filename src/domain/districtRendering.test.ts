import { describe, expect, it } from 'vitest';
import { type DistrictMap, type MapViewport, type Ring } from './districtMap';
import { renderDistrictMap, screenProjection } from './districtRendering';

function fixture(width = 800, height = 600, span = .02) {
  const v: MapViewport = { widthPx: width, bounds: { west: 127, east: 127 + span, south: 37, north: 37 + span * height / width * .8 } };
  const p = screenProjection(v);
  const bottom = p.project([127, v.bounds.south]).Y, top = p.project([127, v.bounds.north]).Y;
  const ring: Ring = [{ X: 0, Y: bottom }, { X: width * 100, Y: bottom }, { X: width * 100, Y: top }, { X: 0, Y: top }, { X: 0, Y: bottom }].map(p.unproject);
  const map: DistrictMap = { region: ring, blocks: [{ outer: ring, holes: [] }], sourceRoadWidthM: 18 };
  return { v, map, p };
}
const area = (points: { X: number; Y: number }[]) => Math.abs(points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length]; return sum + p.X * q.Y - q.X * p.Y;
}, 0)) / 2;

describe('road-defined district rendering', () => {
  it.each([[1280, 800], [375, 812], [800, 800]])('keeps continuous land intact on a %sx%s screen', (width, height) => {
    const { v, map, p } = fixture(width, height);
    const result = renderDistrictMap(map, v);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].holes).toEqual([]);
    expect(area(result.blocks[0].outer.map(p.project))).toBe(area(map.blocks[0].outer.map(p.project)));
  });

  it('merges triangle and tile seams without inserting replacement divisions', () => {
    const { v, map, p } = fixture();
    const [a, b, c, d] = map.blocks[0].outer;
    const result = renderDistrictMap({ ...map, blocks: [
      { outer: [a, b, c, a], holes: [] }, { outer: [a, c, d, a], holes: [] },
      // Overlapping cached/tile geometry must not cancel land.
      { outer: [a, b, c, a].reverse(), holes: [] },
    ] }, v);
    expect(result.blocks).toHaveLength(1);
    expect(area(result.blocks[0].outer.map(p.project))).toBe(area(map.blocks[0].outer.map(p.project)));
  });

  it('preserves a concave road-defined outline and cached data across zooms', () => {
    for (const span of [.001, .02, 2]) {
      const { v, map, p } = fixture(800, 600, span);
      const ring: Ring = [[0, 0], [30000, 0], [30000, 10000], [10000, 10000],
        [10000, 30000], [0, 30000], [0, 0]].map(([X, Y]) => p.unproject({ X, Y }));
      const source = { ...map, blocks: [{ outer: ring, holes: [] }] };
      const saved = JSON.stringify(source);
      const result = renderDistrictMap(source, v);
      expect(result.blocks).toHaveLength(1);
      expect(area(result.blocks[0].outer.map(p.project))).toBe(500000000);
      expect(result.blocks[0].outer).toHaveLength(7);
      expect(JSON.stringify(source)).toBe(saved);
    }
  });

  it('preserves a real road corridor and water hole rather than painting over them', () => {
    const { v, map, p } = fixture();
    const rect = (x0: number, y0: number, x1: number, y1: number): Ring =>
      [{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }, { X: x0, Y: y0 }].map(p.unproject);
    const bottom = p.project([127, v.bounds.south]).Y;
    const top = p.project([127, v.bounds.north]).Y;
    const result = renderDistrictMap({ ...map, blocks: [
      { outer: rect(0, bottom, 38000, top), holes: [rect(10000, -5000, 18000, 5000)] },
      { outer: rect(42000, bottom, 80000, top), holes: [] },
    ] }, v);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.reduce((sum, block) => sum + block.holes.length, 0)).toBe(1);
    const netArea = result.blocks.reduce((sum, block) => sum + area(block.outer.map(p.project)) -
      block.holes.reduce((n, hole) => n + area(hole.map(p.project)), 0), 0);
    expect(netArea).toBe(76000 * (top - bottom) - 8000 * 10000);
    // Only the real 40px road separates these two districts.
    for (const block of result.blocks) {
      const xs = block.outer.map(p.project).map((point) => point.X);
      expect(Math.max(...xs) <= 38001 || Math.min(...xs) >= 41999).toBe(true);
    }
    // The lake remains an interior hole in its surrounding district.
    const contains = (ring: Ring, x: number, y: number) => {
      const points = ring.map(p.project);
      let hit = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a.Y > y) !== (b.Y > y) && x < (b.X - a.X) * (y - a.Y) / (b.Y - a.Y) + a.X) hit = !hit;
      }
      return hit;
    };
    expect(result.blocks.some((block) => contains(block.outer, 14000, 0) &&
      !block.holes.some((hole) => contains(hole, 14000, 0)))).toBe(false);
  });

  it('leaves empty data and legacy unstyled fixtures unchanged', () => {
    const { v, map } = fixture();
    const legacy = { ...map, sourceRoadWidthM: undefined };
    expect(renderDistrictMap(legacy, v)).toBe(legacy);
    const empty = { ...map, blocks: [] };
    expect(renderDistrictMap(empty, v)).toBe(empty);
  });
});


import { describe, expect, it } from 'vitest';
import { pingOverlap, placePingLabels, pingInfoSize } from './stopLabels';
import type { AdminArea } from './adminAreas';
import { readDecor } from '../services/dayRepository';
import { bestBearing, clusterPoints, spreadPins, convexHull, inPolygon, LEG_POWER, legLayout, lumpAreas, stopProjection, stopsCircle, terrainParts, terrainRange, tiltPoint, uniformProjection, untiltPoint, viewPoints } from './miniMap';

describe('미니맵', () => {
  it('stops close together share a group, far ones get their own', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 500, y: 500 },
    ];
    const groups = clusterPoints(pts, 15);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 3]);
  });

  it('the tilt squashes depth and can be undone', () => {
    const p = { x: 0.3, y: 0.9 };
    const back = untiltPoint(tiltPoint(p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    expect(Math.abs(tiltPoint({ x: 0.5, y: 1 }).y - 0.5)).toBeLessThan(0.5);
  });

  it('상세: the region is one lump of real areas, kept whole, with the stops standing on it', () => {
    const centers: [number, number][] = [[126.98, 37.56], [127.0, 37.57], [126.99, 37.55]];
    const area = (code: string, west: number, east: number, south = 37.54, north = 37.58): AdminArea => ({
      code,
      name: code,
      bbox: { west, east, south, north },
      polygons: [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]],
    });
    const shapes = { parts: [area('a', 126.97, 126.99), area('b', 126.99, 127.01), area('far', 127.3, 127.4)], others: [] };
    // Only the areas reaching the stops make the lump, each whole (nothing cut to a window).
    expect(lumpAreas(shapes, centers).map((a) => a.code)).toEqual(['a', 'b']);
    const parts = terrainParts(shapes, centers);
    // With no base map: one tone of land in one outline (the border between the areas is not drawn).
    expect(parts.map((p) => p.fill.role)).toEqual(['shadow', 'side', 'land', 'haze']);
    const fills = parts.filter((p) => p.fill.role === 'land');
    const filled = fills[0].polys;
    expect(filled).toHaveLength(1);
    const shadow = parts.filter((p) => p.fill.alpha !== undefined);
    expect(shadow).toHaveLength(1);
    expect(shadow[0].dy).toBeGreaterThan(0);
    // Every stop is on one of the areas.
    const spots = viewPoints(centers, shapes);
    expect(spots.every((p) => filled.some((ring) => inPolygon(p, ring)))).toBe(true);
    // The whole lump fits the unit square.
    const all = filled.flat();
    expect(Math.min(...all.map((p) => p.x))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...all.map((p) => p.x))).toBeLessThanOrEqual(1.05);
    expect(Math.min(...all.map((p) => p.y))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...all.map((p) => p.y))).toBeLessThanOrEqual(1);
    // No data: nothing is drawn, and the stops fit themselves.
    expect(terrainParts(null, centers)).toEqual([]);
    expect(uniformProjection(centers).window.west).toBeLessThan(126.98);
  });

  it('상세 with a base map: water, land, parks and only the big roads, all kept to the lump', () => {
    const centers: [number, number][] = [[126.98, 37.56], [127.0, 37.57]];
    const square = (west: number, east: number, south: number, north: number): [number, number][] => [[west, south], [east, south], [east, north], [west, north], [west, south]];
    const area = (code: string, west: number, east: number): AdminArea => ({ code, name: code, bbox: { west, east, south: 37.54, north: 37.58 }, polygons: [[square(west, east, 37.54, 37.58)]] });
    const road = (tier: 1 | 2 | 3, lat: number) => ({ tier, path: [[126.96, lat], [127.02, lat]] as [number, number][] });
    const shapes = {
      parts: [area('a', 126.97, 126.99), area('b', 126.99, 127.01)],
      others: [],
      base: {
        // Land north of a river along 37.55, a park in it, and roads of three tiers.
        land: [[square(126.9, 127.1, 37.552, 37.6)]],
        parks: [[square(126.975, 126.985, 37.565, 37.575)], [square(126.99, 126.9901, 37.57, 37.5701)]],
        roads: [road(1, 37.555), road(2, 37.565), road(3, 37.575)],
      },
    };
    const parts = terrainParts(shapes, centers);
    expect(parts.map((p) => p.fill.role)).toEqual(['shadow', 'side', 'water', 'land', 'park', 'road', 'haze']);
    const [, side, water, land, park, roads, haze] = parts;
    // The lump is water under the land, so the river shows where there is no land; the rest is kept to the lump.
    expect(water.polys).toHaveLength(1);
    expect(water.clip).toBeUndefined();
    for (const p of [land, park, roads]) expect(p.clip).toEqual(water.polys);
    // A speck of a park is left out; of the roads only the motorway (the main roads made a busy mesh).
    expect(park.polys).toHaveLength(1);
    expect(roads.ways).toHaveLength(1);
    // A slab seen at an angle: its side just below the lump, the far side paler under a haze over everything.
    expect(side.polys).toEqual(water.polys);
    expect(side.dy).toBeGreaterThan(0);
    expect(haze.haze).toBeGreaterThan(0);
    expect(haze.haze).toBeLessThan(1);
  });

  it('the lump takes the areas the circle around the stops reaches, and fills its dents', () => {
    const cell = (code: string, x: number, y: number): AdminArea => ({
      code,
      name: code,
      bbox: { west: x, east: x + 0.01, south: y, north: y + 0.01 },
      polygons: [[[[x, y], [x + 0.01, y], [x + 0.01, y + 0.01], [x, y + 0.01], [x, y]]]],
    });
    // One stop in a, close to b (the circle reaches it) and far from c.
    const near: [number, number][] = [[127.0095, 37.5005]];
    const shapes = { parts: [cell('a', 127.0, 37.5), cell('b', 127.01, 37.5), cell('c', 127.1, 37.5)], others: [] };
    expect(lumpAreas(shapes, near).map((a) => a.code)).toEqual(['a', 'b']);
    expect(stopsCircle(near).radius).toBeGreaterThanOrEqual(0.004);

    // An L of areas around a notch: the area in the notch is part of the lump, the one past the corner is not.
    const arm = (code: string, col: number, row: number) => cell(code, 127 + col * 0.01, 37.5 + row * 0.01);
    const L = [arm('l0', 0, 0), arm('l1', 1, 0), arm('l2', 2, 0), arm('l3', 0, 1), arm('l4', 0, 2)];
    const stops: [number, number][] = [[127.0005, 37.5005], [127.0205, 37.5005], [127.0005, 37.5205]];
    const lump = lumpAreas({ parts: [...L, arm('notch', 1, 1), arm('past', 2, 2)], others: [] }, stops).map((a) => a.code);
    expect(lump).toContain('notch');
    expect(lump).not.toContain('past');

    // A hull of a square with a dent keeps no dent.
    const hull = convexHull([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 1, y: 1 }, { x: 0, y: 2 }]);
    expect(hull).toHaveLength(4);
  });

  it('pings close together put their info on different sides, and the map turns to part them', () => {
    const size = pingInfoSize('명동성당', '14:30');
    // Two pins side by side: the second's info does not land on the first's.
    const sides = placePingLabels([{ x: 100, y: 100 }, { x: 108, y: 100 }], [size, size]);
    expect(sides[0]).not.toBe(sides[1]);
    // A pin directly under another: the lower one's info keeps off the upper pin.
    const stacked = placePingLabels([{ x: 100, y: 100 }, { x: 100, y: 140 }], [size, size]);
    expect(pingOverlap([{ x: 100, y: 100 }, { x: 100, y: 140 }], [size, size])).toBeGreaterThanOrEqual(0);
    expect(stacked).toHaveLength(2);

    // Three stops in a line: a turned map spreads them better than an unturned one, and the turn is chosen.
    const stops: [number, number][] = [[127.0, 37.5], [127.003, 37.5], [127.006, 37.5]];
    const cell = (x: number): AdminArea => ({
      code: `c${x}`,
      name: 'c',
      bbox: { west: x, east: x + 0.01, south: 37.49, north: 37.51 },
      polygons: [[[[x, 37.49], [x + 0.01, 37.49], [x + 0.01, 37.51], [x, 37.51], [x, 37.49]]]],
    });
    const angle = bestBearing(stops, [cell(126.998)]);
    expect(Math.abs(angle)).toBeLessThanOrEqual(180);
    expect(bestBearing(stops, [cell(126.998)])).toBe(angle);
  });

  it('pins that cover one another are moved apart, the land along with them; others stay', () => {
    const px = (p: { x: number; y: number }) => ({ x: p.x * 330, y: p.y * 330 });
    const covers = (a: { x: number; y: number }, b: { x: number; y: number }, wa = 34, wb = 34) => Math.abs(a.x - b.x) < (wa + wb) / 2 && Math.abs(a.y - b.y) < 44;
    // Two on one spot and one far off.
    const spread = spreadPins([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.2, y: 0.2 }]).map(px);
    expect(covers(spread[0], spread[1])).toBe(false);
    expect(spread[2]).toEqual({ x: 66, y: 66 });
    // A tight cluster of five: none covers another, all stay in the picture.
    const five = spreadPins([0, 1, 2, 3, 4].map((k) => ({ x: 0.5 + k * 0.01, y: 0.5 + (k % 2) * 0.01 })), 4).map(px);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(covers(five[i], five[j], i === 4 ? 48 : 34, j === 4 ? 48 : 34)).toBe(false);
    expect(five.every((p) => p.x >= 0 && p.x <= 330 && p.y >= 0 && p.y <= 330)).toBe(true);
    // Two places in one building on the real map: the pins stand apart, each on land.
    const same: [number, number][] = [[127.0, 37.5], [127.00002, 37.50001]];
    const cell: AdminArea = { code: 'c', name: 'c', bbox: { west: 126.99, east: 127.01, south: 37.49, north: 37.51 }, polygons: [[[[126.99, 37.49], [127.01, 37.49], [127.01, 37.51], [126.99, 37.51], [126.99, 37.49]]]] };
    const shapes = { parts: [cell], others: [] };
    const spots = viewPoints(same, shapes).map(px);
    expect(covers(spots[0], spots[1])).toBe(false);
    const land = terrainParts(shapes, same).find((p) => p.fill.role === 'land')!;
    expect(viewPoints(same, shapes).every((p) => land.polys.some((ring) => inPolygon(p, ring)))).toBe(true);
  });

  it('old days with a map shape or distance stored still load, without them', () => {
    const read = readDecor({ strokes: [], stickers: [], miniMap: 'whole', mapDistance: 'light', hideTimes: true });
    expect(read).not.toBeNull();
    expect(read).not.toHaveProperty('miniMap');
    expect(read).not.toHaveProperty('mapDistance');
    expect(read?.hideTimes).toBe(true);
  });

  describe('거리: legs evened out halfway', () => {
    // A tight cluster of three in 을지로 and one stop far off in 잠실: legs of ~200 m and ~10 km.
    const centers: [number, number][] = [[126.99, 37.566], [126.992, 37.567], [126.991, 37.565], [127.1, 37.513]];
    const cell = (code: string, west: number, south: number, size = 0.02): AdminArea => ({
      code,
      name: code,
      bbox: { west, east: west + size, south, north: south + size },
      polygons: [[[[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]]]],
    });
    const shapes = { parts: [cell('jung', 126.98, 37.555), cell('jamsil', 127.09, 37.505)], others: [] };
    const len = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    const legs = (pts: { x: number; y: number }[]) => pts.slice(1).map((p, i) => len(pts[i], p));
    const spreadOf = (pts: { x: number; y: number }[]) => Math.max(...legs(pts)) / Math.min(...legs(pts));

    it('evens the legs by a power, keeping their directions', () => {
      const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 100 }];
      const even = legLayout(pts, 0);
      expect(legs(even)[0]).toBeCloseTo(legs(even)[1], 9);
      expect(even[1].y - even[0].y).toBeCloseTo(0, 9);
      expect(even[2].x - even[1].x).toBeCloseTo(0, 9);
      expect(spreadOf(legLayout(pts, 0.5))).toBeCloseTo(10, 6);
      expect(legLayout(pts, 1)).toEqual(pts);
    });

    it('shows the far leg longer than the short ones, but far less than the real ratio', () => {
      expect(LEG_POWER).toBe(0.5);
      const kx = Math.cos((37.54 * Math.PI) / 180);
      const real = spreadOf(centers.map(([x, y]) => ({ x: x * kx, y })));
      const drawn = spreadOf(viewPoints(centers).map(untiltPoint));
      expect(drawn).toBeGreaterThan(2);
      expect(drawn).toBeLessThan(real / 3);
    });

    it('the stops stay put while the real map is missing, and fit themselves', () => {
      expect(viewPoints(centers, null)).toEqual(viewPoints(centers));
      expect(stopProjection(centers)(centers[0])).toEqual(viewPoints(centers)[0]);
    });

    it('draws the real areas under their own stops', () => {
      const land = terrainParts(shapes, centers).find((p) => p.fill.role === 'land')!;
      const spots = viewPoints(centers, shapes);
      // Two islands: one under the first three (jung), one under the last (jamsil).
      expect(land.polys).toHaveLength(2);
      const islandOf = (p: { x: number; y: number }) => land.polys.findIndex((ring) => inPolygon(p, ring));
      expect(spots.map(islandOf).every((k) => k >= 0)).toBe(true);
      expect(new Set(spots.slice(0, 3).map(islandOf)).size).toBe(1);
      expect(islandOf(spots[3])).not.toBe(islandOf(spots[0]));
    });

    it('on the real map no stop stands on the edge: the areas around each one are taken in', () => {
      // A row of cells; the stops lie in the middle two, the outer ones only around them.
      const row = [0, 1, 2, 3].map((i) => cell(`c${i}`, 127 + i * 0.01, 37.5, 0.01));
      const stops: [number, number][] = [[127.0105, 37.505], [127.0295, 37.505]];
      const lump = lumpAreas({ parts: row, others: [] }, stops).map((a) => a.code);
      expect(lump).toEqual(['c0', 'c1', 'c2', 'c3']);
      const range = terrainRange(stops);
      expect(range.west).toBeLessThan(127.005);
      expect(range.east).toBeGreaterThan(127.035);
    });
  });
});

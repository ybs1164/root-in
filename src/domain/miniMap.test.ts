import { describe, expect, it } from 'vitest';
import { pingOverlap, placePingLabels, pingInfoSize } from './stopLabels';
import type { AdminArea } from './adminAreas';
import { readDecor } from '../services/dayRepository';
import { DEFAULT_DISTANCE, legLayout, MAP_DISTANCES, miniMapView, nextMapDistance, stopProjection, terrainRange, type MapDistance, clusterPoints, isMiniMapId, bestBearing, convexHull, inPolygon, lumpAreas, stopsCircle, terrainParts, tiltPoint, uniformProjection, untiltPoint, viewPoints, miniMapChunks, miniMapLayers, nextMiniMap, traceCoasts, wholeOutline } from './miniMap';

describe('미니맵', () => {
  it('stops close together share a chunk, far ones get their own', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 500, y: 500 },
    ];
    const groups = clusterPoints(pts, 15);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 3]);
  });

  it('links stay within the gap and a lone stop is a disc with no links', () => {
    const chunks = miniMapChunks([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 900, y: 900 }], 20);
    expect(chunks).toHaveLength(2);
    expect(chunks.find((c) => c.discs.length === 1)!.links).toEqual([]);
    expect(chunks.find((c) => c.discs.length === 2)!.links).toHaveLength(1);
  });

  it('knows its ids', () => {
    expect(isMiniMapId('blob')).toBe(true);
    expect(isMiniMapId('streets')).toBe(true);
    expect(isMiniMapId('x')).toBe(false);
  });

  it("길: the only roads are the day's own legs, on the land", () => {
    const pts = [{ x: 0.25, y: 0.55 }, { x: 0.45, y: 0.5 }, { x: 0.6, y: 0.62 }];
    const roads = (stops: { x: number; y: number }[]) => miniMapLayers(stops, 'streets').flatMap((p) => p.lines);
    expect(roads(pts.slice(0, 1))).toEqual([]);
    const lines = roads(pts);
    expect(lines.length).toBeGreaterThan(0);
    const distTo = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const [dx, dy] = [b.x - a.x, b.y - a.y];
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    // Every piece of road lies along a leg between two stops (the tilt bends it only a little).
    for (const { a, b } of lines) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(Math.min(distTo(mid, pts[0], pts[1]), distTo(mid, pts[1], pts[2]))).toBeLessThan(0.02);
    }
  });

  it('지도: one outline holds every stop, the same one each time', () => {
    const pts = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.85 }];
    const { outline, centre } = wholeOutline(pts);
    // Every stop lies inside the polygon (ray casting).
    const inside = (p: { x: number; y: number }) => {
      let c = false;
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [a, b] = [outline[i], outline[j]];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    };
    expect(pts.every(inside)).toBe(true);
    expect(inside(centre)).toBe(true);
    expect(miniMapLayers(pts, 'whole')).toEqual(miniMapLayers(pts, 'whole'));
    expect(miniMapLayers(pts, 'none')).toEqual([]);
  });

  it('the day switch steps through the styles and comes back to none', () => {
    expect(nextMiniMap('none')).toBe('blob');
    expect(nextMiniMap('whole')).toBe('detail');
    expect(nextMiniMap('detail')).toBe('none');
  });

  it('the abstract styles are tilted flat land with a shadow below it, and every stop stands on it', () => {
    const pts = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.85 }];
    for (const style of ['blob', 'streets', 'whole'] as const) {
      const parts = miniMapLayers(pts, style);
      const shadow = parts.filter((p) => p.fill.alpha !== undefined);
      expect(shadow).toHaveLength(1);
      expect(shadow[0].dy).toBeGreaterThan(0);
      const land = parts.find((p) => p.polys.length && p.fill.alpha === undefined)!;
      expect(pts.every((q) => land.polys.some((poly) => inPolygon(q, poly)))).toBe(true);
    }
  });

  it('traces a coast round the land of a field, with no lakes', () => {
    // A disc of radius 0.2 at the middle, with a hole: only the outer coast comes back.
    const field = (p: { x: number; y: number }) => {
      const r = Math.hypot(p.x - 0.5, p.y - 0.5);
      return r < 0.2 && r > 0.05 ? 1 : 0;
    };
    const coasts = traceCoasts(field, 0.5, { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.8 });
    expect(coasts).toHaveLength(1);
    expect(coasts[0].every((p) => Math.abs(Math.hypot(p.x - 0.5, p.y - 0.5) - 0.2) < 0.02)).toBe(true);
  });

  it('덩어리: near stops flow into one round island, far ones are islands apart, the same each time', () => {
    // Two stops 300 m apart, and one 5 km off.
    const near = [{ x: 0.3, y: 0.6 }, { x: 0.42, y: 0.62 }];
    const far = [...near, { x: 0.9, y: 0.4 }];
    const ground: [number, number][] = [[127.05, 37.54], [127.0534, 37.54], [127.106, 37.54]];
    const land = (pts: { x: number; y: number }[]) => miniMapLayers(pts, 'blob', ground.slice(0, pts.length)).find((p) => p.polys.length && p.fill.alpha === undefined)!;
    expect(land(near).polys).toHaveLength(1);
    expect(land(far).polys).toHaveLength(2);
    expect(miniMapLayers(far, 'blob', ground)).toEqual(miniMapLayers(far, 'blob', ground));
    // Round: no corners, every turn along the coast is gentle (the old discs and bars met at sharp angles).
    for (const ring of land(far).polys) {
      const turns = ring.map((p, i) => {
        const [a, b] = [ring[(i + ring.length - 1) % ring.length], ring[(i + 1) % ring.length]];
        const [u, w] = [Math.atan2(p.y - a.y, p.x - a.x), Math.atan2(b.y - p.y, b.x - p.x)];
        return Math.abs(Math.atan2(Math.sin(w - u), Math.cos(w - u)));
      });
      expect(Math.max(...turns)).toBeLessThan(Math.PI / 3);
    }
  });

  it('the land is a slab seen at an angle: its side below its top, its far side paler', () => {
    const pts = [{ x: 0.2, y: 0.4 }, { x: 0.8, y: 0.6 }];
    for (const style of ['blob', 'streets', 'whole'] as const) {
      const parts = miniMapLayers(pts, style);
      const [top, side, haze] = ['land', 'side', 'haze'].map((role) => parts.find((p) => p.fill.role === role)!);
      const at = (role: string) => parts.findIndex((p) => p.fill.role === role);
      // The side lies just below the top and is drawn first; the haze goes over everything else (the roads too).
      expect(side.polys).toEqual(top.polys);
      expect(side.dy).toBeGreaterThan(0);
      expect(at('side')).toBeLessThan(at('land'));
      expect(at('haze')).toBe(parts.length - 1);
      expect(haze.haze).toBeGreaterThan(0);
      expect(haze.haze).toBeLessThan(1);
    }
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
    // With no base map: one tone of land, the borders between the areas sealed over (nobody sees them on the ground).
    expect(parts.map((p) => p.fill.role)).toEqual(['shadow', 'side', 'land', 'haze']);
    const fills = parts.filter((p) => p.fill.role === 'land');
    const filled = fills[0].polys;
    expect(filled).toHaveLength(2);
    expect(fills[0].seal).toBeGreaterThan(0);
    const shadow = parts.filter((p) => p.fill.alpha !== undefined);
    expect(shadow).toHaveLength(1);
    expect(shadow[0].dy).toBeGreaterThan(0);
    // Every stop is on one of the areas, at the real scale.
    const spots = viewPoints(centers, { shape: 'detail', distance: 'true' }, shapes);
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
    const [, , water, land, park, roads] = parts;
    // The lump is water under the land, so the river shows where there is no land; the rest is kept to the lump.
    expect(water.polys).toHaveLength(2);
    expect(water.clip).toBeUndefined();
    for (const p of [land, park, roads]) expect(p.clip).toEqual(water.polys);
    // A speck of a park is left out; of the roads only the motorway (the main roads made a busy mesh).
    expect(park.polys).toHaveLength(1);
    expect(roads.ways).toHaveLength(1);
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

  describe('거리 × 형태', () => {
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
    const DISTANCES = MAP_DISTANCES.map((m) => m.id);

    it('steps through five distances, and reads the old names', () => {
      expect(DISTANCES).toEqual(['even', 'strong', 'half', 'light', 'true']);
      expect(nextMapDistance('even')).toBe('strong');
      expect(nextMapDistance('true')).toBe('even');
      expect(miniMapView('blob', undefined).distance).toBe(DEFAULT_DISTANCE);
      const read = (d: object) => readDecor({ strokes: [], stickers: [], ...d });
      expect(read({ miniMap: 'whole', mapDistance: 'squashed' })?.mapDistance).toBe('half');
      expect(read({ mapDistance: 'relative' })?.mapDistance).toBeUndefined();
      expect(read({ mapDistance: 'light' })?.mapDistance).toBe('light');
      expect(read({ mapDistance: 'far' })?.mapDistance).toBeUndefined();
    });

    it('evens the legs by a power, keeping their directions', () => {
      const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 100 }];
      const even = legLayout(pts, 0);
      expect(legs(even)[0]).toBeCloseTo(legs(even)[1], 9);
      expect(even[1].y - even[0].y).toBeCloseTo(0, 9);
      expect(even[2].x - even[1].x).toBeCloseTo(0, 9);
      expect(spreadOf(legLayout(pts, 0.5))).toBeCloseTo(10, 6);
      expect(legLayout(pts, 1)).toEqual(pts);
    });

    it('each step shows the far leg longer than the one before, from even to the real ratio', () => {
      const untilted = (d: MapDistance) => viewPoints(centers, miniMapView('none', d)).map(untiltPoint);
      const spreads = DISTANCES.map((d) => spreadOf(untilted(d)));
      expect(spreads[0]).toBeLessThan(1.6);
      for (let i = 1; i < spreads.length; i++) expect(spreads[i]).toBeGreaterThan(spreads[i - 1] * 1.5);
      const kx = Math.cos((37.54 * Math.PI) / 180);
      expect(spreads[4]).toBeCloseTo(spreadOf(centers.map(([x, y]) => ({ x: x * kx, y }))), 0);
    });

    it('the stops stay put whatever the shape: a 상세 with no data falls back without a jump', () => {
      for (const distance of DISTANCES) {
        const none = viewPoints(centers, miniMapView('none', distance));
        for (const shape of ['blob', 'streets', 'whole'] as const) expect(viewPoints(centers, miniMapView(shape, distance))).toEqual(none);
        expect(viewPoints(centers, miniMapView('detail', distance), null)).toEqual(none);
      }
    });

    it('every distance draws the real areas under their own stops', () => {
      for (const distance of DISTANCES) {
        const land = terrainParts(shapes, centers, distance).find((p) => p.fill.role === 'land')!;
        const spots = viewPoints(centers, miniMapView('detail', distance), shapes);
        // jung holds the first three, jamsil the last.
        expect(spots.every((p, i) => inPolygon(p, land.polys[i < 3 ? 0 : 1]))).toBe(true);
      }
    });

    it('the abstract land holds every pin, its head too, at every distance', () => {
      for (const distance of DISTANCES) {
        const pts = viewPoints(centers, miniMapView('none', distance));
        for (const shape of ['blob', 'streets', 'whole'] as const) {
          const land = miniMapLayers(pts, shape, centers).find((p) => p.polys.length && p.fill.alpha === undefined)!;
          const on = (q: { x: number; y: number }) => land.polys.some((poly) => inPolygon(q, poly));
          expect(pts.every((p) => on(p) && on({ x: p.x, y: p.y - 0.06 }))).toBe(true);
        }
      }
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

    it('which stops share a chunk is judged on the ground, the same at every distance', () => {
      const islands = (distance: MapDistance) => {
        const pts = viewPoints(centers, miniMapView('blob', distance));
        return miniMapLayers(pts, 'blob', centers).find((p) => p.polys.length && p.fill.alpha === undefined)!.polys.length;
      };
      expect(new Set(DISTANCES.map(islands)).size).toBe(1);
      expect(stopProjection(centers, 'true')(centers[0])).toEqual(viewPoints(centers, miniMapView('blob', 'true'))[0]);
    });
  });
});

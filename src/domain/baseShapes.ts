import type { BaseMap, BaseRoad, PolygonRings } from './baseMap';
import type { LonLat, MapViewport, Ring } from './districtMap';

/**
 * The base map (water, land, parks, roads) trimmed to what one screen can
 * show (docs/plan-mainmap-style.md M2): outlines are simplified to about a
 * pixel, specks too small to see are dropped and ponds too small to read as
 * water are filled — the same rule the 미니맵 uses (`MIN_POND`), here in
 * screen pixels. Water is wherever no land is drawn.
 */
export interface BaseShapes {
  land: PolygonRings[];
  parks: PolygonRings[];
  /** Narrow tiers first, so the wide roads lie over them at junctions. */
  roads: BaseRoad[];
}

/** Outlines may move this far (screen px) when simplified: invisible, and far fewer points. */
export const SIMPLIFY_PX = 0.75;
/** Land and parks smaller than this across (px) are dropped: a speck, not a place. */
export const MIN_SHAPE_PX = 3;
/** Holes in the land smaller than this across (px) are filled: they'd read as noise, not water. */
export const MIN_POND_PX = 8;
/** Roads shorter than this across (px) are dropped. */
export const MIN_ROAD_PX = 2;

interface Scale {
  /** Degrees per screen pixel, east–west and north–south (Web Mercator at this latitude). */
  x: number;
  y: number;
}

function screenScale({ bounds, widthPx }: MapViewport): Scale {
  const x = (bounds.east - bounds.west) / widthPx;
  const lat = ((bounds.south + bounds.north) / 2) * (Math.PI / 180);
  return { x, y: x * Math.cos(lat) };
}

/** How far a ring reaches across, in screen px. */
function acrossPx(points: LonLat[], scale: Scale): number {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [x, y] of points) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  return Math.max((east - west) / scale.x, (north - south) / scale.y);
}

/** Douglas–Peucker in screen px, keeping the ends (a ring's first and last point are the same). */
function simplifyPath(points: LonLat[], scale: Scale, tolerancePx: number): LonLat[] {
  if (points.length <= 2) return points;
  const px = points.map(([x, y]) => [x / scale.x, y / scale.y] as const);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const [ax, ay] = px[from];
    const [bx, by] = px[to];
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    let far = -1, farDist = tolerancePx;
    for (let i = from + 1; i < to; i++) {
      const [x, y] = px[i];
      // Distance to the chord (or to its start when the chord is a point, as on a closed ring).
      const dist = length ? Math.abs(dy * (x - ax) - dx * (y - ay)) / length : Math.hypot(x - ax, y - ay);
      if (dist > farDist) {
        far = i;
        farDist = dist;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([from, far], [far, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** A ring simplified, or null when too little of it is left to draw. */
function simplifyRing(ring: Ring, scale: Scale): Ring | null {
  const simple = simplifyPath(ring, scale, SIMPLIFY_PX);
  return simple.length >= 4 ? simple : null;
}

/** Polygons big enough to see, simplified; holes smaller than `minHolePx` filled. */
function shapePolygons(polygons: PolygonRings[], scale: Scale, minHolePx: number): PolygonRings[] {
  const shaped: PolygonRings[] = [];
  for (const [outer, ...holes] of polygons) {
    if (!outer || acrossPx(outer, scale) < MIN_SHAPE_PX) continue;
    const ring = simplifyRing(outer, scale);
    if (!ring) continue;
    const kept: Ring[] = [];
    for (const hole of holes) {
      if (acrossPx(hole, scale) < minHolePx) continue;
      const simple = simplifyRing(hole, scale);
      if (simple) kept.push(simple);
    }
    shaped.push([ring, ...kept]);
  }
  return shaped;
}

/** The base map shaped for this screen (see `BaseShapes`). */
export function shapeBaseMap(base: BaseMap, viewport: MapViewport): BaseShapes {
  const scale = screenScale(viewport);
  const roads: BaseRoad[] = [];
  for (const road of base.roads) {
    if (acrossPx(road.path, scale) < MIN_ROAD_PX) continue;
    roads.push({ tier: road.tier, path: simplifyPath(road.path, scale, SIMPLIFY_PX) });
  }
  roads.sort((a, b) => b.tier - a.tier);
  return {
    land: shapePolygons(base.land, scale, MIN_POND_PX),
    // A hole in a park is land, not water: keep only the ones big enough to see.
    parks: shapePolygons(base.parks, scale, MIN_SHAPE_PX),
    roads,
  };
}

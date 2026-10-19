import type { AdminArea } from './adminAreas';
import type { BaseMap } from './baseMap';
import { pingOverlap } from './stopLabels';
import type { Bbox, LonLat } from './districtMap';

/**
 * 미니맵: the real map drawn behind a day's pings (and its share card's
 * photo): the 읍면동 around the stops cut into one lump, with water, parks
 * and the big roads in it, tilted as if seen from above at an angle.
 *
 * The distances between the stops are evened out halfway: every leg (one
 * stop to the next) keeps its direction and its length is raised to
 * `LEG_POWER` against the legs' typical length, so a day of one far trip and
 * a few short walks shows both. The land under the stops is bent along.
 */
export const LEG_POWER = 0.5;

export interface MapPoint {
  x: number;
  y: number;
}

/**
 * The stops (flat, any unit) with every leg's length raised to `power`
 * against the legs' typical (geometric mean) length, directions kept, laid
 * back over the same middle. A leg of no length stays one.
 */
export function legLayout(points: MapPoint[], power: number): MapPoint[] {
  if (power >= 1 || points.length < 2) return points;
  const legs = points.slice(1).map((p, i) => ({ x: p.x - points[i].x, y: p.y - points[i].y }));
  const lens = legs.map((l) => Math.hypot(l.x, l.y));
  const some = lens.filter((l) => l > 0);
  if (!some.length) return points;
  const typical = Math.exp(some.reduce((s, l) => s + Math.log(l), 0) / some.length);
  const out = [{ ...points[0] }];
  legs.forEach((l, i) => {
    const k = lens[i] > 0 ? (typical * Math.pow(lens[i] / typical, power)) / lens[i] : 0;
    out.push({ x: out[i].x + l.x * k, y: out[i].y + l.y * k });
  });
  const middle = (pts: MapPoint[]) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
  const [was, now] = [middle(points), middle(out)];
  return out.map((p) => ({ x: p.x + was.x - now.x, y: p.y + was.y - now.y }));
}

/**
 * Moves any point by the stops' own moves (`from` → `to`), weighted by
 * nearness (inverse square): a stop's surroundings go with it, so a real
 * map's areas stay under their stops however the distances are drawn.
 */
export function bendField(from: MapPoint[], to: MapPoint[]): (p: MapPoint) => MapPoint {
  const moves = from.map((f, i) => ({ x: to[i].x - f.x, y: to[i].y - f.y }));
  if (moves.every((m) => m.x === 0 && m.y === 0)) return (p) => p;
  return (p) => {
    let [sx, sy, sw] = [0, 0, 0];
    for (let i = 0; i < from.length; i++) {
      const d2 = (p.x - from[i].x) ** 2 + (p.y - from[i].y) ** 2;
      if (d2 === 0) return to[i];
      const w = 1 / d2;
      sx += moves[i].x * w;
      sy += moves[i].y * w;
      sw += w;
    }
    return { x: p.x + sx / sw, y: p.y + sy / sw };
  };
}

/** Stops this close on the ground (metres) share one chunk, whatever the distances are drawn as. */
export const CHUNK_GAP_M = 1500;
/** Groups of point indices: single linkage, two points within `gap` of each other (or via others) are one chunk. */
export function clusterPoints(points: MapPoint[], gap: number): number[][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= gap) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  points.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  return [...groups.values()];
}

/** Lon/lat as metres east and south (only differences matter). */
const metres = (centers: LonLat[]): MapPoint[] => {
  const midLat = centers.reduce((s, c) => s + c[1], 0) / Math.max(1, centers.length);
  const kx = Math.cos((midLat * Math.PI) / 180);
  return centers.map(([lng, lat]) => ({ x: lng * kx * M_PER_DEG, y: -lat * M_PER_DEG }));
};

/** The stops in groups that lie within `CHUNK_GAP_M` of one another on the ground (one island of real map each). */
export const stopGroups = (centers: LonLat[]): LonLat[][] =>
  clusterPoints(metres(centers), CHUNK_GAP_M).map((members) => members.map((i) => centers[i]));

/**
 * What a colour of the map stands for. Each is a theme token (`--mini-<role>`,
 * styles.css) made from the theme's own colours, so every theme gets a map
 * that fits it: wide areas stay quiet (a little accent over the page) and the
 * full accent is left to the pins and the line on top (Imhof's rule).
 */
export type MapRole = 'land' | 'side' | 'water' | 'park' | 'road' | 'shadow' | 'haze';

export const MAP_ROLES: MapRole[] = ['land', 'side', 'water', 'park', 'road', 'shadow', 'haze'];

/** A solid colour of the map; `alpha` below 1 is only for the shadow (the part is drawn as one flat shape, then faded). */
export interface MapFill {
  role: MapRole;
  alpha?: number;
}

/**
 * One piece of the map, in the unit square the stops are laid out in (so the
 * day screen's SVG and the share image's canvas draw the same thing):
 * polygons (already tilted) and polylines in one solid `fill`, drawn `dy`
 * lower and `blur` soft (the shadow). Parts are painted in order.
 */
export interface MapPart {
  fill: MapFill;
  polys: MapPoint[][];
  dy?: number;
  blur?: number;
  /** Rings of one polygon with holes (areas on a real map): filled with the even-odd rule. */
  evenodd?: boolean;
  /** Polylines (real roads), drawn `w` wide in the part's colour with round ends and joins. */
  ways?: { path: MapPoint[]; w: number }[];
  /** Only what lies inside these rings (even-odd) is drawn: the real map's features kept to the lump. */
  clip?: MapPoint[][];
  /** Also stroke the polygons in their own colour, this wide: hides the hairline seams where pieces meet. */
  seal?: number;
  /**
   * Air between the eye and the land (Imhof's aerial perspective): the part
   * is this opaque at its far (top) edge and fades out toward its near
   * (bottom) edge, so the far side of the tilted land is paler.
   */
  haze?: number;
}

const ROAD: MapFill = { role: 'road' };
/** The terrain's shadow below it: faded as a whole, and blurred. */
const SHADOW: MapFill = { role: 'shadow', alpha: 0.28 };
const SHADOW_DY = 0.045;
const SHADOW_BLUR = 0.04;
/** The land is a slab: its side shows this far below its top (unit square). */
const SIDE: MapFill = { role: 'side' };
const SIDE_DY = 0.014;
/** The far edge of the land is this much paler (the haze fades out toward the near edge). */
const HAZE: MapFill = { role: 'haze' };
const HAZE_FAR = 0.5;

/** The slab under the land's top (its side, then the shadow further down), and the haze over it: the parts that make it a tilted object. */
const slab = (polys: MapPoint[][], evenodd = false) => ({
  under: [part({ polys }, SHADOW, { dy: SHADOW_DY, blur: SHADOW_BLUR, evenodd }), part({ polys }, SIDE, { dy: SIDE_DY, evenodd })],
  over: part({ polys }, HAZE, { haze: HAZE_FAR, evenodd }),
});

/**
 * The terrain is seen from above at an angle. It is tilted as a whole: its
 * depth is squashed to `TILT` and its far (upper) edge is narrower than its
 * near one (0.55 made the land a thin band with room wasted above and below
 * it; 0.68 still reads as seen at an angle). The stops and the land go
 * through the same tilt, so the stops stay on their places.
 */
export const TILT = 0.68;
const spread = (y: number) => 0.68 + 0.64 * y;
export const tiltPoint = (p: MapPoint): MapPoint => {
  const y = 0.5 + (p.y - 0.5) * TILT;
  return { x: 0.5 + (p.x - 0.5) * spread(y), y };
};
export const untiltPoint = (p: MapPoint): MapPoint => ({ x: 0.5 + (p.x - 0.5) / spread(p.y), y: 0.5 + (p.y - 0.5) / TILT });

/** Whether `p` lies inside the polygon (ray casting). */
export function inPolygon(p: MapPoint, poly: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const distToSegment = (p: MapPoint, a: MapPoint, b: MapPoint): number => {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const part = (shape: Partial<Pick<MapPart, 'polys'>>, fill: MapFill, extra: Partial<MapPart> = {}): MapPart => ({
  polys: [],
  ...shape,
  fill,
  ...extra,
});

/**
 * What the real map is made of: the areas around the stops (lon/lat), split
 * into 읍면동, and whole neighbours; and the base map over them (land, so
 * water where there is none; parks; roads) when it could be had.
 */
export interface TerrainShapes {
  parts: AdminArea[];
  others: AdminArea[];
  base?: BaseMap | null;
}

/** One screen pixel is this many metres on the real map: neighbourhood scale, where the areas are 읍면동. */
export const TERRAIN_MPP = 30;
const M_PER_DEG = 111320;

/**
 * The real map's layout: every stop and `reach` (the corners of whatever must
 * fit) laid out at one scale (not stretched per axis as `layoutPings` does,
 * so shapes are true), centred in the unit square.
 */
export function uniformProjection(centers: LonLat[], margin = 0.14, reach: LonLat[] = [], bearing = 0, power = 1) {
  const all = [...centers, ...reach];
  const midLat = all.reduce((s, c) => s + c[1], 0) / all.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  // Below 1 the legs are evened out, and everything else is bent along with the stops.
  const flat = (c: LonLat): MapPoint => ({ x: c[0] * kx, y: -c[1] });
  const stops = centers.map(flat);
  const bend = bendField(stops, legLayout(stops, power));
  // The map may be turned by `bearing` (degrees) before it is fitted.
  const [cos, sin] = [Math.cos((bearing * Math.PI) / 180), Math.sin((bearing * Math.PI) / 180)];
  const turn = (c: LonLat): MapPoint => {
    const w = bend(flat(c));
    return { x: w.x * cos - w.y * sin, y: w.x * sin + w.y * cos };
  };
  const turned = all.map(turn);
  const [x0, x1, y0, y1] = [Math.min(...turned.map((p) => p.x)), Math.max(...turned.map((p) => p.x)), Math.min(...turned.map((p) => p.y)), Math.max(...turned.map((p) => p.y))];
  // The tilt squashes depth, so depth needs less room: fit what the tilted map will take.
  const scale = (1 - margin * 2) / Math.max(x1 - x0, (y1 - y0) * TILT, 0.004);
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const project = (c: LonLat): MapPoint => {
    const t = turn(c);
    return { x: 0.5 + (t.x - cx) * scale, y: 0.5 + (t.y - cy) * scale };
  };
  const unproject = (p: MapPoint): LonLat => {
    const [tx, ty] = [(p.x - 0.5) / scale + cx, (p.y - 0.5) / scale + cy];
    // Undo the turn, then the latitude flip (the bend is not undone: the window is only asked of the real map, power 1).
    const w = { x: tx * cos + ty * sin, y: -tx * sin + ty * cos };
    return [w.x / kx, -w.y];
  };
  // The flat layout (before the tilt) reaches further up and down than the unit square.
  const corners = [unproject({ x: 0, y: 0.5 - 0.5 / TILT }), unproject({ x: 1, y: 0.5 + 0.5 / TILT }), unproject({ x: 0, y: 0.5 + 0.5 / TILT }), unproject({ x: 1, y: 0.5 - 0.5 / TILT })];
  const window: Bbox = {
    west: Math.min(...corners.map((c) => c[0])),
    east: Math.max(...corners.map((c) => c[0])),
    south: Math.min(...corners.map((c) => c[1])),
    north: Math.max(...corners.map((c) => c[1])),
  };
  return { project, window, kx };
}

const overlaps = (a: Bbox, b: Bbox) => a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;

/** Whether the area (a multipolygon with holes) holds the point. */
const areaHolds = (area: AdminArea, c: LonLat): boolean => {
  const p = { x: c[0], y: c[1] };
  return area.polygons.some(([outer, ...holes]) => outer && inPolygon(p, outer.map(([x, y]) => ({ x, y }))) && !holes.some((h) => inPolygon(p, h.map(([x, y]) => ({ x, y })))));
};

/** The circle drawn around the stops: centred on them, reaching the farthest one (at least a few hundred metres). */
export function stopsCircle(centers: LonLat[]): { centre: LonLat; radius: number } {
  const centre: LonLat = [centers.reduce((s, c) => s + c[0], 0) / centers.length, centers.reduce((s, c) => s + c[1], 0) / centers.length];
  const kx = Math.cos((centre[1] * Math.PI) / 180);
  const radius = Math.max(0.004, ...centers.map((c) => Math.hypot((c[0] - centre[0]) * kx, c[1] - centre[1])));
  return { centre, radius };
}

/** How much land (degrees of latitude) every stop gets around it on the real map: some 600 m, more on a wide day. */
export const stopRoom = (spread: number): number => Math.max(0.0055, spread * 0.3);

/** The box the real map is fetched split into 읍면동 for: the circle around the stops, and the room around each. */
export function terrainRange(centers: LonLat[]): Bbox {
  const { centre, radius } = stopsCircle(centers);
  const room = stopRoom(radius);
  const kx = Math.cos((centre[1] * Math.PI) / 180);
  const lats = centers.map((c) => c[1]);
  const lngs = centers.map((c) => c[0]);
  return {
    west: Math.min(centre[0] - radius / kx, ...lngs.map((x) => x - room / kx)),
    east: Math.max(centre[0] + radius / kx, ...lngs.map((x) => x + room / kx)),
    south: Math.min(centre[1] - radius, ...lats.map((y) => y - room)),
    north: Math.max(centre[1] + radius, ...lats.map((y) => y + room)),
  };
}

/** Whether the circle (in degrees of latitude) touches the area: it holds its centre, or an edge of it comes within the radius. */
function areaTouchesCircle(area: AdminArea, circle: { centre: LonLat; radius: number }): boolean {
  const kx = Math.cos((circle.centre[1] * Math.PI) / 180);
  const at = (q: LonLat): MapPoint => ({ x: (q[0] - circle.centre[0]) * kx, y: q[1] - circle.centre[1] });
  const origin = { x: 0, y: 0 };
  if (areaHolds(area, circle.centre)) return true;
  return area.polygons.some((rings) =>
    rings[0] && rings[0].some((q, i) => i > 0 && distToSegment(origin, at(rings[0][i - 1]), at(q)) <= circle.radius),
  );
}

/** The convex hull of points (monotone chain). */
export function convexHull(points: MapPoint[]): MapPoint[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  if (pts.length < 3) return pts;
  const cross = (o: MapPoint, a: MapPoint, b: MapPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: MapPoint[]) => {
    const out: MapPoint[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/**
 * The region as one lump with no dents. It starts from the 읍면동 the stops
 * lie in and the ones the circle around the stops reaches (`stopsCircle`),
 * each whole, so the lump keeps the real outline of the land and every border
 * inside it. Then any area sitting in a notch of it (its middle lies inside
 * the convex hull of what is chosen) is taken in too, until nothing more
 * fills a dent.
 */
export function lumpAreas(shapes: TerrainShapes | null, centers: LonLat[], power = 1): AdminArea[] {
  if (!shapes || centers.length === 0) return [];
  // Distances drawn shorter than they are: the land between far groups of stops would be crushed, so each group keeps only its own (islands).
  if (power < 1) {
    const groups = stopGroups(centers);
    if (groups.length > 1) {
      const chosen = new Set(groups.flatMap((group) => lumpAreas(shapes, group)));
      return shapes.parts.filter((a) => chosen.has(a));
    }
  }
  const circle = stopsCircle(centers);
  // Every stop also gets a ring of land around it, so none stands on the lump's edge.
  const rings = centers.map((centre) => ({ centre, radius: stopRoom(circle.radius) }));
  const chosen = new Set(
    shapes.parts.filter((a) => centers.some((c) => areaHolds(a, c)) || areaTouchesCircle(a, circle) || rings.some((r) => areaTouchesCircle(a, r))),
  );
  if (chosen.size === 0) return [];
  const middle = (a: AdminArea): MapPoint => ({ x: (a.bbox.west + a.bbox.east) / 2, y: (a.bbox.south + a.bbox.north) / 2 });
  for (let round = 0; round < 6; round++) {
    const hull = convexHull([...chosen].flatMap((a) => a.polygons.flatMap((rings) => (rings[0] ?? []).map(([x, y]) => ({ x, y })))));
    const fill = shapes.parts.filter((a) => !chosen.has(a) && inPolygon(middle(a), hull));
    if (!fill.length) break;
    fill.forEach((a) => chosen.add(a));
  }
  return shapes.parts.filter((a) => chosen.has(a));
}

/** The lump's outline points that matter for fitting it: the corners of its convex hull. */
const lumpReach = (lump: AdminArea[]): LonLat[] =>
  convexHull(lump.flatMap((a) => a.polygons.flatMap((rings) => (rings[0] ?? []).map(([x, y]) => ({ x, y }))))).map((p) => [p.x, p.y] as LonLat);

/** The picture the pins are judged in: this many px across, as on the day screen. */
const JUDGE_PX = 330;
/** Typical size of a ping's info when the names are not known here. */
const TYPICAL_INFO = { w: 70, h: 31 };

const frames = new Map<string, number>();

/**
 * The angle (degrees) to turn the map so that the pins and their infos
 * cover one another least: tried every 15 degrees, the smallest turn wins a
 * tie. A turned map is still the true map, only with another way up.
 */
export function bestBearing(centers: LonLat[], lump: AdminArea[], power = 1): number {
  return bearingFor(centers, lumpReach(lump), power, lump.map((a) => a.code).join(','));
}

function bearingFor(centers: LonLat[], reach: LonLat[], power: number, reachKey: string): number {
  if (centers.length < 2) return 0;
  const key = `${centers.map((c) => c.join(',')).join(' ')}|${reachKey}|${power}`;
  const known = frames.get(key);
  if (known !== undefined) return known;
  const sizes = centers.map(() => TYPICAL_INFO);
  let best = { angle: 0, score: Infinity };
  for (let k = 0; k < 24; k++) {
    const angle = k === 0 ? 0 : k % 2 ? ((k + 1) / 2) * 15 : (-k / 2) * 15;
    const { project } = uniformProjection(centers, 0.1, reach, angle, power);
    const px = centers.map((c) => {
      const p = tiltPoint(project(c));
      return { x: p.x * JUDGE_PX, y: p.y * JUDGE_PX };
    });
    const score = pingOverlap(px, sizes) + Math.abs(angle) * 0.4;
    if (score < best.score) best = { angle, score };
  }
  frames.set(key, best.angle);
  return best.angle;
}

/** Room around the stops when nothing else has to fit (as `layoutPings` leaves). */
const STOPS_MARGIN = 0.18;
/** Room around a real map's lump, which reaches past the stops anyway. */
const LUMP_MARGIN = 0.1;

/**
 * Lon/lat to the view: the legs evened out (`LEG_POWER`, everything else
 * bent along), one scale, turned to part the pins, fitted with `reach`, then
 * tilted. It is one continuous mapping, so the real map's areas go through it
 * too and stay under their stops.
 */
export function stopProjection(centers: LonLat[], reach: LonLat[] = []): (c: LonLat) => MapPoint {
  const margin = reach.length ? LUMP_MARGIN : STOPS_MARGIN;
  // One way up for the day, with or without the map, so the stops do not turn when it arrives.
  const bearing = bearingFor(centers, [], LEG_POWER, '');
  const { project } = uniformProjection(centers, margin, reach, bearing, LEG_POWER);
  return (c) => tiltPoint(project(c));
}

/** The projection for a real map's lump: fitted to the whole lump. */
function terrainProject(centers: LonLat[], lump: AdminArea[]): (c: LonLat) => MapPoint {
  return stopProjection(centers, lumpReach(lump));
}

/**
 * Where the stops stand: fitted with the real map's lump when its areas are
 * known; with none (no data here, or while it is fetched) the fit is the
 * stops' own, and the pings are drawn on the page with no map.
 */
export function viewPoints(centers: LonLat[], shapes: TerrainShapes | null = null): MapPoint[] {
  if (centers.length === 0) return [];
  const lump = lumpAreas(shapes, centers, LEG_POWER);
  const project = lump.length ? terrainProject(centers, lump) : stopProjection(centers);
  return centers.map(project);
}

/** The viewport to fetch the real map for: the stops' own window at neighbourhood scale. */
export function terrainViewport(centers: LonLat[]) {
  const { window, kx } = uniformProjection(centers);
  const widthM = (window.east - window.west) * kx * M_PER_DEG;
  return { bounds: window, widthPx: Math.max(1, widthM / TERRAIN_MPP) };
}

const LAND: MapFill = { role: 'land' };
const WATER: MapFill = { role: 'water' };
const PARK: MapFill = { role: 'park' };
/** How wide the seal stroke over the seams between pieces of one fill is (unit square). */
const SEAL = 0.002;
/**
 * Road tiers the real map keeps, and their widths (unit square): only
 * motorways and trunks, the city's corridors. Main roads (tier 2) made a
 * dense white mesh at this size and took the quiet out of the land.
 */
const BIG_ROAD_WIDTH: Partial<Record<number, number>> = { 1: 0.008 };
/** Parks smaller than this across (unit square) are left out: specks, not places. */
const MIN_PARK = 0.012;

/** Douglas-Peucker: drops points closer than `tol` to the line the ones around them make. */
function simplify(ring: MapPoint[], tol: number): MapPoint[] {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let [far, at] = [0, -1];
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(ring[i], ring[a], ring[b]);
      if (d > far) [far, at] = [d, i];
    }
    if (at > 0 && far > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

/** The box (lon/lat) around the lump's areas. */
export const lumpBox = (lump: AdminArea[]): Bbox => ({
  west: Math.min(...lump.map((a) => a.bbox.west)),
  east: Math.max(...lump.map((a) => a.bbox.east)),
  south: Math.min(...lump.map((a) => a.bbox.south)),
  north: Math.max(...lump.map((a) => a.bbox.north)),
});

const pathBox = (path: LonLat[]): Bbox => ({
  west: Math.min(...path.map((p) => p[0])),
  east: Math.max(...path.map((p) => p[0])),
  south: Math.min(...path.map((p) => p[1])),
  north: Math.max(...path.map((p) => p[1])),
});

/**
 * 상세: the real map, cut to one lump. The lump's outline is that of the
 * 읍면동 around the stops (see `lumpAreas`), but what is drawn inside it is
 * what people know a place by (Lynch): water as the edges, parks as the
 * districts, the big roads as the paths, all from the base map; the borders
 * between 읍면동, which nobody sees on the ground, are not drawn. Everything
 * is projected on the same layout as the stops and tilted with it, over a soft
 * shadow. With no base map the lump is plain land. Empty when there is no data.
 */
export function terrainParts(shapes: TerrainShapes | null, centers: LonLat[]): MapPart[] {
  const lump = lumpAreas(shapes, centers, LEG_POWER);
  if (!lump.length) return [];
  const project = terrainProject(centers, lump);
  const shape = (rings: LonLat[][], tol = 0.0007) => rings.map((ring) => simplify(ring.map(project), tol)).filter((ring) => ring.length >= 4);
  const rings = lump.flatMap((a) => a.polygons.flatMap((polygon) => shape(polygon)));
  const { under, over } = slab(rings, true);
  const base = shapes?.base;
  if (!base) return [...under, part({ polys: rings }, LAND, { evenodd: true, seal: SEAL }), over];

  const box = lumpBox(lump);
  const near = (path: LonLat[]) => overlaps(pathBox(path), box);
  const polygons = (list: BaseMap['land']) => list.filter((polygon) => polygon[0] && near(polygon[0])).map((polygon) => shape(polygon)).filter((polygon) => polygon.length);
  const across = (polygon: MapPoint[][]) => {
    const xs = polygon[0].map((p) => p.x);
    const ys = polygon[0].map((p) => p.y);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const land = polygons(base.land).flat();
  const parks = polygons(base.parks).filter((polygon) => across(polygon) >= MIN_PARK).flat();
  const ways = base.roads
    .filter((road) => BIG_ROAD_WIDTH[road.tier] !== undefined && near(road.path))
    // Narrow first, so the wide roads lie over them where they meet.
    .sort((a, b) => b.tier - a.tier)
    .map((road) => ({ path: simplify(road.path.map(project), 0.001), w: BIG_ROAD_WIDTH[road.tier]! }));
  const clip = rings;
  return [
    ...under,
    // The lump is water first; the land lies over it, so the rivers are what land leaves open.
    part({ polys: rings }, WATER, { evenodd: true, seal: SEAL }),
    part({ polys: land }, LAND, { evenodd: true, seal: SEAL, clip }),
    part({ polys: parks }, PARK, { evenodd: true, clip }),
    part({}, ROAD, { ways, clip }),
    over,
  ];
}

import type { AdminArea } from './adminAreas';
import { pingOverlap } from './stopLabels';
import type { Bbox, LonLat } from './districtMap';

/**
 * 미니맵: a minimal map drawn behind a share card's stops. There is no real
 * map data in the card (stops are laid out relatively), so the "map" is
 * made of chunks: stops that lie close together are merged into one soft
 * land mass (fat discs joined by fat lines), with a fainter coast around it.
 * 거리 adds a grid of streets cut out of the land; 지도 is one land mass
 * holding every stop, with a wobbly coast; 상세 is the real map: the
 * administrative areas (읍면동) around the stops with all their borders. The abstract ones are round and soft; all of
 * them are solid terrain tilted as if seen from above at an angle, with a
 * shadow below.
 */
export type MiniMapId = 'none' | 'blob' | 'streets' | 'whole' | 'detail';

export const MINI_MAPS: { id: MiniMapId; label: string }[] = [
  { id: 'none', label: '없음' },
  { id: 'blob', label: '덩어리' },
  { id: 'streets', label: '거리' },
  { id: 'whole', label: '지도' },
  { id: 'detail', label: '상세' },
];

/** The day screen's one switch steps through the styles: 없음 → 덩어리 → 거리 → 지도 → 상세 → 없음. */
export const nextMiniMap = (id: MiniMapId): MiniMapId => MINI_MAPS[(MINI_MAPS.findIndex((m) => m.id === id) + 1) % MINI_MAPS.length].id;

export const isMiniMapId = (v: unknown): v is MiniMapId => MINI_MAPS.some((m) => m.id === v);

/**
 * 거리: how true the distances between the stops are, apart from how the land
 * is drawn (the map's shape above). Five steps on one scale: every leg (one
 * stop to the next) keeps its direction, and its length is raised to `power`
 * (against the legs' typical length): 0 makes all legs the same length, 1 is
 * the real map. The land under the stops is bent along with them.
 */
export type MapDistance = 'even' | 'strong' | 'half' | 'light' | 'true';

export const MAP_DISTANCES: { id: MapDistance; label: string; power: number }[] = [
  { id: 'even', label: '균등', power: 0 },
  { id: 'strong', label: '강하게', power: 0.25 },
  { id: 'half', label: '중간', power: 0.5 },
  { id: 'light', label: '약하게', power: 0.75 },
  { id: 'true', label: '실제', power: 1 },
];

export const DEFAULT_DISTANCE: MapDistance = 'half';

export const isMapDistance = (v: unknown): v is MapDistance => MAP_DISTANCES.some((m) => m.id === v);

/** A stored setting, including the names the three-step scale used ('relative' had no place on this one). */
export const readMapDistance = (v: unknown): MapDistance | undefined => (isMapDistance(v) ? v : v === 'squashed' ? 'half' : undefined);

export const nextMapDistance = (id: MapDistance): MapDistance =>
  MAP_DISTANCES[(MAP_DISTANCES.findIndex((m) => m.id === id) + 1) % MAP_DISTANCES.length].id;

const powerOf = (id: MapDistance): number => MAP_DISTANCES.find((m) => m.id === id)?.power ?? 1;

/** A day's (or card's) map as both settings. */
export interface MiniMapView {
  shape: MiniMapId;
  distance: MapDistance;
}

export const miniMapView = (shape: MiniMapId | undefined, distance: MapDistance | undefined): MiniMapView => ({
  shape: shape ?? 'none',
  distance: distance ?? DEFAULT_DISTANCE,
});

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

/** Stops closer than this (a fraction of the drawing box) share one chunk. */
export const CHUNK_GAP = 0.95;
/** Stops this close on the ground (metres) share one chunk, whatever the distances are drawn as. */
export const CHUNK_GAP_M = 1500;
/** A chunk's disc radius around a stop, a fraction of the drawing box. */
export const CHUNK_RADIUS = 0.14;

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

export interface MiniMapChunk {
  /** Disc centres. */
  discs: MapPoint[];
  /** Fat lines joining discs within the gap. */
  links: [MapPoint, MapPoint][];
  centre: MapPoint;
}

/** Lon/lat as metres east and south (only differences matter). */
const metres = (centers: LonLat[]): MapPoint[] => {
  const midLat = centers.reduce((s, c) => s + c[1], 0) / Math.max(1, centers.length);
  const kx = Math.cos((midLat * Math.PI) / 180);
  return centers.map(([lng, lat]) => ({ x: lng * kx * M_PER_DEG, y: -lat * M_PER_DEG }));
};

/** The stops in groups that lie within `CHUNK_GAP_M` of one another on the ground (one chunk, one island of real map). */
export const stopGroups = (centers: LonLat[]): LonLat[][] =>
  clusterPoints(metres(centers), CHUNK_GAP_M).map((members) => members.map((i) => centers[i]));

/**
 * The chunks for these points: `gap` is in the points' own units, or, when
 * `ground` (the same stops in metres) is given, in metres on the ground.
 */
export function miniMapChunks(points: MapPoint[], gap: number, ground?: MapPoint[]): MiniMapChunk[] {
  const judged = ground ?? points;
  return clusterPoints(judged, gap).map((members) => {
    const discs = members.map((i) => points[i]);
    const links: [MapPoint, MapPoint][] = [];
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const [p, q] = [judged[members[a]], judged[members[b]]];
        if (Math.hypot(p.x - q.x, p.y - q.y) <= gap) links.push([points[members[a]], points[members[b]]]);
      }
    }
    const centre = {
      x: discs.reduce((s, p) => s + p.x, 0) / discs.length,
      y: discs.reduce((s, p) => s + p.y, 0) / discs.length,
    };
    return { discs, links, centre };
  });
}

/** Street lines (a skewed grid) across a square at (x, y) of `size`, as segments. */
export function streetGrid(x: number, y: number, size: number, step: number, angleDeg = -18): [MapPoint, MapPoint][] {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const a = (angleDeg * Math.PI) / 180;
  const rot = (px: number, py: number): MapPoint => ({
    x: cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a),
    y: cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a),
  });
  const reach = size * 0.9;
  const out: [MapPoint, MapPoint][] = [];
  for (let d = -reach; d <= reach; d += step) {
    out.push([rot(cx + d, cy - reach), rot(cx + d, cy + reach)]);
    out.push([rot(cx - reach, cy + d), rot(cx + reach, cy + d)]);
  }
  return out;
}

/** A line of the drawing: from `a` to `b`, `w` wide (unit square). */
export interface MapSegment {
  a: MapPoint;
  b: MapPoint;
  w: number;
}

/**
 * What a colour of the map stands for. Each is a theme token (`--mini-<role>`,
 * styles.css) made from the theme's own colours, so every theme gets a map
 * that fits it: wide areas stay quiet (a little accent over the page) and the
 * full accent is left to the pins and the line on top (Imhof's rule).
 */
export type MapRole = 'land' | 'side' | 'water' | 'park' | 'road' | 'shadow';

export const MAP_ROLES: MapRole[] = ['land', 'side', 'water', 'park', 'road', 'shadow'];

/** A solid colour of the map; `alpha` below 1 is only for the shadow (the part is drawn as one flat shape, then faded). */
export interface MapFill {
  role: MapRole;
  alpha?: number;
}

/**
 * One piece of the map, in the unit square the stops are laid out in (so the
 * day screen's SVG and the share image's canvas draw the same thing): polygons
 * (the land, already tilted) and thin lines (streets) in one solid `fill`,
 * drawn `dy` lower and `blur` soft (the shadow). Parts are painted in order.
 */
export interface MapPart {
  fill: MapFill;
  polys: MapPoint[][];
  lines: MapSegment[];
  dy?: number;
  blur?: number;
  /** Rings of one polygon with holes (areas on a real map): filled with the even-odd rule. */
  evenodd?: boolean;
  /** Cut the polygons' own outlines out of the part, this wide: the borders between areas become see-through gaps. */
  gaps?: number;
}

const TOP: MapFill = { role: 'land' };
const ROAD: MapFill = { role: 'road' };
/** The terrain's shadow below it: faded as a whole, and blurred. */
const SHADOW: MapFill = { role: 'shadow', alpha: 0.28 };
const SHADOW_DY = 0.045;
const SHADOW_BLUR = 0.04;

/**
 * The terrain is seen from above at an angle. It is tilted as a whole: its
 * depth is squashed to `TILT` and its far (upper) edge is narrower than its
 * near one. The stops stay where they are laid out, so the land is built flat
 * around where they would lie before the tilt (`untiltPoint`) and then tilted
 * (`tiltPoint`): they end up on it.
 */
export const TILT = 0.55;
const spread = (y: number) => 0.68 + 0.64 * y;
export const tiltPoint = (p: MapPoint): MapPoint => {
  const y = 0.5 + (p.y - 0.5) * TILT;
  return { x: 0.5 + (p.x - 0.5) * spread(y), y };
};
export const untiltPoint = (p: MapPoint): MapPoint => ({ x: 0.5 + (p.x - 0.5) / spread(p.y), y: 0.5 + (p.y - 0.5) / TILT });

const hash = (points: MapPoint[]): number => {
  let h = 2166136261;
  for (const p of points) {
    h = Math.imul(h ^ Math.round(p.x * 1000), 16777619);
    h = Math.imul(h ^ Math.round(p.y * 1000), 16777619);
  }
  return h >>> 0;
};

/** A small seeded random source: the same stops always give the same map. */
const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

const WHOLE_STEPS = 72;
/** How far the whole land reaches past its outermost stops (unit square). */
const WHOLE_PAD = 0.14;

/**
 * 지도: one round, soft land mass around every stop. Its reach in each
 * direction is the farthest stop that way, smoothed well and given a margin
 * with a gentle seeded swell: a lump with no corners, always holding every stop.
 */
export function wholeOutline(points: MapPoint[], extra = 0): { outline: MapPoint[]; centre: MapPoint; radii: number[] } {
  const centre = {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
  const rnd = seeded(hash(points));
  const [p1, p2] = [rnd() * Math.PI * 2, rnd() * Math.PI * 2];
  const reach = Array.from({ length: WHOLE_STEPS }, (_, k) => {
    const t = (k / WHOLE_STEPS) * Math.PI * 2;
    return Math.max(0, ...points.map((p) => (p.x - centre.x) * Math.cos(t) + (p.y - centre.y) * Math.sin(t)));
  });
  const smooth = (r: number[], passes: number) => {
    let out = r;
    for (let pass = 0; pass < passes; pass++) {
      const prev = out;
      out = prev.map((v, k) => (prev[(k + WHOLE_STEPS - 2) % WHOLE_STEPS] + 2 * prev[(k + WHOLE_STEPS - 1) % WHOLE_STEPS] + 3 * v + 2 * prev[(k + 1) % WHOLE_STEPS] + prev[(k + 2) % WHOLE_STEPS]) / 9);
    }
    return out;
  };
  const base = smooth(reach, 10);
  const radii = smooth(
    base.map((v, k) => {
      const t = (k / WHOLE_STEPS) * Math.PI * 2;
      const swell = 1 + 0.12 * Math.sin(2 * t + p1) + 0.07 * Math.sin(3 * t + p2);
      return Math.max(v + WHOLE_PAD * swell, reach[k] + WHOLE_PAD * 0.6, 0.15);
    }),
    6,
  ).map((v, k) => Math.max(v, reach[k] + WHOLE_PAD * 0.5));
  const outline = radii.map((r, k) => {
    const t = (k / WHOLE_STEPS) * Math.PI * 2;
    return { x: centre.x + (r + extra) * Math.cos(t), y: centre.y + (r + extra) * Math.sin(t) };
  });
  return { outline, centre, radii };
}

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

/** Keeps the stretches of `segs` that lie inside the land (sampled every `step`). */
export function clipSegments(segs: MapSegment[], inside: (p: MapPoint) => boolean, step = 0.012): MapSegment[] {
  const out: MapSegment[] = [];
  for (const s of segs) {
    const n = Math.max(1, Math.ceil(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) / step));
    let from: MapPoint | null = null;
    let last: MapPoint | null = null;
    const close = () => {
      if (from && last && from !== last) out.push({ a: from, b: last, w: s.w });
      from = null;
      last = null;
    };
    for (let i = 0; i <= n; i++) {
      const p = { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n };
      if (inside(p)) {
        from ??= p;
        last = p;
      } else close();
    }
    close();
  }
  return out;
}

const part = (shape: Partial<Pick<MapPart, 'polys' | 'lines'>>, fill: MapFill, extra: Partial<MapPart> = {}): MapPart => ({
  polys: [],
  lines: [],
  ...shape,
  fill,
  ...extra,
});

/**
 * Keeps the tilted land inside the square the card crops to without cutting
 * it flat and without leaving the pins behind: only what lies past the pins
 * (and a pin's width more) is drawn in, toward the edges.
 */
function fitAround(flat: MapPoint[][], pins: MapPoint[]): (p: MapPoint) => MapPoint {
  const xs = flat.flatMap((poly) => poly.map((q) => tiltPoint(q).x));
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
  const PIN = 0.07;
  const EDGE = 0.01;
  const [a, b] = [Math.min(0.5, ...pins.map((p) => p.x - PIN)), Math.max(0.5, ...pins.map((p) => p.x + PIN))];
  const left = lo < EDGE && a > EDGE ? (x: number) => a - ((a - x) * (a - EDGE)) / (a - lo) : (x: number) => x;
  const right = hi > 1 - EDGE && b < 1 - EDGE ? (x: number) => b + ((x - b) * (1 - EDGE - b)) / (hi - b) : (x: number) => x;
  return (q) => {
    const p = tiltPoint(q);
    return { x: p.x < a ? left(p.x) : p.x > b ? right(p.x) : p.x, y: p.y };
  };
}

/** The land (flat polygons), tilted and fitted around the pins, with its shadow below it. */
function terrain(flat: MapPoint[][], at: (q: MapPoint) => MapPoint): MapPart[] {
  const polys = flat.map((poly) => poly.map(at));
  return [part({ polys }, SHADOW, { dy: SHADOW_DY, blur: SHADOW_BLUR }), part({ polys }, TOP)];
}

/** How far above its stop a pin's head reaches, in the flat (untilted) square. */
const PIN_HEAD = 0.22;

/** A segment of the field: land gathers around it, `weight` of a stop's. */
interface FieldSource {
  a: MapPoint;
  b: MapPoint;
  weight: number;
}

/** How soft a source's edge is against `CHUNK_RADIUS`: the field falls off over this many radii. */
const FIELD_SOFTNESS = 0.8;
/** The field's level where the coast is: a lone stop's land then reaches `CHUNK_RADIUS`. */
const COAST = Math.exp(-1 / (FIELD_SOFTNESS * FIELD_SOFTNESS));
/** A link between two stops is a little weaker than a stop: the land narrows between them, like an isthmus. */
const LINK_WEIGHT = 0.82;
/** How much the seeded swell moves the coast in and out (a fraction of the field). */
const SWELL = 0.16;
/** The grid the coast is traced on (flat unit square). */
const FIELD_STEP = 0.01;

/**
 * Land as a field (metaballs): every source adds a soft bump that falls off
 * with distance from it, so sources near one another flow into one rounded
 * shape with no seams, and a gentle seeded swell keeps the coast from looking
 * drawn with a compass. The same sources always give the same land.
 */
function landField(sources: FieldSource[], seed: number): (p: MapPoint) => number {
  const sigma = CHUNK_RADIUS * FIELD_SOFTNESS;
  const rnd = seeded(seed);
  const waves = Array.from({ length: 3 }, () => {
    const turn = rnd() * Math.PI * 2;
    const k = (2 * Math.PI) / (0.35 + rnd() * 0.3);
    return { kx: Math.cos(turn) * k, ky: Math.sin(turn) * k, phase: rnd() * Math.PI * 2 };
  });
  return (p) => {
    let sum = 0;
    for (const { a, b, weight } of sources) sum += weight * Math.exp(-((distToSegment(p, a, b) / sigma) ** 2));
    const swell = waves.reduce((s, w) => s + Math.sin(w.kx * p.x + w.ky * p.y + w.phase), 0) / waves.length;
    return sum * (1 + SWELL * swell);
  };
}

/**
 * The closed coasts where `field` crosses `level`, traced on a grid over
 * `box` (marching squares, the crossing found between grid points). Saddles
 * are settled by the cell's middle. Coasts inside another (lakes) are left
 * out: the land is filled whole.
 */
export function traceCoasts(field: (p: MapPoint) => number, level: number, box: { x0: number; y0: number; x1: number; y1: number }, step = FIELD_STEP): MapPoint[][] {
  // One empty cell all round, so every coast closes.
  const nx = Math.ceil((box.x1 - box.x0) / step) + 3;
  const ny = Math.ceil((box.y1 - box.y0) / step) + 3;
  const at = (i: number, j: number): MapPoint => ({ x: box.x0 + (i - 1) * step, y: box.y0 + (j - 1) * step });
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 ? 0 : field(at(i, j));
  const val = (i: number, j: number) => v[j * nx + i];
  // Grid edges: horizontal `h` from (i, j) to (i+1, j), vertical `v` from (i, j) to (i, j+1).
  const cross = (key: string): MapPoint => {
    const [kind, si, sj] = key.split(':');
    const [i, j] = [Number(si), Number(sj)];
    const [i2, j2] = kind === 'h' ? [i + 1, j] : [i, j + 1];
    const [p, q] = [at(i, j), at(i2, j2)];
    const [a, b] = [val(i, j), val(i2, j2)];
    const t = a === b ? 0.5 : (level - a) / (b - a);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  };
  const links = new Map<string, string[]>();
  const join = (e: string, f: string) => {
    links.set(e, [...(links.get(e) ?? []), f]);
    links.set(f, [...(links.get(f) ?? []), e]);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const [a, b, c, d] = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)].map((x) => x > level);
      const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const [top, right, bottom, left] = [`h:${i}:${j}`, `v:${i + 1}:${j}`, `h:${i}:${j + 1}`, `v:${i}:${j}`];
      const middle = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 > level;
      const pairs: Record<number, [string, string][]> = {
        1: [[left, bottom]],
        2: [[bottom, right]],
        3: [[left, right]],
        4: [[top, right]],
        5: middle ? [[left, top], [bottom, right]] : [[left, bottom], [top, right]],
        6: [[top, bottom]],
        7: [[left, top]],
        8: [[left, top]],
        9: [[top, bottom]],
        10: middle ? [[left, bottom], [top, right]] : [[left, top], [bottom, right]],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };
      for (const [e, f] of pairs[code]) join(e, f);
    }
  }
  const rings: MapPoint[][] = [];
  const used = new Set<string>();
  for (const start of links.keys()) {
    if (used.has(start)) continue;
    const ring: MapPoint[] = [];
    let [prev, cur] = ['', start];
    while (cur && !used.has(cur)) {
      used.add(cur);
      ring.push(cross(cur));
      const next = (links.get(cur) ?? []).find((e) => e !== prev && !used.has(e));
      [prev, cur] = [cur, next ?? ''];
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings.filter((ring, k) => !rings.some((other, m) => m !== k && inPolygon(ring[0], other)));
}

/**
 * 덩어리: every chunk of stops as one organic island. Each stop raises the
 * land from where it lies up to its pin's head, and the links of its chunk a
 * little less, so the stops of a chunk flow into one rounded island that
 * narrows between them; chunks are traced apart, so they stay islands.
 */
function chunkIslands(chunks: MiniMapChunk[], head: (q: MapPoint) => MapPoint): MapPoint[][] {
  return chunks.flatMap((c) => {
    const sources: FieldSource[] = [
      ...c.discs.map((d) => ({ a: d, b: head(d), weight: 1 })),
      ...c.links.map(([a, b]) => ({ a, b, weight: LINK_WEIGHT })),
    ];
    const ends = sources.flatMap((s) => [s.a, s.b]);
    const reach = CHUNK_RADIUS * 2.4;
    const box = {
      x0: Math.min(...ends.map((p) => p.x)) - reach,
      y0: Math.min(...ends.map((p) => p.y)) - reach,
      x1: Math.max(...ends.map((p) => p.x)) + reach,
      y1: Math.max(...ends.map((p) => p.y)) + reach,
    };
    return traceCoasts(landField(sources, hash(c.discs)), COAST, box);
  });
}

/** A cross of four taps around `p`, all inside: keeps what is drawn off the land's very edge. */
const within = (base: (p: MapPoint) => boolean, margin: number) => (p: MapPoint) =>
  base(p) &&
  base({ x: p.x + margin, y: p.y }) &&
  base({ x: p.x - margin, y: p.y }) &&
  base({ x: p.x, y: p.y + margin }) &&
  base({ x: p.x, y: p.y - margin });

/**
 * The parts of a map style over these stops (unit square), back to front;
 * none for 없음. The land is built flat around where the stops lie before
 * the tilt, then tilted (see `tiltPoint`).
 */
export function miniMapLayers(points: MapPoint[], style: MiniMapId, centers?: LonLat[]): MapPart[] {
  if (style === 'none' || points.length === 0) return [];
  const flat = points.map(untiltPoint);
  // A pin stands up from its stop: the land also reaches past each pin's head.
  const head = (q: MapPoint) => ({ x: q.x, y: q.y - PIN_HEAD });
  const headroom = flat.flatMap((q) => [q, head(q)]);
  if (style === 'whole') {
    const outline = [wholeOutline(headroom).outline];
    return terrain(outline, fitAround(outline, points));
  }
  // 상세 is the real map (terrainParts), drawn from its own data.
  if (style === 'detail') return [];
  // Which stops share a chunk is judged on the ground when it is known, so the chunks stay the same whatever the distances are drawn as.
  const chunks = centers?.length === points.length ? miniMapChunks(flat, CHUNK_GAP_M, metres(centers)) : miniMapChunks(flat, CHUNK_GAP);
  const islands = chunkIslands(chunks, head);
  const at = fitAround(islands, points);
  const parts = terrain(islands, at);
  if (style === 'streets') {
    // Streets on the land: a skewed grid kept to the islands, tilted and fitted with them.
    const near = (p: MapPoint) => islands.some((ring) => inPolygon(p, ring));
    const grid = streetGrid(0, 0, 1, 74 / 864).map(([a, b]) => ({ a, b, w: 0.011 }));
    const lines = clipSegments(grid, within(near, 0.02)).map(({ a, b, w }) => ({ a: at(a), b: at(b), w: w * 0.8 }));
    parts.push(part({ lines }, ROAD));
  }
  return parts;
}

/** What the real map is made of: the areas around the stops (lon/lat), split into 읍면동, and whole neighbours. */
export interface TerrainShapes {
  parts: AdminArea[];
  others: AdminArea[];
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
 * Lon/lat to the view, by the distance setting: the legs evened out by its
 * power (everything else bent along), one scale, turned to part the pins,
 * fitted with `reach`, then tilted. It is one continuous mapping, so a real
 * map's areas go through it too and stay under their stops at every setting.
 */
export function stopProjection(centers: LonLat[], distance: MapDistance, reach: LonLat[] = []): (c: LonLat) => MapPoint {
  const margin = reach.length ? LUMP_MARGIN : STOPS_MARGIN;
  const power = powerOf(distance);
  // One way up for the day, whatever the distance step or shape, so stepping through them only moves the stops along their legs.
  const bearing = bearingFor(centers, [], powerOf(DEFAULT_DISTANCE), '');
  const { project } = uniformProjection(centers, margin, reach, bearing, power);
  return (c) => tiltPoint(project(c));
}

/** The projection for a real map's lump: fitted to the whole lump. */
function terrainProject(centers: LonLat[], lump: AdminArea[], distance: MapDistance): (c: LonLat) => MapPoint {
  return stopProjection(centers, distance, lumpReach(lump));
}

/**
 * Where the stops stand: laid out by the distance setting, fitted with the
 * real map's lump when that is the shape (and its areas are known). With no
 * areas the fit is the stops' own, as for the abstract shapes, so a 상세 that
 * falls back to 지도 keeps its stops where they were.
 */
export function viewPoints(centers: LonLat[], view: MiniMapView = miniMapView('none', undefined), shapes: TerrainShapes | null = null): MapPoint[] {
  if (centers.length === 0) return [];
  const lump = view.shape === 'detail' ? lumpAreas(shapes, centers, powerOf(view.distance)) : [];
  const project = lump.length ? terrainProject(centers, lump, view.distance) : stopProjection(centers, view.distance);
  return centers.map(project);
}

/** The viewport to fetch the real map for: the stops' own window at neighbourhood scale. */
export function terrainViewport(centers: LonLat[]) {
  const { window, kx } = uniformProjection(centers);
  const widthM = (window.east - window.west) * kx * M_PER_DEG;
  return { bounds: window, widthPx: Math.max(1, widthM / TERRAIN_MPP) };
}

/** The lump's one tone, and how wide the see-through gap between two areas is. */
const LAND: MapFill = { role: 'land' };
const GAP_W = 0.005;

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

/**
 * 상세: the real map as one lump. The areas of the lump (see `lumpAreas`)
 * keep their own angular outlines, projected on the same layout as the stops
 * and tilted with it, in one tone and parted by see-through gaps where their
 * borders are; a soft shadow lies below, unbroken, so it shows through the gaps. Nothing is cut to a window.
 * Empty when there is no data.
 */
export function terrainParts(shapes: TerrainShapes | null, centers: LonLat[], distance: MapDistance = 'true'): MapPart[] {
  const lump = lumpAreas(shapes, centers, powerOf(distance));
  if (!lump.length) return [];
  const project = terrainProject(centers, lump, distance);
  const areas = lump.flatMap((a) =>
    a.polygons.map((rings) => ({
      code: a.code,
      rings: rings.map((ring) => simplify(ring.map(project), 0.0007)).filter((ring) => ring.length >= 4),
    })),
  ).filter((a) => a.rings.length);
  const rings = areas.flatMap((a) => a.rings);
  return [
    // The shadow: the areas' shapes, below them, soft and whole, so it shows through the gaps between the areas.
    part({ polys: rings }, SHADOW, { dy: SHADOW_DY, blur: SHADOW_BLUR, evenodd: true }),
    // The areas in one tone, parted by see-through gaps where their borders are.
    part({ polys: rings }, LAND, { evenodd: true, gaps: GAP_W }),
  ];
}

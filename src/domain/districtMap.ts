import * as clipperNs from 'clipper-lib';

// clipper-lib is CommonJS (`module.exports = ClipperLib`); depending on the
// bundler/test runner the namespace import is either the object itself or
// wraps it in `default`.
const ClipperLib = ((clipperNs as unknown as { default?: typeof clipperNs }).default ?? clipperNs) as typeof clipperNs;

export type LonLat = [number, number];
export type Ring = LonLat[];

export type RoadKind = 'major' | 'minor';

export interface RoadSegment {
  kind: RoadKind;
  path: LonLat[];
  /** One carriageway of a divided road, drawn in its travel direction. */
  oneway?: boolean;
  name?: string;
}

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** A city block: the land between roads, with rounded corners. */
export interface DistrictBlock {
  outer: Ring;
  holes: Ring[];
}

/**
 * The illustrated-map look (see docs): everything outside the blocks is the
 * "road" color, so roads are simply the gaps between blocks.
 */
export interface DistrictMap {
  region: Ring;
  blocks: DistrictBlock[];
}

/** What the map is showing: its bounds and how many CSS pixels wide it is. */
export interface MapViewport {
  bounds: Bbox;
  widthPx: number;
}

export interface CourseRegion {
  /** Rounded hull around the stops; blocks are only generated inside it. */
  region: Ring;
  bbox: Bbox;
  /** Residential streets make a large area unreadable (and a heavy fetch). */
  includeMinor: boolean;
}

export interface DistrictOptions {
  majorWidth: number;
  minorWidth: number;
  /** Corner radius of blocks, in meters. */
  cornerRadius: number;
  /** Blocks smaller than this (m²) are slivers, not places. */
  minBlockArea: number;
}

export const DEFAULT_DISTRICT_OPTIONS: DistrictOptions = {
  majorWidth: 30,
  minorWidth: 18,
  cornerRadius: 22,
  minBlockArea: 1500,
};

// Real road widths are meters, but a 30m road is a hairline zoomed out and a
// highway zoomed in; the drawing reads best when every road stays in this band.
const MIN_ROAD_PX = 4;
const MAX_ROAD_PX = 8;
// A radius fixed in meters would erase every strip of land narrower than
// twice itself once zoomed in, turning it into an oversized road gap.
const MAX_CORNER_PX = 8;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Road widths for a zoom level, kept between 4 and 8 screen pixels. */
export function districtOptionsFor(
  metersPerPixel: number,
  base: DistrictOptions = DEFAULT_DISTRICT_OPTIONS,
): DistrictOptions {
  const lo = MIN_ROAD_PX * metersPerPixel;
  const hi = MAX_ROAD_PX * metersPerPixel;
  return {
    ...base,
    majorWidth: clamp(base.majorWidth, lo, hi),
    minorWidth: clamp(base.minorWidth, lo, hi),
    cornerRadius: Math.min(base.cornerRadius, MAX_CORNER_PX * metersPerPixel),
  };
}

export function metersPerPixel({ bounds, widthPx }: MapViewport): number {
  const kx = M_PER_DEG_LON_EQ * Math.cos((((bounds.south + bounds.north) / 2) * Math.PI) / 180);
  return ((bounds.east - bounds.west) * kx) / Math.max(widthPx, 1);
}

/** Beyond this the course is a trip, not a neighborhood — no illustration. */
export const MAX_REGION_DIAGONAL_M = 9000;
const MINOR_ROADS_MAX_DIAGONAL_M = 1600;
/** Residential streets only once the screen is neighborhood-sized. */
const VIEWPORT_MINOR_MAX_DIAGONAL_M = 2500;
/** Extra area fetched around the screen, so small pans need no refetch. */
const VIEWPORT_PADDING = 0.25;

// Clipper works on integers: decimeters keep rounding invisible at any zoom.
const SCALE = 10;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQ = 111_320;

/** Local equirectangular projection — plenty accurate for a few km. */
class LocalProjection {
  private readonly kx: number;
  constructor(private readonly origin: LonLat) {
    this.kx = M_PER_DEG_LON_EQ * Math.cos((origin[1] * Math.PI) / 180);
  }
  toPoint([lon, lat]: LonLat): ClipperLib.IntPoint {
    return {
      X: Math.round((lon - this.origin[0]) * this.kx * SCALE),
      Y: Math.round((lat - this.origin[1]) * M_PER_DEG_LAT * SCALE),
    };
  }
  toLonLat(p: ClipperLib.IntPoint): LonLat {
    return [this.origin[0] + p.X / SCALE / this.kx, this.origin[1] + p.Y / SCALE / M_PER_DEG_LAT];
  }
}

const offset = (
  paths: ClipperLib.Paths,
  deltaMeters: number,
  endType: ClipperLib.EndType,
): ClipperLib.Paths => {
  // 0.4m arc tolerance: smooth curves without thousands of vertices.
  const co = new ClipperLib.ClipperOffset(2, 0.4 * SCALE);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, endType);
  const out: ClipperLib.Paths = [];
  co.Execute(out, deltaMeters * SCALE);
  return out;
};

const cross = (o: ClipperLib.IntPoint, a: ClipperLib.IntPoint, b: ClipperLib.IntPoint) =>
  (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);

/** Andrew's monotone chain. Degenerates to 1–2 points for 1–2 stops. */
export function convexHull(points: ClipperLib.IntPoint[]): ClipperLib.IntPoint[] {
  const sorted = [...points].sort((a, b) => a.X - b.X || a.Y - b.Y);
  const unique = sorted.filter((p, i) => i === 0 || p.X !== sorted[i - 1].X || p.Y !== sorted[i - 1].Y);
  if (unique.length < 3) return unique;
  const lower: ClipperLib.IntPoint[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: ClipperLib.IntPoint[] = [];
  for (const p of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const centroid = (points: LonLat[]): LonLat => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];

const bboxOf = (ring: Ring): Bbox => ({
  west: Math.min(...ring.map((p) => p[0])),
  south: Math.min(...ring.map((p) => p[1])),
  east: Math.max(...ring.map((p) => p[0])),
  north: Math.max(...ring.map((p) => p[1])),
});

/**
 * The area worth illustrating for a course: the stops' hull grown by a margin
 * that scales with the course, so a two-stop walk still gets a neighborhood.
 * Returns null when there is nothing to draw or the course is city-scale.
 */
export function courseRegion(stops: LonLat[]): CourseRegion | null {
  if (stops.length === 0) return null;
  const projection = new LocalProjection(centroid(stops));
  const points = stops.map((s) => projection.toPoint(s));
  const xs = points.map((p) => p.X);
  const ys = points.map((p) => p.Y);
  const spread = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / SCALE;
  const margin = Math.min(Math.max(spread * 0.3, 280), 700);
  const diagonal = spread + margin * 2;
  if (diagonal > MAX_REGION_DIAGONAL_M) return null;

  const hull = convexHull(points);
  // A hull of 1–2 points is an open path; offsetting it gives a disc/capsule.
  const grown =
    hull.length < 3
      ? offset([hull], margin, ClipperLib.EndType.etOpenRound)
      : offset([hull], margin, ClipperLib.EndType.etClosedPolygon);
  if (grown.length === 0) return null;
  const region = grown[0].map((p) => projection.toLonLat(p));
  return { region, bbox: bboxOf(region), includeMinor: diagonal <= MINOR_ROADS_MAX_DIAGONAL_M };
}

const bboxDiagonalMeters = (b: Bbox): number => {
  const kx = M_PER_DEG_LON_EQ * Math.cos((((b.south + b.north) / 2) * Math.PI) / 180);
  return Math.hypot((b.east - b.west) * kx, (b.north - b.south) * M_PER_DEG_LAT);
};

export const bboxContains = (outer: Bbox, inner: Bbox): boolean =>
  inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;

/**
 * The area worth illustrating for what's on screen: the viewport grown on
 * every side, so the eroded (rounded) region edge stays off-screen.
 * Returns null when the screen is city-scale — the basemap is more useful then.
 */
export function viewportRegion(viewport: Bbox): CourseRegion | null {
  const diagonal = bboxDiagonalMeters(viewport);
  if (!(diagonal > 0) || diagonal > MAX_REGION_DIAGONAL_M) return null;
  const dx = (viewport.east - viewport.west) * VIEWPORT_PADDING;
  const dy = (viewport.north - viewport.south) * VIEWPORT_PADDING;
  const bbox = { west: viewport.west - dx, south: viewport.south - dy, east: viewport.east + dx, north: viewport.north + dy };
  const region: Ring = [
    [bbox.west, bbox.south],
    [bbox.east, bbox.south],
    [bbox.east, bbox.north],
    [bbox.west, bbox.north],
  ];
  return { region, bbox, includeMinor: diagonal <= VIEWPORT_MINOR_MAX_DIAGONAL_M };
}

// OSM ways share junction nodes, and Overpass prints them with 7 decimals.
const nodeKey = ([lon, lat]: LonLat) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

/** Widest median still treated as one road (Korean 8–10 lane roads). */
const MAX_MEDIAN_M = 45;
const GRID_M = 50;

/**
 * Collapses the two carriageways of a divided road onto their midline.
 * OSM draws each direction as its own oneway way; drawn as-is the median
 * between them is too thin to survive as a block, so the road becomes a gap
 * several times wider than any other. Each carriageway vertex moves halfway
 * toward the nearest opposite-direction carriageway (same name when both are
 * named). Moves are keyed by node, so side streets that meet the carriageway
 * follow it and stay connected.
 */
export function mergeDualCarriageways(roads: RoadSegment[], maxMedianM = MAX_MEDIAN_M): RoadSegment[] {
  const oneways = roads.filter((r) => r.oneway && r.path.length >= 2);
  if (oneways.length < 2) return roads;
  const all = oneways.flatMap((r) => r.path);
  const origin = centroid(all);
  const kx = M_PER_DEG_LON_EQ * Math.cos((origin[1] * Math.PI) / 180);
  const toM = ([lon, lat]: LonLat): [number, number] => [(lon - origin[0]) * kx, (lat - origin[1]) * M_PER_DEG_LAT];
  const toLonLat = ([x, y]: [number, number]): LonLat => [origin[0] + x / kx, origin[1] + y / M_PER_DEG_LAT];

  interface Seg {
    road: number;
    a: [number, number];
    b: [number, number];
    dir: [number, number];
  }
  const grid = new Map<string, Seg[]>();
  const metric = oneways.map((r) => r.path.map(toM));
  metric.forEach((path, road) => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len === 0) continue;
      const seg: Seg = { road, a, b, dir: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
      for (let gx = Math.floor(Math.min(a[0], b[0]) / GRID_M); gx <= Math.floor(Math.max(a[0], b[0]) / GRID_M); gx++) {
        for (let gy = Math.floor(Math.min(a[1], b[1]) / GRID_M); gy <= Math.floor(Math.max(a[1], b[1]) / GRID_M); gy++) {
          const k = `${gx},${gy}`;
          const list = grid.get(k);
          if (list) list.push(seg);
          else grid.set(k, [seg]);
        }
      }
    }
  });

  const moved = new Map<string, LonLat>();
  metric.forEach((path, road) => {
    const name = oneways[road].name;
    path.forEach((p, i) => {
      const key = nodeKey(oneways[road].path[i]);
      if (moved.has(key)) return;
      const prev = path[Math.max(i - 1, 0)];
      const next = path[Math.min(i + 1, path.length - 1)];
      const len = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
      if (len === 0) return;
      const dir = [(next[0] - prev[0]) / len, (next[1] - prev[1]) / len];
      let best: [number, number] | null = null;
      let bestDist = maxMedianM;
      const reach = Math.ceil(maxMedianM / GRID_M);
      const cx = Math.floor(p[0] / GRID_M);
      const cy = Math.floor(p[1] / GRID_M);
      const seen = new Set<Seg>();
      for (let gx = cx - reach; gx <= cx + reach; gx++) {
        for (let gy = cy - reach; gy <= cy + reach; gy++) {
          for (const seg of grid.get(`${gx},${gy}`) ?? []) {
            if (seen.has(seg) || seg.road === road) continue;
            seen.add(seg);
            // Opposite travel direction: the other half of the same road.
            if (seg.dir[0] * dir[0] + seg.dir[1] * dir[1] > -0.7) continue;
            const other = oneways[seg.road].name;
            if (name && other && name !== other) continue;
            const t = clamp(
              ((p[0] - seg.a[0]) * (seg.b[0] - seg.a[0]) + (p[1] - seg.a[1]) * (seg.b[1] - seg.a[1])) /
                ((seg.b[0] - seg.a[0]) ** 2 + (seg.b[1] - seg.a[1]) ** 2),
              0,
              1,
            );
            const q: [number, number] = [seg.a[0] + t * (seg.b[0] - seg.a[0]), seg.a[1] + t * (seg.b[1] - seg.a[1])];
            const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (d < bestDist) {
              bestDist = d;
              best = q;
            }
          }
        }
      }
      if (best) moved.set(key, toLonLat([(p[0] + best[0]) / 2, (p[1] + best[1]) / 2]));
    });
  });
  if (moved.size === 0) return roads;
  return roads.map((r) => ({ ...r, path: r.path.map((p) => moved.get(nodeKey(p)) ?? p) }));
}

const pointInRing = ([x, y]: LonLat, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/**
 * Drops every road stretch that ends inside the region without reaching
 * another road. Such a stretch only notches a block instead of separating
 * two, which reads as noise in the illustration. Peeling repeats, so whole
 * dead-end branches go, not just their last segment. Ends outside the region
 * count as connected: the road carries on off-screen.
 */
export function pruneDeadEnds(roads: RoadSegment[], region: Ring): RoadSegment[] {
  interface Segment {
    a: string;
    b: string;
    alive: boolean;
  }
  const segments: Segment[][] = [];
  const incident = new Map<string, Set<Segment>>();
  const points = new Map<string, LonLat>();
  const attach = (key: string, seg: Segment) => {
    let set = incident.get(key);
    if (!set) incident.set(key, (set = new Set()));
    set.add(seg);
  };
  for (const road of roads) {
    const keys = road.path.map(nodeKey);
    road.path.forEach((p, i) => points.set(keys[i], p));
    const segs: Segment[] = [];
    for (let i = 1; i < keys.length; i++) {
      const seg = { a: keys[i - 1], b: keys[i], alive: keys[i - 1] !== keys[i] };
      segs.push(seg);
      if (!seg.alive) continue;
      attach(seg.a, seg);
      attach(seg.b, seg);
    }
    segments.push(segs);
  }

  const insideCache = new Map<string, boolean>();
  const isTipCandidate = (key: string) => {
    if (incident.get(key)?.size !== 1) return false;
    let inside = insideCache.get(key);
    if (inside === undefined) insideCache.set(key, (inside = pointInRing(points.get(key)!, region)));
    return inside;
  };
  const queue = [...incident.keys()].filter(isTipCandidate);
  while (queue.length > 0) {
    const key = queue.pop()!;
    if (!isTipCandidate(key)) continue;
    const seg = incident.get(key)!.values().next().value!;
    seg.alive = false;
    incident.get(seg.a)!.delete(seg);
    incident.get(seg.b)!.delete(seg);
    const other = seg.a === key ? seg.b : seg.a;
    if (isTipCandidate(other)) queue.push(other);
  }

  // Reassemble each road from its surviving runs of segments.
  const out: RoadSegment[] = [];
  roads.forEach((road, r) => {
    let run: LonLat[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ ...road, path: run });
      run = [];
    };
    segments[r].forEach((seg, i) => {
      // A repeated point is not a gap in the road.
      if (seg.a === seg.b) return;
      if (!seg.alive) return flush();
      if (run.length === 0) run.push(road.path[i]);
      run.push(road.path[i + 1]);
    });
    flush();
  });
  return out;
}

/**
 * Turns road center lines into rounded city blocks.
 *
 * Morphological opening: erode the land (region minus roads, both widened
 * by the corner radius), then grow what's left back by the same radius.
 * Growing a shape rounds its convex corners, so every block comes out with
 * soft corners of exactly `cornerRadius`, while the gaps between blocks keep
 * the real road widths. Dead-ends leave a rounded notch, the way a
 * hand-drawn map would.
 */
export function buildDistrictMap(
  region: Ring,
  roads: RoadSegment[],
  options: DistrictOptions = DEFAULT_DISTRICT_OPTIONS,
): DistrictMap {
  if (region.length < 3) return { region, blocks: [] };
  const projection = new LocalProjection(centroid(region));
  const r = options.cornerRadius;
  const regionPath = region.map((p) => projection.toPoint(p));

  const roadPaths = (kind: RoadKind) =>
    roads.filter((road) => road.kind === kind && road.path.length >= 2).map((road) => road.path.map((p) => projection.toPoint(p)));
  const roadMask = [
    ...offset(roadPaths('major'), options.majorWidth / 2 + r, ClipperLib.EndType.etOpenRound),
    ...offset(roadPaths('minor'), options.minorWidth / 2 + r, ClipperLib.EndType.etOpenRound),
  ];

  // Shrinking the region too rounds the blocks cut by the region's edge.
  const land = new ClipperLib.Clipper();
  land.AddPaths(offset([regionPath], -r, ClipperLib.EndType.etClosedPolygon), ClipperLib.PolyType.ptSubject, true);
  land.AddPaths(roadMask, ClipperLib.PolyType.ptClip, true);
  const eroded: ClipperLib.Paths = [];
  land.Execute(
    ClipperLib.ClipType.ctDifference,
    eroded,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );

  const grow = new ClipperLib.ClipperOffset(2, 0.4 * SCALE);
  grow.AddPaths(eroded, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const tree = new ClipperLib.PolyTree();
  grow.Execute(tree, r * SCALE);

  const minArea = options.minBlockArea * SCALE * SCALE;
  const toRing = (path: ClipperLib.Path): Ring => {
    const ring = path.map((p) => projection.toLonLat(p));
    return [...ring, ring[0]];
  };
  const blocks = ClipperLib.JS.PolyTreeToExPolygons(tree)
    .filter((ex) => Math.abs(ClipperLib.Clipper.Area(ex.outer)) >= minArea)
    .map((ex) => ({
      outer: toRing(ex.outer),
      holes: ex.holes.filter((h) => Math.abs(ClipperLib.Clipper.Area(h)) >= minArea).map(toRing),
    }));
  return { region, blocks };
}

import * as clipperNs from 'clipper-lib';
import type { PolygonRings } from './baseMap';
import { metersPerPixel, type Bbox, type LonLat, type MapViewport, type Ring } from './districtMap';
import { screenProjection } from './districtRendering';

const ClipperLib = ((clipperNs as unknown as { default?: typeof clipperNs }).default ?? clipperNs) as typeof clipperNs;

/** One administrative area (시도, 시군구 or 읍면동) as a multipolygon. */
export interface AdminArea {
  code: string;
  name: string;
  bbox: Bbox;
  polygons: PolygonRings[];
}

/**
 * What the map shows: the main area at the screen center split into its
 * sub-areas, and only whole neighboring areas around it.
 */
export interface AreaMap {
  /** e.g. 역삼1동 close up, 강남구 at district scale, 경기도 zoomed out. */
  focus: { code: string; name: string };
  /** Further areas of the same level in the focus range, split too; `parts` has theirs. */
  alsoFocus?: { code: string; name: string }[];
  /** Sub-areas of the focus (구획 of a 읍면동, 읍면동 of a 시군구, 시군구 of a 시도). */
  parts: AdminArea[];
  /** Neighbors drawn as single shapes; their insides are omitted. */
  others: AdminArea[];
}

/** Which area a drawn polygon belongs to, for its name label. */
export interface AreaTag {
  /** Polygons sharing a key get one label (a 읍면동's sections share the 읍면동's). */
  key: string;
  name: string;
}

/** An area's name, placed inside its drawn shape. */
export interface AreaLabel {
  key: string;
  name: string;
  at: LonLat;
  /** A sub-area of the focus (drawn darker) rather than a whole neighbor. */
  part: boolean;
}

/** Screen-ready shapes after gaps and squared-off outlines (lon/lat rings). */
export interface AreaShapes {
  parts: PolygonRings[];
  others: PolygonRings[];
  /** The focused area and the map bearing that shows it most like a rectangle. */
  focus?: { code: string; bearing: number };
  /** Index-aligned with `parts` / `others`; only kept where labels are placed. */
  partTags?: AreaTag[];
  otherTags?: AreaTag[];
  labels?: AreaLabel[];
}

/**
 * Above this scale (meters per CSS pixel) the focus is a 시도 split into
 * 시군구; below it a 시군구 split into 읍면동. 120 m/px is a phone screen
 * about 45km wide, where 읍면동 would shrink to a few pixels.
 */
export const SIDO_FOCUS_MIN_MPP = 120;
/**
 * Below this the focus is one 읍면동 split into sections (구획). 8 m/px is a
 * phone screen 3km wide: a city 읍면동 fills about half of it.
 */
export const DONG_FOCUS_MAX_MPP = 8;
/**
 * Below this a section is split into blocks (local and service roads). 2 m/px
 * is a phone screen 750m wide, where a city section is a few big blobs.
 */
export const SECTION_FOCUS_MAX_MPP = 2;
/**
 * Below this a block is split by footways, where any do (260m wide). Most
 * city blocks aren't, and keep the section-level drawing.
 */
export const BLOCK_FOCUS_MAX_MPP = 0.7;
/**
 * Below this every road shows (95m wide): the pieces left after each road
 * inside is cut out as a thin seam, dead ends and footways included.
 */
export const ROAD_FOCUS_MAX_MPP = 0.3;

export type FocusLevel = 'sido' | 'sgg' | 'dong' | 'section' | 'block' | 'road';
export function focusLevel(viewport: MapViewport): FocusLevel {
  const mpp = metersPerPixel(viewport);
  if (mpp >= SIDO_FOCUS_MIN_MPP) return 'sido';
  if (mpp >= DONG_FOCUS_MAX_MPP) return 'sgg';
  if (mpp >= SECTION_FOCUS_MAX_MPP) return 'dong';
  if (mpp >= BLOCK_FOCUS_MAX_MPP) return 'section';
  return mpp >= ROAD_FOCUS_MAX_MPP ? 'block' : 'road';
}

/** All focused areas of a map as one key (also tells two maps with different foci apart). */
export const areaFocusKey = (map: AreaMap) => [map.focus, ...(map.alsoFocus ?? [])].map((f) => f.code).join('+');

/**
 * Sections, blocks and walk pieces (codes `<동>-<n>…`) have no names of their
 * own: every piece of a 읍면동, split or whole, shares its one label.
 */
const areaTag = (area: AdminArea): AreaTag => ({ key: area.code.split('-')[0], name: area.name });

export const bboxCenter =(b: Bbox): LonLat => [(b.west + b.east) / 2, (b.south + b.north) / 2];

/**
 * The middle of the part of the map nothing covers. On a phone the pin
 * screen's sheet hides the top half, so the plain center would pick an area
 * the user can't see. Linear in latitude: close enough to pick an area.
 */
export function visibleCenter(
  bounds: Bbox,
  size: { width: number; height: number },
  cover: { top: number; right: number; bottom: number; left: number },
): LonLat {
  if (!(size.width > 0 && size.height > 0)) return bboxCenter(bounds);
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  const fx = clamp((cover.left + (size.width - cover.left - cover.right) / 2) / size.width);
  const fy = clamp((cover.top + (size.height - cover.top - cover.bottom) / 2) / size.height);
  return [bounds.west + (bounds.east - bounds.west) * fx, bounds.north - (bounds.north - bounds.south) * fy];
}
export const bboxOverlaps = (a: Bbox, b: Bbox) => a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;

/** Share of the uncovered screen (each way) around its middle that counts as the focus range. */
export const FOCUS_RANGE_RATIO = 0.4;
/** More foci than this would make one drawing too slow; the ones nearest the middle win. */
export const MAX_FOCI = 4;

/**
 * The middle `ratio` of the part of the map nothing covers (same coordinates
 * as `visibleCenter`): areas reaching into it get split, not just the one
 * under a single point.
 */
export function visibleRange(
  bounds: Bbox,
  size: { width: number; height: number },
  cover: { top: number; right: number; bottom: number; left: number },
  ratio = FOCUS_RANGE_RATIO,
): Bbox {
  const [cx, cy] = visibleCenter(bounds, size, cover);
  if (!(size.width > 0 && size.height > 0)) return { west: cx, east: cx, south: cy, north: cy };
  const free = (total: number, a: number, b: number) => Math.max(total - a - b, 0) / total;
  const halfW = ((bounds.east - bounds.west) * free(size.width, cover.left, cover.right) * ratio) / 2;
  const halfH = ((bounds.north - bounds.south) * free(size.height, cover.top, cover.bottom) * ratio) / 2;
  return { west: cx - halfW, east: cx + halfW, south: cy - halfH, north: cy + halfH };
}

/**
 * The areas that reach into `range`, the one under its middle first and then
 * by distance from it. Found by sampling a grid of points over the range, so
 * a sliver thinner than a grid step can be missed. Over sea, the nearest area
 * to the middle, as `areaAt`.
 */
export function areasInRange(areas: AdminArea[], range: Bbox, max = MAX_FOCI): AdminArea[] {
  const center = bboxCenter(range);
  const first = areaAt(areas, center);
  if (!first) return [];
  const found = new Map<AdminArea, number>([[first, 0]]);
  const steps = 4;
  const kx = Math.cos((center[1] * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const point: LonLat = [range.west + ((range.east - range.west) * i) / steps, range.south + ((range.north - range.south) * j) / steps];
      const hit = areas.find((a) => areaContains(a, point));
      if (!hit) continue;
      const d = ((point[0] - center[0]) * kx) ** 2 + (point[1] - center[1]) ** 2;
      if (d < (found.get(hit) ?? Infinity)) found.set(hit, d);
    }
  }
  return [...found].sort((a, b) => a[1] - b[1]).slice(0, max).map(([area]) => area);
}

const inRing = ([x, y]: LonLat, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export function areaContains(area: AdminArea, point: LonLat): boolean {
  const [x, y] = point;
  if (x < area.bbox.west || x > area.bbox.east || y < area.bbox.south || y > area.bbox.north) return false;
  return area.polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}

/**
 * The area under the point; over sea or a river mouth, the nearest one so the
 * map still has a focus. Distance is to vertices — plenty for picking.
 */
export function areaAt(areas: AdminArea[], point: LonLat): AdminArea | null {
  const hit = areas.find((a) => areaContains(a, point));
  if (hit) return hit;
  const kx = Math.cos((point[1] * Math.PI) / 180);
  let best: AdminArea | null = null;
  let bestD = Infinity;
  for (const area of areas) {
    for (const [outer] of area.polygons) {
      for (const [x, y] of outer) {
        const d = ((x - point[0]) * kx) ** 2 + (y - point[1]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = area;
        }
      }
    }
  }
  return best;
}

/** Gap on each side of an area edge, so neighbors sit 2×GAP apart. */
const GAP_PX = 2;
// Clipper works on integers: hundredths of a pixel.
const SCALE = 100;
/**
 * The narrowest gap allowed anywhere. Where three areas meet, or a tiny area
 * is cut small, the shapes can still come close; each
 * one then gives way along its neighbor's outline grown by this.
 */
const MIN_GAP_PX = 3;
// Sharp corners: a miter join keeps a corner pointed after shrinking and
// growing back. The limit (× offset) only blunts needle-thin spikes.
const MITER_LIMIT = 4;
/**
 * Largest gap (px) between a rounded join's arc and its chord. Every later
 * step works on these vertices: at 0.25px a round offset made so many that
 * shaping a district screen took seconds.
 */
const ARC_TOLERANCE_PX = 0.5;
/**
 * Source outlines are far more detailed than the screen when zoomed out;
 * detail below this (px) is dropped before any shaping. Small next to the
 * smoothing window, so both sides of a shared border still end up alike.
 */
const INPUT_TOLERANCE_PX = 0.5;

type Pt = clipperNs.IntPoint;

const distToSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.X - a.X, dy = b.Y - a.Y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.X - a.X, p.Y - a.Y);
  const t = Math.min(Math.max(((p.X - a.X) * dx + (p.Y - a.Y) * dy) / len2, 0), 1);
  return Math.hypot(p.X - (a.X + t * dx), p.Y - (a.Y + t * dy));
};

/** Douglas–Peucker on an open run of points, keeping both ends. */
function simplifyRun(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length <= 2) return pts;
  let index = 0, worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSegment(pts[i], pts[0], pts[pts.length - 1]);
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= tolerance) return [pts[0], pts[pts.length - 1]];
  return [...simplifyRun(pts.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyRun(pts.slice(index), tolerance)];
}

/** Two far-apart indexes of a closed path, so a split doesn't depend on where the ring starts. */
function splitPoints(path: clipperNs.Path): [number, number] {
  const farthestFrom = (from: Pt) => {
    let index = 0, far = -1;
    path.forEach((q, i) => {
      const d = Math.hypot(q.X - from.X, q.Y - from.Y);
      if (d > far) { far = d; index = i; }
    });
    return index;
  };
  const b = farthestFrom(path[0]);
  const a = farthestFrom(path[b]);
  return a < b ? [a, b] : [b, a];
}

/** Douglas–Peucker on a closed path (see `splitPoints`). */
function simplifyClosed(path: clipperNs.Path, tolerancePx: number): clipperNs.Path {
  if (path.length <= 4) return path;
  const [lo, hi] = splitPoints(path);
  const tol = tolerancePx * SCALE;
  const first = simplifyRun(path.slice(lo, hi + 1), tol);
  const second = simplifyRun([...path.slice(hi), ...path.slice(0, lo + 1)], tol);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

type XY = [number, number];
function convexHull(points: XY[]): XY[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: XY[]) => {
    const out: XY[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * The map bearing (degrees, within ±45°) that turns the areas' smallest
 * enclosing rectangle square to the screen, so the area looks as much like a
 * rectangle as it can. Rotating calipers on the convex hull: the smallest
 * rectangle has a side along one hull edge.
 */
export function rectangleBearing(polygons: PolygonRings[]): number {
  const points = polygons.flatMap(([outer]) => outer);
  if (points.length < 3) return 0;
  const lat0 = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const hull = convexHull(points.map(([x, y]): XY => [x * kx, y]));
  if (hull.length < 3) return 0;
  let bestArea = Infinity, bestAngle = 0;
  for (let i = 0; i < hull.length; i++) {
    const [x1, y1] = hull[i];
    const [x2, y2] = hull[(i + 1) % hull.length];
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const c = Math.cos(angle), sn = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * sn, v = -x * sn + y * c;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea - 1e-12) { bestArea = area; bestAngle = angle; }
  }
  // A side at math angle φ (counterclockwise from east) lies level on screen
  // at bearing -φ; every quarter turn of that squares the rectangle too, so
  // take the one nearest to north-up.
  let bearing = ((((-bestAngle * 180) / Math.PI) % 90) + 90) % 90;
  if (bearing > 45) bearing -= 90;
  return Math.round(bearing * 10) / 10 || 0;
}

/**
 * Each area is drawn as its own outline (corners and edges as in the source,
 * only cleaned of sub-pixel detail) inset by the gap, the same width on every
 * side. Neighbors share their border; outside areas are first cut along the
 * focus's outline, since the two come from different boundary files. Done in
 * screen pixels so the look holds at every zoom.
 */
/** How far past the screen edges shapes are drawn (× screen width, px). */
const RENDER_PAD_RATIO = 0.5;
const renderPadPx = (widthPx: number) => Math.max(widthPx, 200) * RENDER_PAD_RATIO;
/** Shapes are cut off where the drawn area ends; a screen this far inside the edge never shows it. */
const WINDOW_MARGIN_PX = 8;

/**
 * The lon/lat box a render of `viewport` covers with finished shapes: as
 * long as the screen stays inside it (and the zoom stays about the same) the
 * same shapes can be shown without redrawing them.
 */
export function areaRenderWindow(viewport: MapViewport): Bbox {
  const projection = screenProjection(viewport);
  const { bounds, widthPx } = viewport;
  const inset = (renderPadPx(widthPx) - WINDOW_MARGIN_PX) * SCALE;
  const top = projection.project([bounds.west, bounds.north]).Y;
  const bottom = projection.project([bounds.west, bounds.south]).Y;
  const [west, lowLat] = projection.unproject({ X: -inset, Y: Math.min(top, bottom) - inset });
  const [east, highLat] = projection.unproject({ X: widthPx * SCALE + inset, Y: Math.max(top, bottom) + inset });
  return { west, east, south: Math.min(lowLat, highLat), north: Math.max(lowLat, highLat) };
}

/**
 * Rounded shapes of areas that fit on screen, kept between renders: the same
 * area at about the same zoom comes out the same wherever the screen is, so
 * zooming back or moving to the next area skips the slow shaping for it.
 * Only areas wholly inside the drawn region are kept (a shape cut at the
 * region's edge depends on where the screen was). Lon/lat, before the
 * minimum gap, which depends on the neighbors drawn with it.
 */
export class AreaShapeCache {
  private entries = new Map<string, LonLat[][]>();

  constructor(private readonly limit = 4000) {}

  get(key: string): LonLat[][] | undefined {
    const hit = this.entries.get(key);
    if (hit) {
      // Least recently used goes first.
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  set(key: string, paths: LonLat[][]): void {
    this.entries.delete(key);
    this.entries.set(key, paths);
    if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value as string);
  }
}

/**
 * Cached shapes are reused within a quarter zoom step (as a power of two) of
 * the one they were drawn at, the same drift the renderer allows before
 * redrawing at all.
 */
const CACHE_STEPS_PER_ZOOM = 4;

const boxOf = (paths: clipperNs.Paths) => {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const path of paths) for (const q of path) {
    b.minX = Math.min(b.minX, q.X); b.maxX = Math.max(b.maxX, q.X);
    b.minY = Math.min(b.minY, q.Y); b.maxY = Math.max(b.maxY, q.Y);
  }
  return b;
};
type Box = ReturnType<typeof boxOf>;
const touches = (a: Box, b: Box, reach = 0) =>
  a.minX - reach < b.maxX && b.minX < a.maxX + reach && a.minY - reach < b.maxY && b.minY < a.maxY + reach;
const validViewport = ({ bounds, widthPx }: MapViewport) => widthPx > 0 && bounds.east > bounds.west && bounds.north > bounds.south;
type Shaped = { part: boolean; tag: AreaTag; paths: clipperNs.Paths };

/** Shared by the full render and the draft: one screen's projection and Clipper helpers. */
function screenTools(map: AreaMap, viewport: MapViewport, cache?: AreaShapeCache) {
  const { bounds, widthPx } = viewport;
  const projection = screenProjection(viewport);
  // Areas far larger than the screen are cut down first; the cut edge lies
  // off-screen, beyond the padding, so its rounded corners never show.
  const pad = renderPadPx(widthPx) * SCALE;
  const top = projection.project([bounds.west, bounds.north]).Y;
  const bottom = projection.project([bounds.west, bounds.south]).Y;
  const [minY, maxY] = [Math.min(top, bottom), Math.max(top, bottom)];
  const screenBox: Box = { minX: -pad, minY: minY - pad, maxX: widthPx * SCALE + pad, maxY: maxY + pad };
  const screen = [
    { X: screenBox.minX, Y: screenBox.minY },
    { X: screenBox.maxX, Y: screenBox.minY },
    { X: screenBox.maxX, Y: screenBox.maxY },
    { X: screenBox.minX, Y: screenBox.maxY },
  ];
  const toRing = (path: clipperNs.Path): Ring => {
    const ring = path.map((p) => projection.unproject(p));
    ring.push(ring[0]);
    return ring;
  };
  const offset = (paths: clipperNs.Paths, delta: number, sharp = false): clipperNs.Paths => {
    const co = new ClipperLib.ClipperOffset(MITER_LIMIT, ARC_TOLERANCE_PX * SCALE);
    co.AddPaths(paths, sharp ? ClipperLib.JoinType.jtMiter : ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    const out: clipperNs.Paths = [];
    co.Execute(out, delta * SCALE);
    return out;
  };
  const project = (area: AdminArea): clipperNs.Paths => area.polygons.flatMap((rings) => {
    const paths = rings.map((ring) => ring.slice(0, -1).map((p) => projection.project(p)));
    return paths.map((projected, i) => {
      const path = simplifyClosed(projected, INPUT_TOLERANCE_PX);
      if (ClipperLib.Clipper.Orientation(path) !== (i === 0)) path.reverse();
      return path;
    });
  });
  const boolean = (type: number, subject: clipperNs.Paths, against: clipperNs.Paths): clipperNs.Paths => {
    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clip.AddPaths(against, ClipperLib.PolyType.ptClip, true);
    const out: clipperNs.Paths = [];
    clip.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    return out;
  };
  /**
   * The area cut down to the drawn region (which also cleans up its outline),
   * and whether it fit without cutting.
   */
  const visibleOf = (area: AdminArea) => {
    const paths = project(area);
    const box = boxOf(paths);
    const whole = box.minX >= screenBox.minX && box.maxX <= screenBox.maxX && box.minY >= screenBox.minY && box.maxY <= screenBox.maxY;
    return { paths: boolean(ClipperLib.ClipType.ctIntersection, paths, [screen]), whole };
  };
  const zoomStep = Math.round(Math.log2((bounds.east - bounds.west) / widthPx) * CACHE_STEPS_PER_ZOOM);
  // Neighbors give way to the focus, so their shapes depend on which area that is.
  const cacheKey = (area: AdminArea, part: boolean) => `${zoomStep}:${part ? 'p' : `o${areaFocusKey(map)}`}:${area.code}`;
  const cached = (area: AdminArea, part: boolean): clipperNs.Paths | undefined =>
    cache?.get(cacheKey(area, part))?.map((path) => path.map((p) => projection.project(p)));
  const remember = (area: AdminArea, part: boolean, paths: clipperNs.Paths) =>
    cache?.set(cacheKey(area, part), paths.map((path) => path.map((p) => projection.unproject(p))));
  const rings = (paths: clipperNs.Paths): PolygonRings[] => {
    const opened = paths;
    // Rebuild outer/hole nesting from orientation.
    const polygons: PolygonRings[] = [];
    for (const path of opened) {
      if (ClipperLib.Clipper.Orientation(path)) polygons.push([toRing(path)]);
    }
    for (const path of opened) {
      if (ClipperLib.Clipper.Orientation(path)) continue;
      const hole = toRing(path);
      const owner = polygons.find(([outer]) => inRing(hole[0], outer));
      owner?.push(hole);
    }
    return polygons;
  };
  /** Every part first, then every neighbor, each shaped by `shape`. */
  const shapeAll = (shape: (area: AdminArea, part: boolean) => clipperNs.Paths): Shaped[] => [
    ...map.parts.map((a) => ({ part: true, tag: areaTag(a), paths: shape(a, true) })),
    ...map.others.map((a) => ({ part: false, tag: areaTag(a), paths: shape(a, false) })),
  ].filter((s) => s.paths.length);
  const finish = (shaped: Shaped[]): AreaShapes => {
    const collect = (part: boolean) => {
      const polygons: PolygonRings[] = [];
      const tags: AreaTag[] = [];
      for (const s of shaped) {
        if (s.part !== part) continue;
        for (const polygon of rings(s.paths)) {
          polygons.push(polygon);
          tags.push(s.tag);
        }
      }
      return { polygons, tags };
    };
    const parts = collect(true);
    const others = collect(false);
    return {
      parts: parts.polygons,
      others: others.polygons,
      partTags: parts.tags,
      otherTags: others.tags,
      // From the source outlines, so it doesn't depend on the current zoom.
      focus: { code: map.focus.code, bearing: rectangleBearing(map.parts.flatMap((a) => a.polygons)) },
    };
  };
  return { offset, project, boolean, visibleOf, cached, remember, shapeAll, finish };
}

export function renderAreaMap(map: AreaMap, viewport: MapViewport, cache?: AreaShapeCache): AreaShapes {
  if (!validViewport(viewport)) return { parts: [], others: [] };
  const { offset, project, boolean, visibleOf, cached, remember, shapeAll, finish } = screenTools(map, viewport, cache);
  // The focus and its neighbors come from different boundary files whose
  // shared borders don't quite match; neighbors give way to the focus.
  // Worked out only once a neighbor isn't cached.
  let focusOutline: { paths: clipperNs.Paths; boxes: Box[] } | null = null;
  const focusPieces = () => {
    if (!focusOutline) {
      const paths = boolean(ClipperLib.ClipType.ctUnion, map.parts.flatMap(project), []);
      focusOutline = { paths, boxes: paths.map((path) => boxOf([path])) };
    }
    return focusOutline;
  };
  const shapeVisible = (fromSource: clipperNs.Paths, part: boolean): clipperNs.Paths => {
    let visible = fromSource;
    if (!part) {
      // Only the focus outline's pieces (and holes) that reach this area: a
      // coast's hundreds of islands made every neighbor's cut slow.
      const focus = focusPieces();
      const visibleBox = boxOf(visible);
      const cut = focus.paths.filter((_, k) => touches(focus.boxes[k], visibleBox));
      if (cut.length) visible = boolean(ClipperLib.ClipType.ctDifference, visible, cut);
    }
    if (visible.length === 0) return [];
    // The area's own outline, only inset by the gap (cut last so it is the
    // same width all round).
    return offset(visible, -GAP_PX, true);
  };
  const shaped = shapeAll((area, part) => {
    const hit = cached(area, part);
    if (hit) return hit;
    const { paths, whole } = visibleOf(area);
    const result = shapeVisible(paths, part);
    if (whole) remember(area, part, result);
    return result;
  });
  // Enforce the minimum gap: each shape gives way to the ones before it
  // (the focus's own parts first). Only nearby shapes are checked, and each
  // shape is grown once, when it is final: growing every neighbor again for
  // each shape was most of the time on a district screen.
  const reach = MIN_GAP_PX * SCALE;
  const boxes = shaped.map((s) => boxOf(s.paths));
  const grown: (clipperNs.Paths | undefined)[] = [];
  for (let i = 1; i < shaped.length; i++) {
    const near = shaped.slice(0, i).flatMap((_, j) => (touches(boxes[j], boxes[i], reach) ? [j] : []));
    if (!near.length) continue;
    // Growing the union equals the union of each grown shape.
    const keepOff = near.flatMap((j) => (grown[j] ??= offset(shaped[j].paths, MIN_GAP_PX)));
    shaped[i].paths = boolean(ClipperLib.ClipType.ctDifference, shaped[i].paths, keepOff);
  }
  return finish(shaped);
}

/**
 * A quick stand-in while `renderAreaMap` works: cached shapes where there
 * are any, the rest only inset by the gap with their corners left sharp.
 * Tens of milliseconds where the full shaping can take a second, so a fresh
 * screen isn't left empty meanwhile.
 */
export function renderAreaDraft(map: AreaMap, viewport: MapViewport, cache?: AreaShapeCache): AreaShapes {
  if (!validViewport(viewport)) return { parts: [], others: [] };
  const { offset, visibleOf, cached, shapeAll, finish } = screenTools(map, viewport, cache);
  return finish(shapeAll((area, part) => cached(area, part) ?? offset(visibleOf(area).paths, -GAP_PX, true)));
}

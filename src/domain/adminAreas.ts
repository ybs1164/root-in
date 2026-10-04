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

export type FocusLevel = 'sido' | 'sgg' | 'dong';
export function focusLevel(viewport: MapViewport): FocusLevel {
  const mpp = metersPerPixel(viewport);
  if (mpp >= SIDO_FOCUS_MIN_MPP) return 'sido';
  return mpp >= DONG_FOCUS_MAX_MPP ? 'sgg' : 'dong';
}

export const bboxCenter = (b: Bbox): LonLat => [(b.west + b.east) / 2, (b.south + b.north) / 2];

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
/**
 * How far an area is shrunk before growing back: lobes and necks narrower
 * than about twice this are omitted. Omitted neighbors lose more.
 */
const PART_RADIUS_PX = 10;
const OTHER_RADIUS_PX = 18;
// Clipper works on integers: hundredths of a pixel.
const SCALE = 100;
/** Inside notches are filled in by this fraction of the outer radius. */
const CONCAVE_RADIUS_RATIO = 1.2;
/**
 * Largest bump (px) straightened out of an edge, for a full-size area. Kept
 * small: a neighbor drawn smooth follows the border more closely, and the
 * difference shows up as an uneven gap.
 */
const STRAIGHTEN_MAX_PX = 2.5;
/** Vertices turning less than this are dropped, so edges stay single lines. */
const MIN_TURN_DEG = 12;
/**
 * An area whose straightened outline needs more sides than this isn't a
 * polygon at heart (a winding river bank, a coast): it is drawn smooth.
 */
const MAX_POLYGON_SIDES = 12;
/**
 * Outline sample spacing and smoothing window for the smooth areas (px).
 * One window for every area at every zoom: both sides of a shared border are
 * then averaged into the same curve, and the gap cut afterwards stays even.
 * A window that grew with the area (or the zoom) bent the two sides apart.
 */
const SMOOTH_STEP_PX = 2;
const SMOOTH_WINDOW_PX = 12;
/** Tiny areas get a smaller window, or averaging would erase them. */
const SMOOTH_WINDOW_RATIO = 0.25;
/**
 * Shapes stay inside their own (equally smoothed) outline shrunk this far, so
 * neighbors never touch where straightening bulges past the shared curve.
 */
const SAFE_INSET_PX = 0.5;
/**
 * The narrowest gap allowed anywhere. Where three areas meet, or a tiny area
 * is averaged with a smaller window, the shapes can still come close; each
 * one then gives way along its neighbor's (smooth) outline grown by this.
 */
const MIN_GAP_PX = 3;
/**
 * A polygon may have this many inside corners (an L or a T); one with more
 * is a zigzag of notches and is drawn smooth instead.
 */
const MAX_POLYGON_NOTCHES = 2;
/**
 * Corner radius for the polygon areas: the straight edges keep the polygon's
 * shape and only the corners turn into arcs. Inside corners get a little less.
 */
const POLYGON_CORNER_PX = 8;
const POLYGON_CORNER_RATIO = 0.15;
const POLYGON_INNER_CORNER_RATIO = 0.6;
const MIN_SHAPE_PX2 = 60;
// Sharp corners: a miter join keeps a corner pointed after shrinking and
// growing back. The limit (× offset) only blunts needle-thin spikes.
const MITER_LIMIT = 4;

/**
 * Evens out bumps along a closed outline: resample it at a fixed spacing and
 * replace each point by the average of its neighbors within a window, twice
 * (close to a Gaussian). Gentle parts barely move, so gaps stay even.
 */
function smoothClosed(path: clipperNs.Path, windowPx: number): clipperNs.Path {
  const step = SMOOTH_STEP_PX * SCALE;
  const pts: [number, number][] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const n = Math.max(1, Math.round(Math.hypot(b.X - a.X, b.Y - a.Y) / step));
    for (let k = 0; k < n; k++) pts.push([a.X + ((b.X - a.X) * k) / n, a.Y + ((b.Y - a.Y) * k) / n]);
  }
  // A shape only a few samples around is already as round as it gets.
  const half = Math.min(Math.round(windowPx / SMOOTH_STEP_PX), Math.floor((pts.length - 1) / 4));
  if (half < 1) return path;
  let cur = pts;
  for (let round = 0; round < 2; round++) {
    const n = cur.length;
    // Running sums over the circular window.
    let sx = 0;
    let sy = 0;
    for (let k = -half; k <= half; k++) {
      const [x, y] = cur[(k + n) % n];
      sx += x;
      sy += y;
    }
    const next: [number, number][] = [];
    const w = 2 * half + 1;
    for (let i = 0; i < n; i++) {
      next.push([sx / w, sy / w]);
      const [ox, oy] = cur[(i - half + n) % n];
      const [ix, iy] = cur[(i + half + 1) % n];
      sx += ix - ox;
      sy += iy - oy;
    }
    cur = next;
  }
  return cur.map(([X, Y]) => ({ X: Math.round(X), Y: Math.round(Y) }));
}

type Pt = clipperNs.IntPoint;

/**
 * Whether a straightened outline reads as a polygon: a few sides and at most
 * a couple of inside corners. Anything else is drawn smooth.
 */
export function polygonLike(path: clipperNs.Path): boolean {
  return path.length <= MAX_POLYGON_SIDES && notchCount(path) <= MAX_POLYGON_NOTCHES;
}

/** Inside (reflex) corners of a closed path, relative to its own winding. */
function notchCount(path: clipperNs.Path): number {
  const winding = Math.sign(ClipperLib.Clipper.Area(path));
  let notches = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[(i - 1 + path.length) % path.length], q = path[i], r = path[(i + 1) % path.length];
    const turn = (q.X - p.X) * (r.Y - q.Y) - (q.Y - p.Y) * (r.X - q.X);
    if (Math.sign(turn) === -winding) notches++;
  }
  return notches;
}
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

/**
 * Turns a closed outline into straight edges meeting at sharp corners: bumps
 * within the tolerance are omitted (Douglas–Peucker, split at two points far
 * apart so the result doesn't depend on where the ring starts), then nearly
 * straight vertices are dropped.
 */
function straightenClosed(path: clipperNs.Path, tolerancePx: number): clipperNs.Path {
  if (path.length <= 4) return path;
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
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const tol = tolerancePx * SCALE;
  const first = simplifyRun(path.slice(lo, hi + 1), tol);
  const second = simplifyRun([...path.slice(hi), ...path.slice(0, lo + 1)], tol);
  let pts = [...first.slice(0, -1), ...second.slice(0, -1)];
  const minTurn = (MIN_TURN_DEG * Math.PI) / 180;
  for (let i = 0; i < pts.length && pts.length > 3;) {
    const p = pts[(i - 1 + pts.length) % pts.length], q = pts[i], r = pts[(i + 1) % pts.length];
    const turn = Math.abs(Math.atan2(
      (q.X - p.X) * (r.Y - q.Y) - (q.Y - p.Y) * (r.X - q.X),
      (q.X - p.X) * (r.X - q.X) + (q.Y - p.Y) * (r.Y - q.Y),
    ));
    if (turn < minTurn) {
      pts = pts.filter((_, j) => j !== i);
      // Removing a vertex changes its neighbors' turns: look again from before it.
      i = Math.max(i - 1, 0);
    } else {
      i++;
    }
  }
  return pts;
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
 * Shrinks then grows each area (a morphological opening), which omits thin
 * lobes; growing a little further and shrinking back (a closing) fills narrow
 * notches. An area that straightens into a polygon of a few sides with at
 * most a couple of inside corners keeps that polygon's straight edges, with
 * its corners rounded. Any other area is drawn smooth: its outline averaged
 * with one fixed window, so even a very bumpy area becomes a regular shape.
 * Only then is the gap cut, the same width on every side: neighbors share
 * their border (outside areas are first cut along the focus's outline, since
 * the two come from different boundary files) and both sides are shaped the
 * same way, so what remains between them is an even gap. A final clip to the
 * area's own smoothed outline keeps any leftover bulge off its neighbor.
 * Done in screen pixels so the look holds at every zoom. An area too small
 * for the full radius retries with a smaller one rather than vanishing.
 */
/** How far past the screen edges shapes are drawn (× screen width, px). */
const RENDER_PAD_RATIO = 0.5;
const renderPadPx = (widthPx: number) => Math.max(widthPx, 200) * RENDER_PAD_RATIO;
/**
 * Shapes are cut off where the drawn area ends, and that cut edge is rounded
 * too; a screen this far inside the edge never shows it.
 */
const WINDOW_MARGIN_PX = OTHER_RADIUS_PX * 2 + 8;

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

export function renderAreaMap(map: AreaMap, viewport: MapViewport): AreaShapes {
  const { bounds, widthPx } = viewport;
  if (!(widthPx > 0 && bounds.east > bounds.west && bounds.north > bounds.south)) return { parts: [], others: [] };
  const projection = screenProjection(viewport);
  // Areas far larger than the screen are cut down first; the cut edge lies
  // off-screen, beyond the padding, so its rounded corners never show.
  const pad = renderPadPx(widthPx) * SCALE;
  const top = projection.project([bounds.west, bounds.north]).Y;
  const bottom = projection.project([bounds.west, bounds.south]).Y;
  const [minY, maxY] = [Math.min(top, bottom), Math.max(top, bottom)];
  const screen = [
    { X: -pad, Y: minY - pad },
    { X: widthPx * SCALE + pad, Y: minY - pad },
    { X: widthPx * SCALE + pad, Y: maxY + pad },
    { X: -pad, Y: maxY + pad },
  ];
  const toRing = (path: clipperNs.Path): Ring => {
    const ring = path.map((p) => projection.unproject(p));
    ring.push(ring[0]);
    return ring;
  };
  const offset = (paths: clipperNs.Paths, delta: number, sharp = false): clipperNs.Paths => {
    const co = new ClipperLib.ClipperOffset(MITER_LIMIT, 0.25 * SCALE);
    co.AddPaths(paths, sharp ? ClipperLib.JoinType.jtMiter : ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    const out: clipperNs.Paths = [];
    co.Execute(out, delta * SCALE);
    return out;
  };
  const project = (area: AdminArea): clipperNs.Paths => area.polygons.flatMap((rings) => rings.map((ring, i) => {
    const path = ring.slice(0, -1).map((p) => projection.project(p));
    if (ClipperLib.Clipper.Orientation(path) !== (i === 0)) path.reverse();
    return path;
  }));
  const boolean = (type: number, subject: clipperNs.Paths, against: clipperNs.Paths): clipperNs.Paths => {
    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clip.AddPaths(against, ClipperLib.PolyType.ptClip, true);
    const out: clipperNs.Paths = [];
    clip.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    return out;
  };
  // The focus and its neighbors come from different boundary files whose
  // shared borders don't quite match; neighbors give way to the focus.
  const focusOutline = boolean(ClipperLib.ClipType.ctUnion, map.parts.flatMap(project), []);
  const shape = (area: AdminArea, radius: number, cutAway: clipperNs.Paths): clipperNs.Paths => {
    let visible = boolean(ClipperLib.ClipType.ctIntersection, project(area), [screen]);
    if (cutAway.length) visible = boolean(ClipperLib.ClipType.ctDifference, visible, cutAway);
    if (visible.length === 0) return [];
    // A fixed radius would wipe out every lobe narrower than about twice
    // itself, leaving wide holes between small areas when zoomed out.
    const areaPx = visible.reduce((sum, path) => sum + ClipperLib.Clipper.Area(path), 0) / SCALE ** 2;
    const size = Math.sqrt(Math.max(areaPx, 0));
    const fitted = Math.min(radius, size * 0.12);
    // A small area gets a small tolerance and window, or they would erase it.
    const tolerance = Math.max(0.75, Math.min(STRAIGHTEN_MAX_PX, size * 0.06));
    const window = Math.min(SMOOTH_WINDOW_PX, size * SMOOTH_WINDOW_RATIO);
    const safe = offset(visible, -SAFE_INSET_PX).map((path) => smoothClosed(path, window));
    for (const r of [fitted, fitted / 3, 0]) {
      const c = r * CONCAVE_RADIUS_RATIO;
      const open = (sharp: boolean) => offset(offset(offset(visible, -r, sharp), r + c, sharp), -c, sharp);
      const sharp = open(true);
      if (sharp.length === 0) continue;
      const straight = sharp.map((path) => straightenClosed(path, tolerance));
      const isPolygon = straight.every(polygonLike);
      // Shrinking the straight polygon and growing it back with round joins
      // rounds its outer corners; the reverse rounds its inner corners.
      const corner = Math.min(POLYGON_CORNER_PX, size * POLYGON_CORNER_RATIO);
      const inner = corner * POLYGON_INNER_CORNER_RATIO;
      const outline = isPolygon
        ? offset(offset(offset(straight, -corner), corner + inner), -inner)
        : open(false).map((path) => smoothClosed(path, window));
      // The gap, cut last so it is the same width all round.
      const drawn = offset(outline, -GAP_PX);
      if (drawn.length === 0) continue;
      const kept = boolean(ClipperLib.ClipType.ctIntersection, drawn, safe);
      if (kept.length) return kept;
    }
    return [];
  };
  // Sections (구획) have no names of their own: the 읍면동 gets one label.
  const partTag = (a: AdminArea): AreaTag => (a.code.includes('-') ? { key: map.focus.code, name: map.focus.name } : { key: a.code, name: a.name });
  const shaped = [
    ...map.parts.map((a) => ({ part: true, tag: partTag(a), paths: shape(a, PART_RADIUS_PX, []) })),
    ...map.others.map((a) => ({ part: false, tag: { key: a.code, name: a.name }, paths: shape(a, OTHER_RADIUS_PX, focusOutline) })),
  ].filter((s) => s.paths.length);
  // Enforce the minimum gap: each shape gives way to the ones before it
  // (the focus's own parts first). Only nearby shapes are checked.
  const boxOf = (paths: clipperNs.Paths) => {
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const path of paths) for (const q of path) {
      b.minX = Math.min(b.minX, q.X); b.maxX = Math.max(b.maxX, q.X);
      b.minY = Math.min(b.minY, q.Y); b.maxY = Math.max(b.maxY, q.Y);
    }
    return b;
  };
  const reach = MIN_GAP_PX * SCALE;
  const boxes = shaped.map((s) => boxOf(s.paths));
  for (let i = 1; i < shaped.length; i++) {
    const near = shaped.slice(0, i).filter((_, j) => boxes[j].minX - reach < boxes[i].maxX && boxes[i].minX < boxes[j].maxX + reach &&
      boxes[j].minY - reach < boxes[i].maxY && boxes[i].minY < boxes[j].maxY + reach);
    if (!near.length) continue;
    const keepOff = offset(near.flatMap((s) => s.paths), MIN_GAP_PX);
    shaped[i].paths = boolean(ClipperLib.ClipType.ctDifference, shaped[i].paths, keepOff);
  }
  const rings = (paths: clipperNs.Paths): PolygonRings[] => {
    // Specks a few pixels across read as noise, not areas.
    const opened = paths.filter((path) => Math.abs(ClipperLib.Clipper.Area(path)) > MIN_SHAPE_PX2 * SCALE ** 2);
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
}

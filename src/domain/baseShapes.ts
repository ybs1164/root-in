import * as clipperNs from 'clipper-lib';
import { roadWidthPx, type BaseMap, type PolygonRings } from './baseMap';
import { smoothClosed } from './curves';
import { metersPerPixel, type MapViewport, type Ring } from './districtMap';

const ClipperLib = ((clipperNs as unknown as { default?: typeof clipperNs }).default ?? clipperNs) as typeof clipperNs;

/**
 * The base map's land, generalized for one screen (docs/plan-mainmap-style.md
 * M10): calm, rounded shorelines in the manner of simplified city maps
 * (Apple/Google simplified styles, Mapbox Light, illustrated travel maps)
 * rather than every bend of the source. The steps are cartography's
 * generalization operators (McMaster & Shea), all in screen pixels so the
 * look holds at every zoom:
 *   merge  — all land into one shape, so tile seams and touching pieces vanish;
 *   close  — water channels and bays narrower than 2×`CLOSE_PX` fill in;
 *   open   — land slivers and spits thinner than 2×`OPEN_PX` go;
 *   drop   — islands under `MIN_SHAPE_PX`, ponds under `MIN_POND_PX`;
 *   simplify (Douglas–Peucker, `SIMPLIFY_PX`) and smooth into one continuous
 *   curve through what is left (Catmull-Rom, `smoothClosed` — M11).
 * Water is wherever no land is drawn. At neighborhood scale, parks and roads
 * retain their source geometry so zooming in reveals streets and paths.
 */
export interface BaseShapes {
  land: PolygonRings[];
  parks?: PolygonRings[];
  roads?: { path: BaseMap['roads'][number]['path']; width: number; tier: number }[];
}

/** Water narrower than twice this (px) closes up: a stream or a dock reads as a scribble. */
export const CLOSE_PX = 3;
/** Land thinner than twice this (px) is shaved off: a pier or a sandbar is noise. */
export const OPEN_PX = 3;
/** Outlines may move this far (screen px) when simplified, before smoothing. */
export const SIMPLIFY_PX = 1.5;
/** Land smaller than this across (px) is dropped: a speck, not a place. */
export const MIN_SHAPE_PX = 12;
/** Holes in the land smaller than this across (px) are filled: they'd read as noise, not water. */
export const MIN_POND_PX = 20;
/** The smooth curve is sampled about this often (px). */
const CURVE_STEP_PX = 3;
// Clipper works on integers: hundredths of a pixel.
const SCALE = 100;
/** Largest gap (px) between a rounded offset's arc and its chord. */
const ARC_TOLERANCE_PX = 0.4;

type Pt = clipperNs.IntPoint;

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

/** How far a ring reaches across, in px (Clipper units). */
function acrossPx(path: Pt[]): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { X, Y } of path) {
    if (X < minX) minX = X;
    if (X > maxX) maxX = X;
    if (Y < minY) minY = Y;
    if (Y > maxY) maxY = Y;
  }
  return Math.max(maxX - minX, maxY - minY) / SCALE;
}

/** Douglas–Peucker on a closed path (Clipper units), keeping the first point. */
function simplifyClosed(path: Pt[], tolerance: number): Pt[] {
  if (path.length <= 4) return path;
  const points = [...path, path[0]];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  // Split at the point farthest from the first, so the chord is never a point.
  let far = 1, farDist = -1;
  points.forEach((p, i) => {
    const d = Math.hypot(p.X - points[0].X, p.Y - points[0].Y);
    if (d > farDist) { farDist = d; far = i; }
  });
  keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const a = points[from], b = points[to];
    const dx = b.X - a.X, dy = b.Y - a.Y;
    const length = Math.hypot(dx, dy) || 1;
    let worst = -1, worstDist = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = Math.abs(dy * (points[i].X - a.X) - dx * (points[i].Y - a.Y)) / length;
      if (d > worstDist) { worstDist = d; worst = i; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([from, worst], [worst, to]);
    }
  }
  return points.slice(0, -1).filter((_, i) => keep[i]);
}

function offset(paths: Pt[][], deltaPx: number): Pt[][] {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE_PX * SCALE);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out: Pt[][] = [];
  co.Execute(out, deltaPx * SCALE);
  return out;
}

function union(paths: Pt[][]): Pt[][] {
  const clip = new ClipperLib.Clipper();
  clip.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const out: Pt[][] = [];
  clip.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}

/** Is `p` inside the ring (even-odd)? */
function inPath(p: Pt, path: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i], b = path[j];
    if ((a.Y > p.Y) !== (b.Y > p.Y) && p.X < ((b.X - a.X) * (p.Y - a.Y)) / (b.Y - a.Y) + a.X) inside = !inside;
  }
  return inside;
}

/** The base map shaped for this screen (see `BaseShapes`). */
export function shapeBaseMap(base: BaseMap, viewport: MapViewport): BaseShapes {
  const mpp = metersPerPixel(viewport);
  const detail = {
    parks: mpp <= 60 ? base.parks : [],
    roads: mpp <= 30 ? base.roads.map((road) => ({ path: road.path, tier: road.tier, width: roadWidthPx(road.tier, mpp) })).filter((road) => road.width > 0) : [],
  };
  const scale = screenScale(viewport);
  // Screen px (y down, as on screen), in Clipper's integer units.
  const toPt = ([lon, lat]: [number, number]): Pt => ({ X: Math.round((lon / scale.x) * SCALE), Y: Math.round((-lat / scale.y) * SCALE) });
  const toLonLat = ({ X, Y }: Pt): [number, number] => [(X / SCALE) * scale.x, (-Y / SCALE) * scale.y];

  if (!base.land.length) return { land: [], ...detail };
  // Merge: every polygon with its holes wound against its outer ring, so the
  // union keeps them as holes and joins touching pieces (tile seams) into one.
  const clip = new ClipperLib.Clipper();
  for (const polygon of base.land) {
    const rings = polygon.map((ring) => ring.slice(0, -1).map(toPt));
    rings.forEach((ring, i) => {
      if (ClipperLib.Clipper.Orientation(ring) !== (i === 0)) ring.reverse();
    });
    clip.AddPaths(rings, ClipperLib.PolyType.ptSubject, true);
  }
  let land: Pt[][] = [];
  clip.Execute(ClipperLib.ClipType.ctUnion, land, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

  // Close (fill narrow water), then open (shave thin land).
  land = offset(offset(land, CLOSE_PX), -CLOSE_PX);
  land = offset(offset(land, -OPEN_PX), OPEN_PX);
  land = union(land);

  // Outer rings (positive) and holes (negative), small ones dropped, then
  // simplified and smoothed.
  const outers: Pt[][] = [];
  const holes: Pt[][] = [];
  for (const path of land) {
    const outer = ClipperLib.Clipper.Orientation(path);
    if (acrossPx(path) < (outer ? MIN_SHAPE_PX : MIN_POND_PX)) continue;
    const shaped = smoothClosed(simplifyClosed(path, SIMPLIFY_PX * SCALE), CURVE_STEP_PX * SCALE);
    if (shaped.length < 3) continue;
    (outer ? outers : holes).push(shaped);
  }
  const polygons: PolygonRings[] = outers.map((outer) => [ring(outer)]);
  for (const hole of holes) {
    const owner = outers.findIndex((outer) => inPath(hole[0], outer));
    if (owner >= 0) polygons[owner].push(ring(hole));
  }
  return { land: polygons, ...detail };

  function ring(path: Pt[]): Ring {
    const points = path.map(toLonLat);
    points.push(points[0]);
    return points;
  }
}

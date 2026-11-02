import type { LonLat } from './districtMap';
import { bendField, clusterPoints, type MapPoint } from './miniMap';

/**
 * A group's day as islands (docs/plan-group-atlas.md): the pings grouped into
 * regions, each region one small TODAY-style picture, the islands placed on a
 * faint Korea near their real spots but pushed apart until none overlap. Inside
 * an island the distances are honest-ish (TODAY's own picture); between islands
 * only which way each lies is kept, never how far.
 */

/** Pings this close on the ground (metres, or via others) share one island. */
export const REGION_GAP_M = 8000;
/** More islands than this and the nearest two merge (a phone can't hold more apart). */
export const MAX_REGIONS = 12;

const M_PER_DEG = 111320;
/** Longitude shrunk to latitude's scale at Korea's middle (36°N): one flat projection for the whole country. */
const KX = Math.cos((36 * Math.PI) / 180);

const metres = (c: LonLat): MapPoint => ({ x: c[0] * KX * M_PER_DEG, y: -c[1] * M_PER_DEG });
const mean = (cs: LonLat[]): LonLat => [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length];

/**
 * The stops (distinct spots) grouped by region: indices into `centers`, each
 * group in the order its stops come, groups in the order they first appear.
 * Past `MAX_REGIONS`, the two groups with the nearest middles merge, again and again.
 */
export function atlasRegions(centers: LonLat[], gap = REGION_GAP_M, max = MAX_REGIONS): number[][] {
  if (!centers.length) return [];
  const groups = clusterPoints(centers.map(metres), gap).map((g) => [...g].sort((a, b) => a - b));
  while (groups.length > max) {
    const mid = groups.map((g) => metres(mean(g.map((i) => centers[i]))));
    let best = [0, 1, Infinity];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = Math.hypot(mid[i].x - mid[j].x, mid[i].y - mid[j].y);
        if (d < best[2]) best = [i, j, d];
      }
    }
    const [i, j] = best;
    groups[i] = [...groups[i], ...groups[j]].sort((a, b) => a - b);
    groups.splice(j, 1);
  }
  return groups.sort((a, b) => a[0] - b[0]);
}

/** An island's side (px at zoom 1): one stop 150, a little bigger for each more, at most 230. */
export const islandSize = (stops: number): number => Math.min(230, 150 + 16 * (Math.max(1, stops) - 1));

/** How far apart two islands' middles must stay: their land, not their whole square (the land is tilted flat), plus room. */
const reach = (size: number) => size * 0.38 + 10;

export interface AtlasIsland {
  /** Indices into the centers the plan was made from, in their order. */
  stops: number[];
  center: LonLat;
  size: number;
  /** Its middle on the canvas (px at zoom 1). */
  at: MapPoint;
}

export interface AtlasPlan {
  islands: AtlasIsland[];
  /** The canvas: every island's land with a margin; Korea behind runs past its edges. */
  width: number;
  height: number;
  /** A lon/lat on the canvas as the islands bend it (Korea's coast goes with the island nearest it). */
  toCanvas(c: LonLat): MapPoint;
}

const MARGIN = 40;

/**
 * The islands for these stops, placed: each at its real spot (scaled so the
 * regions spread over about a phone and a half, never past ~1200 px a degree
 * so one region's Korea stays a coast, not a wall), then pushed apart pair by
 * pair until no two overlap (Dorling's cartogram), pulled back toward their
 * spots in the first rounds so north stays north. Deterministic.
 */
export function planAtlas(centers: LonLat[]): AtlasPlan {
  const regions = atlasRegions(centers);
  const middles = regions.map((g) => mean(g.map((i) => centers[i])));
  const sizes = regions.map((g) => islandSize(g.length));
  const lngs = middles.map((c) => c[0]);
  const lats = middles.map((c) => c[1]);
  const spanX = Math.max(0.05, ((Math.max(...lngs) - Math.min(...lngs)) || 0) * KX);
  const spanY = Math.max(0.05, (Math.max(...lats) - Math.min(...lats)) || 0);
  const k = middles.length ? Math.max(150, Math.min(1200, 420 / spanX, 650 / spanY)) : 150;
  const project = (c: LonLat): MapPoint => ({ x: (c[0] - 126) * KX * k, y: (38.7 - c[1]) * k });

  const anchors = middles.map(project);
  const at = anchors.map((p) => ({ ...p }));
  for (let round = 0; round < 600; round++) {
    const pull = round < 450 ? 0.03 : 0;
    for (let i = 0; i < at.length; i++) {
      at[i].x += (anchors[i].x - at[i].x) * pull;
      at[i].y += (anchors[i].y - at[i].y) * pull;
    }
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        let [dx, dy] = [at[j].x - at[i].x, at[j].y - at[i].y];
        let d = Math.hypot(dx, dy);
        const need = reach(sizes[i]) + reach(sizes[j]);
        if (d >= need) continue;
        // Two on one spot: apart sideways (the later one to the east).
        if (d === 0) [dx, dy, d] = [1, 0, 1];
        const push = (need - d) / 2;
        at[i].x -= (dx / d) * push;
        at[i].y -= (dy / d) * push;
        at[j].x += (dx / d) * push;
        at[j].y += (dy / d) * push;
      }
    }
  }

  // The canvas: the islands' land (their names under it) plus a margin, starting at 0; with no islands, all of Korea.
  const corners = [project([124.6, 38.7]), project([130, 33])];
  const xs = at.length ? at.flatMap((p, i) => [p.x - sizes[i] * 0.42, p.x + sizes[i] * 0.42]) : corners.map((p) => p.x);
  const ys = at.length ? at.flatMap((p, i) => [p.y - sizes[i] * 0.3, p.y + sizes[i] * 0.3 + 24]) : corners.map((p) => p.y);
  const shift = { x: MARGIN - Math.min(...xs), y: MARGIN - Math.min(...ys) };
  const width = Math.max(...xs) - Math.min(...xs) + 2 * MARGIN;
  const height = Math.max(...ys) - Math.min(...ys) + 2 * MARGIN;
  const bend = bendField(anchors, at);
  return {
    islands: regions.map((stops, i) => ({ stops, center: middles[i], size: sizes[i], at: { x: at[i].x + shift.x, y: at[i].y + shift.y } })),
    width,
    height,
    toCanvas: (c) => {
      const p = bend(project(c));
      return { x: p.x + shift.x, y: p.y + shift.y };
    },
  };
}

/** A stop on the canvas: its spot in its island's picture (the unit square) over the island's square. */
export const stopOnCanvas = (island: AtlasIsland, unit: MapPoint): MapPoint => ({
  x: island.at.x + (unit.x - 0.5) * island.size,
  y: island.at.y + (unit.y - 0.5) * island.size,
});

/** Korea's outline (flat lng, lat rings) on the canvas, as an SVG path. */
export function outlinePath(rings: readonly number[][], plan: AtlasPlan): string {
  return rings
    .map((ring) => {
      const pts: string[] = [];
      for (let i = 0; i + 1 < ring.length; i += 2) {
        const p = plan.toCanvas([ring[i], ring[i + 1]]);
        pts.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      }
      return `M${pts.join('L')}Z`;
    })
    .join('');
}

/** The big cities whose 구 go by the city's name ('서울 성동구'); a merged 시도 still names its old city ('전남광주통합특별시' → 광주). */
const CITIES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'];

/**
 * A region's name from the 시도 and 시군구 under it, short: a 구 of a big
 * city goes with its city ('서울 성동구'), a 구 of a 시 with that 시 without
 * its 시 ('수원시팔달구' → '수원 팔달구'), a 시 or 군 stands alone ('강릉시').
 */
export function regionName(sido: string, sgg: string): string {
  const ofCity = /^(.+?)시(.+구)$/.exec(sgg);
  if (ofCity) return `${ofCity[1]} ${ofCity[2]}`;
  const city = /(특별자치시|특별시|광역시)$/.test(sido) ? CITIES.find((c) => sido.includes(c)) : undefined;
  return city && /구$/.test(sgg) ? `${city} ${sgg}` : sgg;
}

export interface AtlasView {
  zoom: number;
  x: number;
  y: number;
}

export interface Room {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const MAX_ZOOM = 4;

/** The least zoom: the whole canvas in the room (a little smaller still), never more than 1. */
export const minZoom = (width: number, height: number, room: Room): number =>
  Math.min(1, (room.right - room.left) / width, (room.bottom - room.top) / height) * 0.85;

/**
 * The view kept in reach: zoom between the least and `MAX_ZOOM`; along each
 * side, a canvas narrower than the room sits in its middle, a wider one can be
 * dragged until its edge is 40% of the room past the room's edge (so any spot
 * on it can be brought to the middle).
 */
export function clampView(view: AtlasView, width: number, height: number, room: Room): AtlasView {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom(width, height, room), view.zoom));
  const along = (pos: number, size: number, lo: number, hi: number) => {
    const free = hi - lo;
    const scaled = size * zoom;
    if (scaled <= free) return lo + (free - scaled) / 2;
    const slack = free * 0.4;
    return Math.min(lo + slack, Math.max(hi - slack - scaled, pos));
  };
  return { zoom, x: along(view.x, width, room.left, room.right), y: along(view.y, height, room.top, room.bottom) };
}

/** Zoom changed to `zoom` about a screen point: what's under it stays under it. */
export function zoomAbout(view: AtlasView, zoom: number, at: MapPoint): AtlasView {
  const k = zoom / view.zoom;
  return { zoom, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}

/** Readable at least: fitting a whole nationwide day into a phone would make every island a crumb. */
export const FIT_MIN_ZOOM = 0.7;
/** Close but not glued: a member's pings in one street don't need a 4× zoom. */
export const FIT_MAX_ZOOM = 2.5;

/**
 * The view showing these canvas points in the screen less `pad` (the title
 * over them, the member row under): one point comes in to at least 1.6×,
 * several are fitted between `FIT_MIN_ZOOM` and `FIT_MAX_ZOOM` (left to the
 * caller to clamp to the canvas).
 */
export function fitView(points: MapPoint[], screen: { width: number; height: number }, pad: Room, now: AtlasView): AtlasView | null {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [l, r, t, b] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const freeW = Math.max(40, screen.width - pad.left - pad.right);
  const freeH = Math.max(40, screen.height - pad.top - pad.bottom);
  // Room for the pins and faces standing over the topmost (≈50px) and beside the outer ones.
  const zoom =
    points.length === 1 || (r - l < 1 && b - t < 1)
      ? Math.max(now.zoom, 1.6)
      : Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, Math.min((freeW - 40) / Math.max(1, r - l), (freeH - 60) / Math.max(1, b - t))));
  const middle = { x: pad.left + freeW / 2, y: pad.top + freeH / 2 + 25 };
  return { zoom, x: middle.x - ((l + r) / 2) * zoom, y: middle.y - ((t + b) / 2) * zoom };
}

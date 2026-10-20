import type { AreaShapes } from '../domain/adminAreas';
import { ROAD_TIERS, roadWidthPx, type PolygonRings, type RoadTier } from '../domain/baseMap';

/**
 * The main map's layers, bottom to top (docs/plan-mainmap-style.md §3): the
 * page is water; land lies on it, the 읍면동 in the middle of the screen get
 * a faint tint, parks and roads go on top. Kept apart from the MapLibre class
 * so the stack and its data can be tested without a WebGL canvas.
 */
export type MapLayerId =
  | 'area-cover'
  | 'base-land'
  | 'area-parts'
  | 'base-parks'
  | 'base-road-edge'
  | 'base-roads';

export interface MapLayerSpec {
  id: MapLayerId;
  /** The GeoJSON source it draws (several layers may share one). */
  source: string;
  type: 'fill' | 'line';
  /** The colour token it is painted in, and what to use where tokens can't be read. */
  token: string;
  fallback: string;
}

export const MAP_LAYERS: MapLayerSpec[] = [
  // Land everywhere, but only while there is no base map (none loaded yet, or
  // no tiles): the screen is never a blank sheet of water.
  { id: 'area-cover', source: 'area-cover', type: 'fill', token: '--map-land', fallback: '#e7ecf3' },
  { id: 'base-land', source: 'base-land', type: 'fill', token: '--map-land', fallback: '#e7ecf3' },
  // Translucent, so a river running through a 동 still shows as water.
  { id: 'area-parts', source: 'area-parts', type: 'fill', token: '--map-tint', fallback: 'rgba(108, 144, 216, 0.12)' },
  { id: 'base-parks', source: 'base-parks', type: 'fill', token: '--map-park', fallback: '#cdeedc' },
  { id: 'base-road-edge', source: 'base-roads', type: 'line', token: '--map-road-edge', fallback: '#cdd8ed' },
  { id: 'base-roads', source: 'base-roads', type: 'line', token: '--map-road', fallback: '#fffdf8' },
];

/** The page under everything: water. */
export const WATER_TOKEN = { token: '--map-water', fallback: '#c9d2e4' };

const WORLD: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
};

const polygons = (list: PolygonRings[]): GeoJSON.Feature[] =>
  list.map((rings) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } }));
const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

/** What a source draws for these shapes. */
export function mapSourceData(source: string, areas: AreaShapes | null): GeoJSON.FeatureCollection {
  const base = areas?.base;
  switch (source) {
    case 'area-cover':
      return collection(areas && !base ? [{ type: 'Feature', properties: {}, geometry: WORLD }] : []);
    case 'base-land':
      return collection(polygons(base?.land ?? []));
    case 'area-parts':
      return collection(polygons(areas?.parts ?? []));
    case 'base-parks':
      return collection(polygons(base?.parks ?? []));
    case 'base-roads':
      return collection((base?.roads ?? []).map((road) => ({
        type: 'Feature',
        properties: { tier: road.tier },
        geometry: { type: 'LineString', coordinates: road.path },
      })));
    default:
      return collection([]);
  }
}

/** Sources whose data comes from the base map (re-sent only when it changes). */
export const BASE_SOURCES = ['area-cover', 'base-land', 'base-parks', 'base-roads'];
/**
 * Sources whose data comes from the admin areas. The neighbouring areas
 * (`others`) are not drawn: they are just land (2026-10-20 decision, §6-1),
 * and a filled 동 would cover the river running through it.
 */
export const AREA_SOURCES = ['area-cover', 'area-parts'];

/** Korea's middle latitude: road widths follow meters per pixel there (within about 10% across the country). */
const KOREA_LAT = 36.5;
const ZOOMS = Array.from({ length: 17 }, (_, i) => i + 5);
const mppAt = (zoom: number) => (78271.517 * Math.cos((KOREA_LAT * Math.PI) / 180)) / 2 ** zoom;

/**
 * A road's width by zoom and tier, as a MapLibre expression: the same widths
 * as `roadWidthPx` (a real width, kept between a floor and a cap) sampled at
 * every zoom and eased between them. `extra` widens it (the edge under a
 * trunk road); tiers not in `tiers` are 0 wide.
 */
export function roadWidthExpression(extra = 0, tiers: RoadTier[] = ROAD_TIERS): unknown[] {
  const stops = ZOOMS.flatMap((zoom) => {
    const mpp = mppAt(zoom);
    const byTier = ROAD_TIERS.flatMap((tier) => {
      const width = tiers.includes(tier) ? roadWidthPx(tier, mpp) : 0;
      return [tier, width > 0 ? +(width + extra).toFixed(2) : 0];
    });
    return [zoom, ['match', ['get', 'tier'], ...byTier, 0]];
  });
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops];
}

/**
 * How many base map objects the Kakao map gets at most: there, every polygon
 * and road is an SDK object (SVG), and their number is what panning costs
 * (docs/plan-mainmap-style.md M5). MapLibre draws everything.
 */
export const KAKAO_LIMITS = { land: 200, parks: 150, roads: 400 };

export interface KakaoRoad {
  tier: RoadTier;
  path: [number, number][];
  /** Screen px at the scale it was picked for. */
  width: number;
}

export interface KakaoBase {
  land: PolygonRings[];
  parks: PolygonRings[];
  /** Narrow first, so the wide roads lie over them where they meet. */
  roads: KakaoRoad[];
}

/** How much of the map a polygon covers (its outer ring's box, in degrees²): enough to rank them. */
function boxArea(rings: PolygonRings): number {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [x, y] of rings[0] ?? []) {
    west = Math.min(west, x); east = Math.max(east, x);
    south = Math.min(south, y); north = Math.max(north, y);
  }
  return Math.max(0, east - west) * Math.max(0, north - south);
}

/** How far a road runs (degrees, enough to rank them). */
function pathLength(path: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return length;
}

const biggest = (list: PolygonRings[], limit: number) =>
  list.length <= limit ? list : list.map((rings) => ({ rings, area: boxArea(rings) })).sort((a, b) => b.area - a.area).slice(0, limit).map((p) => p.rings);

/**
 * The base map as the Kakao map draws it at `mpp` (meters per screen px):
 * the biggest land and parks, and the roads that matter most — wide tiers
 * first, then the longest — within `KAKAO_LIMITS`. What is left out is small
 * or a short side street; the land under it still shows.
 */
export function pickKakaoBase(base: AreaShapes['base'], mpp: number, limits = KAKAO_LIMITS): KakaoBase {
  if (!base) return { land: [], parks: [], roads: [] };
  const roads = base.roads
    .map((road) => ({ tier: road.tier, path: road.path, width: roadWidthPx(road.tier, mpp), length: pathLength(road.path) }))
    .filter((road) => road.width > 0)
    .sort((a, b) => a.tier - b.tier || b.length - a.length)
    .slice(0, limits.roads)
    .sort((a, b) => b.tier - a.tier)
    .map(({ tier, path, width }) => ({ tier, path, width: +width.toFixed(1) }));
  return { land: biggest(base.land, limits.land), parks: biggest(base.parks, limits.parks), roads };
}

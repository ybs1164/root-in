import { PART_TONES, type AreaShapes } from '../domain/adminAreas';
import type { PolygonRings } from '../domain/baseMap';

/**
 * The main map's layers, bottom to top: the page is water, land lies on it,
 * the split 읍면동 in the middle of the screen cast one soft shadow as a
 * single silhouette, and each is tinted in one of four close tones so
 * neighbours differ (docs/plan-mainmap-style.md M9–M11). No roads, no parks.
 * Kept apart from the MapLibre class so the stack and its data can be tested
 * without a WebGL canvas.
 */
export type MapLayerId = 'area-cover' | 'base-land' | 'area-shadow' | 'area-parts';

export interface MapLayerSpec {
  id: MapLayerId;
  /** The GeoJSON source it draws. */
  source: string;
  type: 'fill' | 'line';
  /** The colour token it is painted in, and what to use where tokens can't be read. */
  token: string;
  fallback: string;
  /** Tokens by the feature's `tone` (the 동 tint). */
  tones?: string[];
}

export const TONE_TOKENS = Array.from({ length: PART_TONES }, (_, t) => `--map-tone-${t}`);

export const MAP_LAYERS: MapLayerSpec[] = [
  // Land everywhere, but only while there is no base map (none loaded yet, or
  // no tiles): the screen is never a blank sheet of water.
  { id: 'area-cover', source: 'area-cover', type: 'fill', token: '--map-land', fallback: '#e7ecf3' },
  { id: 'base-land', source: 'base-land', type: 'fill', token: '--map-land', fallback: '#e7ecf3' },
  // One soft shadow along the outside of the split 동 taken as one shape (per
  // 동 it traced every border again — M7's experiment).
  { id: 'area-shadow', source: 'area-outline', type: 'line', token: '--map-shadow', fallback: '#526b9d' },
  // Translucent, so a river running through a 동 still shows as water.
  { id: 'area-parts', source: 'area-parts', type: 'fill', token: '--map-tint', fallback: 'rgba(108, 144, 216, 0.12)', tones: TONE_TOKENS },
];

/** The shadow: how far down it falls, how wide and soft, how strong (px, MapLibre). */
export const SHADOW = { dy: 3, width: 8, blur: 6, opacity: 0.2 };

/** The page under everything: water. */
export const WATER_TOKEN = { token: '--map-water', fallback: '#c9d2e4' };

const WORLD: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
};

const polygons = (list: PolygonRings[], tones?: number[]): GeoJSON.Feature[] =>
  list.map((rings, i) => ({ type: 'Feature', properties: { tone: tones?.[i] ?? 0 }, geometry: { type: 'Polygon', coordinates: rings } }));
const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

/** What a source draws for these shapes. */
export function mapSourceData(source: string, areas: AreaShapes | null): GeoJSON.FeatureCollection {
  const base = areas?.base;
  switch (source) {
    case 'area-cover':
      return collection(areas && !base ? [{ type: 'Feature', properties: {}, geometry: WORLD }] : []);
    case 'base-land':
      return collection(polygons(base?.land ?? []));
    case 'area-outline':
      return collection(polygons(areas?.partsOutline ?? []));
    case 'area-parts':
      return collection(polygons(areas?.parts ?? [], areas?.partTones));
    default:
      return collection([]);
  }
}

/** Sources whose data comes from the base map (re-sent only when it changes). */
export const BASE_SOURCES = ['area-cover', 'base-land'];
/**
 * Sources whose data comes from the admin areas. The neighbouring areas
 * (`others`) are not drawn: they are just land (2026-10-20 decision, §6-1),
 * and a filled 동 would cover the river running through it.
 */
export const AREA_SOURCES = ['area-cover', 'area-outline', 'area-parts'];

/**
 * How many land polygons the Kakao map gets at most: there, every polygon is
 * an SDK object (SVG), and their number is what panning costs. MapLibre
 * draws them all.
 */
export const KAKAO_LAND_LIMIT = 200;

/** How much of the map a polygon covers (its outer ring's box, in degrees²): enough to rank them. */
function boxArea(rings: PolygonRings): number {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [x, y] of rings[0] ?? []) {
    west = Math.min(west, x); east = Math.max(east, x);
    south = Math.min(south, y); north = Math.max(north, y);
  }
  return Math.max(0, east - west) * Math.max(0, north - south);
}

/** The base map's land as the Kakao map draws it: the biggest polygons, within the limit. */
export function pickKakaoLand(base: AreaShapes['base'], limit = KAKAO_LAND_LIMIT): PolygonRings[] {
  const land = base?.land ?? [];
  if (land.length <= limit) return land;
  return land.map((rings) => ({ rings, area: boxArea(rings) })).sort((a, b) => b.area - a.area).slice(0, limit).map((p) => p.rings);
}

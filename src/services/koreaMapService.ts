import { ROAD_TIERS, roadTierVisible, type BaseMap, type BaseRoad, type PolygonRings, type RoadTier } from '../domain/baseMap';
import { metersPerPixel, type Bbox, type LonLat, type MapViewport, type Ring } from '../domain/districtMap';

interface TileLevel { name: string; step: number; tiles: string[] }
interface Manifest { version: number; levels: TileLevel[] }
/** Viewing scales; these do not claim administrative ownership of OSM roads. */
// Streets and footpaths only in the close-up tiles; wider views keep the
// tiers that still read as roads at that scale (see build_base.py).
export const KOREA_MAP_SCALES = [
  { name: 'detail', label: '읍·면·동 / 생활권', maxMetersPerPixel: 6 },
  { name: 'city', label: '시·군·구', maxMetersPerPixel: 60 },
  { name: 'region', label: '시·도', maxMetersPerPixel: 250 },
  { name: 'country', label: '전국', maxMetersPerPixel: Infinity },
] as const;

export function koreaMapLevelIndex(viewport: MapViewport): number {
  const mpp = metersPerPixel(viewport);
  const index = KOREA_MAP_SCALES.findIndex((scale) => mpp < scale.maxMetersPerPixel);
  return index < 0 ? 3 : index;
}
export interface KoreaMapService {
  fetchBaseMap(viewport: MapViewport, signal?: AbortSignal): Promise<BaseMap | null>;
}
const MAX_TILES = 48;
const CACHE_LIMIT = 96;
const BASE = `${import.meta.env.BASE_URL}korea/base/`;
const LEVEL_NAMES = ['detail', 'city', 'region', 'country'];
const LEVEL_STEPS = [.05, .2, 1, 4];

const validPoint = (p: unknown): p is LonLat => Array.isArray(p) && p.length === 2 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const validRing = (ring: unknown): ring is Ring => Array.isArray(ring) && ring.length >= 4 && ring.every(validPoint);
const validPolygons = (value: unknown): value is PolygonRings[] =>
  Array.isArray(value) && value.every((polygon) => Array.isArray(polygon) && polygon.length >= 1 && polygon.every(validRing));

/** Tiles are static assets, but still checked before reaching either SDK. */
export function parseBaseTile(value: unknown): BaseMap | null {
  const tile = value as { land?: unknown; parks?: unknown; roads?: unknown } | null;
  if (!tile || !validPolygons(tile.land) || !validPolygons(tile.parks) || !Array.isArray(tile.roads)) return null;
  const roads: BaseRoad[] = [];
  for (const road of tile.roads as unknown[]) {
    // [tier, [lon0, lat0, lon1, lat1, ...]] keeps the files small.
    if (!Array.isArray(road) || !ROAD_TIERS.includes(road[0]) || !Array.isArray(road[1])) return null;
    const flat = road[1] as unknown[];
    if (flat.length < 4 || flat.length % 2 !== 0) return null;
    const path: LonLat[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const point = [flat[i], flat[i + 1]];
      if (!validPoint(point)) return null;
      path.push(point);
    }
    roads.push({ tier: road[0] as RoadTier, path });
  }
  return { land: tile.land, parks: tile.parks, roads };
}

/** Fixed grid lookup avoids downloading the entire country's geometry. */
export function visibleKoreaTiles(level: TileLevel, bounds: Bbox): string[] {
  const available = new Set(level.tiles);
  const keys: string[] = [];
  const west = Math.max(124, bounds.west), east = Math.min(133, bounds.east);
  const south = Math.max(32, bounds.south), north = Math.min(40, bounds.north);
  for (let x = Math.floor(west / level.step); x < Math.ceil(east / level.step); x++) {
    for (let y = Math.floor(south / level.step); y < Math.ceil(north / level.step); y++) {
      const key = `${x}_${y}`;
      if (available.has(key)) keys.push(key);
    }
  }
  return keys;
}

const ringBbox = (points: LonLat[]): Bbox => {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of points) {
    west = Math.min(west, x); east = Math.max(east, x);
    south = Math.min(south, y); north = Math.max(north, y);
  }
  return { west, south, east, north };
};
const overlaps = (a: Bbox, b: Bbox) => a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;

/** Cache tiles and hand only on-screen features to the map SDK. */
export class StaticKoreaMapService implements KoreaMapService {
  private manifest: Manifest | null = null;
  private cache = new Map<string, BaseMap>();
  async fetchBaseMap(viewport: MapViewport, signal?: AbortSignal): Promise<BaseMap | null> {
    const b = viewport.bounds;
    if (![b.west, b.south, b.east, b.north, viewport.widthPx].every(Number.isFinite) || b.east <= b.west || b.north <= b.south || viewport.widthPx <= 0 || signal?.aborted) return null;
    try {
      if (!this.manifest) {
        const response = await fetch(`${BASE}manifest.json`, { signal });
        if (!response.ok) return null;
        const value = await response.json() as Manifest;
        if (value.version !== 1 || !Array.isArray(value.levels) || value.levels.length !== 4 ||
          !value.levels.every((l, i) => l.name === LEVEL_NAMES[i] && l.step === LEVEL_STEPS[i] && Array.isArray(l.tiles))) return null;
        this.manifest = value;
      }
      let index = koreaMapLevelIndex(viewport);
      let level = this.manifest.levels[index];
      // A little margin keeps wide road lines at the screen edge whole.
      const dx = (b.east - b.west) * 0.1, dy = (b.north - b.south) * 0.1;
      const padded = { west: b.west - dx, east: b.east + dx, south: b.south - dy, north: b.north + dy };
      let keys = visibleKoreaTiles(level, padded);
      while (keys.length > MAX_TILES && index < 3) {
        level = this.manifest.levels[++index];
        keys = visibleKoreaTiles(level, padded);
      }
      const result: BaseMap = { land: [], parks: [], roads: [] };
      // Omitted tiers never reach either SDK's render tree.
      const mpp = metersPerPixel(viewport);
      const shownTiers = ROAD_TIERS.filter((tier) => roadTierVisible(tier, mpp));
      let cursor = 0;
      let failed = false;
      await Promise.all(Array.from({ length: Math.min(6, keys.length) }, async () => {
        while (cursor < keys.length && !signal?.aborted) {
          const key = `${level.name}/${keys[cursor++]}.json`;
          let tile = this.cache.get(key);
          if (!tile) {
            const response = await fetch(`${BASE}${key}`, { signal });
            if (!response.ok) { failed = true; continue; }
            tile = parseBaseTile(await response.json()) ?? undefined;
            if (!tile) { failed = true; continue; }
            this.cache.set(key, tile);
          } else {
            this.cache.delete(key);
            this.cache.set(key, tile);
          }
          if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
          // A detail tile holds thousands of streets. Keep those outside the
          // screen in the cache, not in either SDK's render tree.
          for (const polygon of tile.land) if (overlaps(ringBbox(polygon[0]), padded)) result.land.push(polygon);
          for (const polygon of tile.parks) if (overlaps(ringBbox(polygon[0]), padded)) result.parks.push(polygon);
          for (const road of tile.roads) {
            if (shownTiers.includes(road.tier) && overlaps(ringBbox(road.path), padded)) result.roads.push(road);
          }
        }
      }));
      if (signal?.aborted || failed) return null;
      // Narrow tiers first so wider roads cover them at junctions.
      result.roads.sort((a, c) => c.tier - a.tier);
      return result;
    } catch (error) {
      if (import.meta.env.DEV && !signal?.aborted) console.warn('Base map loading failed', error);
      return null;
    }
  }
}

import type { LonLat } from '../domain/districtMap';
import type { AdminArea } from '../domain/adminAreas';
import { lumpAreas, lumpBox, stopGroups, TERRAIN_MPP, terrainRange, terrainViewport, type TerrainShapes } from '../domain/miniMap';
import { StaticAdminAreaService, type AdminAreaService } from './adminAreaService';
import { StaticKoreaMapService, type KoreaMapService } from './koreaMapService';

/**
 * The few km around the stops, as the areas the main map draws (시군구 split
 * into 읍면동, neighbours whole), and the base map (water, parks, big roads)
 * over the lump those areas make.
 */
export interface TerrainService {
  /** The real map for these stops, or null when there is no data (it never rejects). */
  fetch(centers: LonLat[]): Promise<TerrainShapes | null>;
}

const key = (centers: LonLat[]) => centers.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(' ');

/** Areas of several fetches, each once (the first copy kept). */
const merged = (lists: AdminArea[][]): AdminArea[] => {
  const seen = new Map<string, AdminArea>();
  for (const area of lists.flat()) if (!seen.has(area.code)) seen.set(area.code, area);
  return [...seen.values()];
};

export class AdminTerrainService implements TerrainService {
  private cache = new Map<string, Promise<TerrainShapes | null>>();

  constructor(
    private readonly areas: AdminAreaService = new StaticAdminAreaService(),
    private readonly base: KoreaMapService = new StaticKoreaMapService(),
  ) {}

  fetch(centers: LonLat[]): Promise<TerrainShapes | null> {
    if (centers.length === 0) return Promise.resolve(null);
    const k = key(centers);
    let entry = this.cache.get(k);
    if (!entry) {
      // The area map splits only the few 시군구 around the middle of what it is asked for, so stops far
      // apart are asked for group by group too: every group's own 시군구 come split into 읍면동.
      const groups = stopGroups(centers);
      const asks = groups.length > 1 ? [centers, ...groups] : [centers];
      entry = Promise.all(
        asks.map((stops) =>
          this.areas.fetchAreaMap(terrainViewport(stops), terrainRange(stops)).catch(() => null),
        ),
      ).then((maps) => {
        const got = maps.filter((m) => m !== null);
        if (!got.length) return null;
        const parts = merged(got.map((m) => m.parts));
        const split = new Set(parts.map((a) => a.code));
        return { parts, others: merged(got.map((m) => m.others)).filter((a) => !split.has(a.code)) };
      }).then(async (shapes) => (shapes ? { ...shapes, base: await this.baseFor(shapes, centers) } : null));
      entry.then((shapes) => {
        if (!shapes) this.cache.delete(k);
      });
      this.cache.set(k, entry);
    }
    return entry;
  }

  /** The base map over the whole lump (the widest it is drawn), at the real map's scale; null when it cannot be had. */
  private async baseFor(shapes: TerrainShapes, centers: LonLat[]) {
    const lump = lumpAreas(shapes, centers);
    if (!lump.length) return null;
    const bounds = lumpBox(lump);
    const widthM = (bounds.east - bounds.west) * Math.cos((((bounds.south + bounds.north) / 2) * Math.PI) / 180) * 111320;
    return this.base.fetchBaseMap({ bounds, widthPx: Math.max(1, widthM / TERRAIN_MPP) }).catch(() => null);
  }
}

export const terrainService: TerrainService = new AdminTerrainService();

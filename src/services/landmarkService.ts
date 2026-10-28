import type { MapViewport } from '../domain/districtMap';
import { landmarksEnabled, landmarkScale, parseLandmarks, selectLandmarks, type Landmark } from '../domain/landmarkPlaces';
import type { PlaceRef } from '../types/course';

interface LandmarkIndex { levels: { name: string; step: number; tiles: Set<string> }[] }

/** Small app-bundled tiles; independent of administrative geometry and shops. */
export class LandmarkService {
  private index: Promise<LandmarkIndex | null> | null = null;
  private tiles = new Map<string, Promise<Landmark[]>>();
  constructor(private readonly base = `${import.meta.env.BASE_URL}map-landmarks/`) {}

  async fetch(view: MapViewport): Promise<PlaceRef[]> {
    if (!landmarksEnabled(view)) return [];
    this.index ??= fetch(`${this.base}index.json`, { signal: AbortSignal.timeout(10000) })
      .then(async (r) => {
        if (!r.ok) return null;
        const index = await r.json();
        if (index?.v !== 2 || !Array.isArray(index.levels) || index.levels.length !== 2 ||
          !index.levels.every((level: { name?: unknown; step?: unknown; tiles?: unknown }, i: number) =>
            level.name === ['overview', 'detail'][i] && level.step === [.25, .1][i] && Array.isArray(level.tiles))) return null;
        return { levels: index.levels.map((level: { name: string; step: number; tiles: string[] }) => ({ ...level, tiles: new Set(level.tiles) })) };
      }).catch(() => null);
    const index = await this.index;
    if (!index) { this.index = null; return []; }
    const margin = 2 ** Math.ceil(Math.log2(landmarkScale(view) * 120) - 1e-9);
    const mpp = landmarkScale(view) * 111_320 * Math.cos(37.5 * Math.PI / 180);
    const level = index.levels[mpp <= 4 ? 1 : 0];
    const step = level.step;
    const b = view.bounds, keys: string[] = [];
    for (let x = Math.floor(Math.max(124, b.west - margin) / step); x <= Math.floor(Math.min(132, b.east + margin) / step); x++) {
      for (let y = Math.floor(Math.max(33, b.south - margin) / step); y <= Math.floor(Math.min(39, b.north + margin) / step); y++) {
        const key = `${x}_${y}`;
        if (level.tiles.has(key)) keys.push(`${level.name}/${key}`);
      }
    }
    const lists = await Promise.all(keys.map((key) => this.loadTile(key)));
    return selectLandmarks(lists.flat(), view);
  }

  private loadTile(key: string): Promise<Landmark[]> {
    let entry = this.tiles.get(key);
    if (!entry) {
      entry = fetch(`${this.base}${key}.json`, { signal: AbortSignal.timeout(10000) })
        .then(async (r) => {
          const places = r.ok ? parseLandmarks(await r.json()) : null;
          if (!places && this.tiles.get(key) === entry) this.tiles.delete(key);
          return places ?? [];
        }).catch(() => { if (this.tiles.get(key) === entry) this.tiles.delete(key); return []; });
      this.tiles.set(key, entry);
    } else {
      this.tiles.delete(key);
      this.tiles.set(key, entry);
    }
    if (this.tiles.size > 64) this.tiles.delete(this.tiles.keys().next().value!);
    return entry;
  }
}

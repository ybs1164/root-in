import { areaAt, bboxCenter, bboxOverlaps, focusLevel, type AdminArea, type AreaMap } from '../domain/adminAreas';
import type { PolygonRings } from '../domain/baseMap';
import type { Bbox, LonLat, MapViewport, Ring } from '../domain/districtMap';
import { mapDataRoot } from '../lib/mapData';

/**
 * Administrative areas for the screen (see scripts/korea-data/build_admin.py):
 * sido.json has every 시도, sgg/<시도>.json its 시군구, dong/<시군구>.json its
 * 읍면동. Only the parents around the screen are fetched. (The road-cut
 * files below 읍면동 — section/, block/, walk/, road/ — are no longer read:
 * docs/plan-mainmap-style.md M9.)
 */
export interface AdminAreaService {
  /** All areas in and around the viewport are split. An explicit range is used by share-card terrain. */
  fetchAreaMap(viewport: MapViewport, focusRange?: Bbox, signal?: AbortSignal): Promise<AreaMap | null>;
}

const BASE = `${mapDataRoot()}admin/`;
const MAX_NAME = 40;
const validPoint = (p: unknown): p is LonLat => Array.isArray(p) && p.length === 2 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 120 && p[0] <= 135 && p[1] >= 30 && p[1] <= 45;
const validRing = (ring: unknown): ring is Ring => Array.isArray(ring) && ring.length >= 4 && ring.every(validPoint);
const validBbox = (b: unknown): b is [number, number, number, number] =>
  Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] <= b[2] && b[1] <= b[3];

/** Static files, but still checked before reaching either map SDK. */
export function parseAreas(value: unknown): AdminArea[] | null {
  if (!Array.isArray(value)) return null;
  const areas: AdminArea[] = [];
  for (const item of value as unknown[]) {
    const a = item as { code?: unknown; name?: unknown; bbox?: unknown; rings?: unknown } | null;
    if (!a || typeof a.code !== 'string' || !/^\d{1,10}(-\d{1,4}){0,4}$/.test(a.code) || typeof a.name !== 'string' ||
      a.name.length > MAX_NAME || !validBbox(a.bbox) || !Array.isArray(a.rings)) return null;
    const polygons = a.rings as unknown[];
    if (!polygons.every((p) => Array.isArray(p) && p.length >= 1 && p.every(validRing))) return null;
    const [west, south, east, north] = a.bbox;
    areas.push({ code: a.code, name: a.name, bbox: { west, south, east, north }, polygons: polygons as PolygonRings[] });
  }
  return areas;
}

let warnedMissing = false;

export class StaticAdminAreaService implements AdminAreaService {
  private cache = new Map<string, Promise<AdminArea[] | null>>();

  /**
   * `base` is where the files are. A worker passes the page's absolute URL:
   * with a relative build base ('./'), a URL resolved inside the worker
   * lands next to the worker script (in assets/), not next to the page.
   */
  constructor(private readonly base: string = BASE) {}

  private load(path: string, signal?: AbortSignal): Promise<AdminArea[] | null> {
    let entry = this.cache.get(path);
    if (!entry) {
      // Not tied to one request's signal: a cancelled pan must not poison the cache.
      entry = fetch(`${this.base}${path}`, { signal: AbortSignal.timeout(15000) })
        .then(async (response) => {
          if (!response.ok) {
            // Without the top file the map stays an empty background: say why.
            if (path === 'sido.json' && response.status === 404 && !warnedMissing) {
              warnedMissing = true;
              console.warn(`[root-in] 행정구역 지도 데이터(${this.base}sido.json)가 없어 빈 지도로 보입니다. 지도 데이터 주소(VITE_MAP_DATA_URL)를 확인하거나 public/korea/admin을 함께 배포하세요 (docs/plan-data-hosting.md).`);
            }
            return null;
          }
          const json = await response.json() as unknown;
          return parseAreas(path === 'sido.json' ? (json as { areas?: unknown } | null)?.areas : json);
        })
        .catch(() => null);
      entry.then((areas) => { if (!areas) this.cache.delete(path); });
      this.cache.set(path, entry);
    }
    return signal
      ? Promise.race([entry, new Promise<null>((resolve) => signal.addEventListener('abort', () => resolve(null), { once: true }))])
      : entry;
  }

  /** The 시군구 under a point (the nearest one over water), for lookups keyed by 시군구 code. */
  async sggCodeAt(point: LonLat): Promise<string | null> {
    const sido = await this.load('sido.json');
    const inSido = sido && areaAt(sido, point);
    const sgg = inSido ? await this.load(`sgg/${inSido.code}.json`) : null;
    return (sgg && areaAt(sgg, point))?.code ?? null;
  }

  /** All districts touching the screen, including those across province borders. */
  async sggAreasInBounds(bounds: Bbox): Promise<AdminArea[]> {
    const sido = await this.load('sido.json');
    if (!sido) return [];
    const lists = await Promise.all(sido.filter((a) => bboxOverlaps(a.bbox, bounds)).map((a) => this.load(`sgg/${a.code}.json`)));
    return lists.flatMap((list) => list ?? []).filter((a) => bboxOverlaps(a.bbox, bounds));
  }

  async fetchAreaMap(viewport: MapViewport, focusRange?: Bbox, signal?: AbortSignal): Promise<AreaMap | null> {
    const b = viewport.bounds;
    if (![b.west, b.south, b.east, b.north, viewport.widthPx].every(Number.isFinite) ||
      b.east <= b.west || b.north <= b.south || viewport.widthPx <= 0 || signal?.aborted) return null;
    try {
      const sido = await this.load('sido.json', signal);
      if (!sido || signal?.aborted) return null;
      const padded: Bbox = {
        west: b.west - (b.east - b.west) * 0.5, east: b.east + (b.east - b.west) * 0.5,
        south: b.south - (b.north - b.south) * 0.5, north: b.north + (b.north - b.south) * 0.5,
      };
      const range = focusRange ?? padded;
      const search = { west: Math.min(padded.west, range.west), east: Math.max(padded.east, range.east),
        south: Math.min(padded.south, range.south), north: Math.max(padded.north, range.north) };
      const center = bboxCenter(range);
      const near = (areas: AdminArea[]) => areas.filter((a) => bboxOverlaps(a.bbox, search));
      const inRange = (areas: AdminArea[]) => {
        const first = areaAt(areas, center);
        const visible = areas.filter((a) => bboxOverlaps(a.bbox, range));
        return first ? [first, ...visible.filter((a) => a !== first)] : visible;
      };
      const mapOf = (foci: AdminArea[], parts: AdminArea[], others: AdminArea[]): AreaMap => ({
        focus: { code: foci[0].code, name: foci[0].name },
        alsoFocus: foci.slice(1).map((f) => ({ code: f.code, name: f.name })),
        parts,
        others: others.filter((a) => !foci.includes(a)),
      });

      if (focusLevel(viewport) === 'sido') {
        const foci = inRange(sido);
        if (!foci.length) return null;
        const lists = await Promise.all(foci.map((f) => this.load(`sgg/${f.code}.json`, signal)));
        if (signal?.aborted) return null;
        return mapOf(foci, lists.flatMap((list, i) => list?.length ? list : [foci[i]]), near(sido));
      }

      // A 시군구 near a 시도 border has neighbors in the next 시도 too.
      const homeSido = areaAt(sido, center);
      if (!homeSido) return null;
      const sidoNear = [homeSido, ...near(sido).filter((a) => a !== homeSido)];
      const sggLists = await Promise.all(sidoNear.map((s) => this.load(`sgg/${s.code}.json`, signal)));
      if (signal?.aborted) return null;
      const allSgg = sggLists.flatMap((list, i) => list?.length ? list : [sidoNear[i]]);
      const sggFoci = inRange(allSgg);
      if (!sggFoci.length) return null;
      const sggNear = near(allSgg);
      // From here in the map stays at 읍면동, the smallest shape it draws
      // (docs/plan-mainmap-style.md M9): no finer pieces cut by roads.
      const lists = await Promise.all(sggFoci.map((f) => this.load(`dong/${f.code}.json`, signal)));
      if (signal?.aborted) return null;
      return mapOf(sggFoci, lists.flatMap((list, i) => list?.length ? list : [sggFoci[i]]), sggNear);
    } catch (error) {
      if (import.meta.env.DEV && !signal?.aborted) console.warn('Admin areas loading failed', error);
      return null;
    }
  }
}

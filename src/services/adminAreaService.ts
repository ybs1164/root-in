import { areaAt, bboxCenter, bboxOverlaps, focusLevel, type AdminArea, type AreaMap } from '../domain/adminAreas';
import type { PolygonRings } from '../domain/baseMap';
import type { Bbox, LonLat, MapViewport, Ring } from '../domain/districtMap';

/**
 * Administrative areas for the screen (see scripts/korea-data/build_admin.py):
 * sido.json has every 시도, sgg/<시도>.json its 시군구, dong/<시군구>.json its
 * 읍면동, section/<시군구>.json the road-cut sections (구획) of each 읍면동.
 * Only the parents around the screen are fetched.
 */
export interface AdminAreaService {
  /** `focusAt` picks the main area; defaults to the screen center. */
  fetchAreaMap(viewport: MapViewport, focusAt?: LonLat, signal?: AbortSignal): Promise<AreaMap | null>;
}

const BASE = `${import.meta.env.BASE_URL}korea/admin/`;
/** Neighboring 시도 whose 시군구 are loaded; more only on a very wide screen. */
const MAX_SIDO_FILES = 4;
/** 시군구 whose 읍면동 are loaded around a focused 읍면동. */
const MAX_SGG_FILES = 6;

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
    if (!a || typeof a.code !== 'string' || !/^\d{1,10}(-\d{1,3})?$/.test(a.code) || typeof a.name !== 'string' ||
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

  private load(path: string, signal?: AbortSignal): Promise<AdminArea[] | null> {
    let entry = this.cache.get(path);
    if (!entry) {
      // Not tied to one request's signal: a cancelled pan must not poison the cache.
      entry = fetch(`${BASE}${path}`)
        .then(async (response) => {
          if (!response.ok) {
            // Without the top file the map stays an empty background: say why.
            if (path === 'sido.json' && response.status === 404 && !warnedMissing) {
              warnedMissing = true;
              console.warn(`[root-in] 행정구역 지도 데이터(${BASE}sido.json)가 없어 빈 지도로 보입니다. public/korea/admin을 함께 배포하세요 (scripts/korea-data/README.md).`);
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

  async fetchAreaMap(viewport: MapViewport, focusAt?: LonLat, signal?: AbortSignal): Promise<AreaMap | null> {
    const b = viewport.bounds;
    if (![b.west, b.south, b.east, b.north, viewport.widthPx].every(Number.isFinite) ||
      b.east <= b.west || b.north <= b.south || viewport.widthPx <= 0 || signal?.aborted) return null;
    try {
      const sido = await this.load('sido.json', signal);
      if (!sido || signal?.aborted) return null;
      const center = focusAt ?? bboxCenter(b);
      const padded: Bbox = {
        west: b.west - (b.east - b.west) * 0.5, east: b.east + (b.east - b.west) * 0.5,
        south: b.south - (b.north - b.south) * 0.5, north: b.north + (b.north - b.south) * 0.5,
      };
      const near = (areas: AdminArea[]) => areas.filter((a) => bboxOverlaps(a.bbox, padded));
      const homeSido = areaAt(sido, center);
      if (!homeSido) return null;

      if (focusLevel(viewport) === 'sido') {
        const parts = await this.load(`sgg/${homeSido.code}.json`, signal);
        if (!parts || signal?.aborted) return null;
        return { focus: { code: homeSido.code, name: homeSido.name }, parts, others: near(sido).filter((a) => a !== homeSido) };
      }

      // A 시군구 near a 시도 border has neighbors in the next 시도 too.
      const sidoNear = [homeSido, ...near(sido).filter((a) => a !== homeSido)].slice(0, MAX_SIDO_FILES);
      const sggLists = await Promise.all(sidoNear.map((s) => this.load(`sgg/${s.code}.json`, signal)));
      if (signal?.aborted || !sggLists[0]) return null;
      const focus = areaAt(sggLists[0], center);
      if (!focus) return null;
      const sggNear = near(sggLists.flatMap((list) => list ?? [])).filter((a) => a.code !== focus.code);
      if (focusLevel(viewport) === 'sgg') {
        const parts = await this.load(`dong/${focus.code}.json`, signal);
        if (!parts || signal?.aborted) return null;
        return { focus: { code: focus.code, name: focus.name }, parts, others: sggNear };
      }

      // Zoomed into one 읍면동: its sections, and the 읍면동 around it whole.
      const sggWithDongs = [focus, ...sggNear].slice(0, MAX_SGG_FILES);
      const [sections, ...dongLists] = await Promise.all([
        this.load(`section/${focus.code}.json`, signal),
        ...sggWithDongs.map((s) => this.load(`dong/${s.code}.json`, signal)),
      ]);
      if (signal?.aborted || !sections || !dongLists[0]) return null;
      const dong = areaAt(dongLists[0], center);
      if (!dong) return null;
      const others = [
        ...near(dongLists.flatMap((list) => list ?? [])).filter((a) => a.code !== dong.code),
        // 시군구 whose 읍면동 weren't loaded stay whole.
        ...sggNear.filter((s, i) => !dongLists[i + 1]),
      ];
      const parts = sections.filter((a) => a.code.startsWith(`${dong.code}-`));
      return { focus: { code: dong.code, name: dong.name }, parts, others };
    } catch (error) {
      if (import.meta.env.DEV && !signal?.aborted) console.warn('Admin areas loading failed', error);
      return null;
    }
  }
}

import { areaAt, areasInRange, bboxCenter, bboxOverlaps, FOCUS_RANGE_RATIO, focusLevel, type AdminArea, type AreaMap } from '../domain/adminAreas';
import type { PolygonRings } from '../domain/baseMap';
import type { Bbox, LonLat, MapViewport, Ring } from '../domain/districtMap';

/** The middle of the whole screen, when the caller knows no better range. */
const centerRange = (b: Bbox): Bbox => {
  const [cx, cy] = bboxCenter(b);
  const hw = ((b.east - b.west) * FOCUS_RANGE_RATIO) / 2;
  const hh = ((b.north - b.south) * FOCUS_RANGE_RATIO) / 2;
  return { west: cx - hw, east: cx + hw, south: cy - hh, north: cy + hh };
};

/**
 * Administrative areas for the screen (see scripts/korea-data/build_admin.py):
 * sido.json has every 시도, sgg/<시도>.json its 시군구, dong/<시군구>.json its
 * 읍면동, section/<시군구>.json the road-cut sections (구획) of each 읍면동,
 * block/<시군구>/<읍면동>.json their blocks, walk/<시군구>/<읍면동>.json
 * the pieces of blocks that footways and area borders split (only where any
 * are) and road/<시군구>/<읍면동>.json what is left of each of those once every
 * road inside is cut out.
 * Only the parents around the screen are fetched.
 */
export interface AdminAreaService {
  /** The areas reaching into `focusRange` are split (the middle one is the main); defaults to the screen's middle. */
  fetchAreaMap(viewport: MapViewport, focusRange?: Bbox, signal?: AbortSignal): Promise<AreaMap | null>;
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

  async fetchAreaMap(viewport: MapViewport, focusRange?: Bbox, signal?: AbortSignal): Promise<AreaMap | null> {
    const b = viewport.bounds;
    if (![b.west, b.south, b.east, b.north, viewport.widthPx].every(Number.isFinite) ||
      b.east <= b.west || b.north <= b.south || viewport.widthPx <= 0 || signal?.aborted) return null;
    try {
      const sido = await this.load('sido.json', signal);
      if (!sido || signal?.aborted) return null;
      const range = focusRange ?? centerRange(b);
      const center = bboxCenter(range);
      const padded: Bbox = {
        west: b.west - (b.east - b.west) * 0.5, east: b.east + (b.east - b.west) * 0.5,
        south: b.south - (b.north - b.south) * 0.5, north: b.north + (b.north - b.south) * 0.5,
      };
      const near = (areas: AdminArea[]) => areas.filter((a) => bboxOverlaps(a.bbox, padded));
      const mapOf = (foci: AdminArea[], parts: AdminArea[], others: AdminArea[]): AreaMap => ({
        focus: { code: foci[0].code, name: foci[0].name },
        alsoFocus: foci.slice(1).map((f) => ({ code: f.code, name: f.name })),
        parts,
        others: others.filter((a) => !foci.includes(a)),
      });

      if (focusLevel(viewport) === 'sido') {
        const foci = areasInRange(sido, range);
        if (!foci.length) return null;
        const lists = await Promise.all(foci.map((f) => this.load(`sgg/${f.code}.json`, signal)));
        if (signal?.aborted || !lists[0]) return null;
        return mapOf(foci, lists.flatMap((list) => list ?? []), near(sido));
      }

      // A 시군구 near a 시도 border has neighbors in the next 시도 too.
      const homeSido = areaAt(sido, center);
      if (!homeSido) return null;
      const sidoNear = [homeSido, ...near(sido).filter((a) => a !== homeSido)].slice(0, MAX_SIDO_FILES);
      const sggLists = await Promise.all(sidoNear.map((s) => this.load(`sgg/${s.code}.json`, signal)));
      if (signal?.aborted || !sggLists[0]) return null;
      const allSgg = sggLists.flatMap((list) => list ?? []);
      const sggFoci = areasInRange(allSgg, range);
      const focus = areaAt(sggLists[0], center) ?? sggFoci[0];
      if (!focus) return null;
      const sggNear = near(allSgg);
      if (focusLevel(viewport) === 'sgg') {
        const lists = await Promise.all(sggFoci.map((f) => this.load(`dong/${f.code}.json`, signal)));
        if (signal?.aborted || !lists[0]) return null;
        return mapOf(sggFoci, lists.flatMap((list) => list ?? []), sggNear);
      }

      // Zoomed into 읍면동: their sections, and the 읍면동 around them whole.
      const sggWithDongs = [focus, ...sggNear.filter((a) => a.code !== focus.code)].slice(0, MAX_SGG_FILES);
      const [firstSections, ...dongLists] = await Promise.all([
        this.load(`section/${focus.code}.json`, signal),
        ...sggWithDongs.map((s) => this.load(`dong/${s.code}.json`, signal)),
      ]);
      if (signal?.aborted || !firstSections || !dongLists[0]) return null;
      const dongFoci = areasInRange(dongLists.flatMap((list) => list ?? []), range);
      if (!dongFoci.length) return null;
      // A focused 읍면동 across a 시군구 line needs that 시군구's sections too.
      const sectionsOf = new Map<string, AdminArea[]>([[focus.code, firstSections]]);
      await Promise.all(dongFoci.map(async (dong) => {
        const owner = sggWithDongs.find((_, i) => dongLists[i]?.includes(dong));
        if (!owner || sectionsOf.has(owner.code)) return;
        const list = await this.load(`section/${owner.code}.json`, signal);
        if (list) sectionsOf.set(owner.code, list);
      }));
      if (signal?.aborted) return null;
      const sections = [...sectionsOf.values()].flat();
      const others = [
        ...near(dongLists.flatMap((list) => list ?? [])),
        // 시군구 whose 읍면동 weren't loaded stay whole.
        ...sggNear.filter((s) => !sggWithDongs.some((w, i) => w.code === s.code && dongLists[i])),
      ];
      const under = (area: AdminArea, parents: AdminArea[]) => parents.some((p) => area.code.startsWith(`${p.code}-`));
      const parts = sections.filter((a) => under(a, dongFoci));
      const level = focusLevel(viewport);
      if (level === 'dong') return mapOf(dongFoci, parts, others);

      // Closer in, each step splits the areas reaching into the range one
      // level further; the rest of their parent stays whole at the level
      // above. A part without finer pieces (no file, or no road cuts it) is
      // drawn whole, so missing files only make the map coarser.
      const sggOf = (dong: AdminArea) => sggWithDongs.find((_, i) => dongLists[i]?.includes(dong))?.code;
      const filesOf = (folder: string, dongs: AdminArea[]) => Promise.all(dongs.map((d) => {
        const sgg = sggOf(d);
        return sgg ? this.load(`${folder}/${sgg}/${d.code}.json`, signal) : Promise.resolve(null);
      }));
      const splitInto = (foci: AdminArea[], pieces: AdminArea[]) =>
        foci.flatMap((f) => { const own = pieces.filter((p) => under(p, [f])); return own.length ? own : [f]; });
      const otherDongs = others.filter((a) => !dongFoci.includes(a));

      const sectionFoci = areasInRange(parts, range);
      if (!sectionFoci.length) return mapOf(dongFoci, parts, others);
      const blocks = (await filesOf('block', dongFoci)).flatMap((list) => list ?? []);
      if (signal?.aborted) return null;
      const sectionMap = mapOf(sectionFoci, splitInto(sectionFoci, blocks), [
        ...near(parts.filter((s) => !sectionFoci.includes(s))), ...otherDongs,
      ]);
      if (level === 'section') return sectionMap;

      // Footways split only some blocks; when none of the focused ones is,
      // the drawing stays as it was a step out.
      const blockFoci = areasInRange(blocks, range);
      const walkDongs = dongFoci.filter((d) => blockFoci.some((b) => b.code.startsWith(`${d.code}-`)));
      const pieces = (await filesOf('walk', walkDongs)).flatMap((list) => list ?? []).filter((p) => under(p, blockFoci));
      if (signal?.aborted) return null;
      const parentCode = (a: AdminArea) => a.code.slice(0, a.code.lastIndexOf('-'));
      const blockSections = new Set(blockFoci.map(parentCode));
      // The walk drawing: a split block's pieces, any other block whole.
      const walkParts = splitInto(blockFoci, pieces);
      const walkOthers = [
        ...near(blocks.filter((b) => !blockFoci.includes(b) && blockSections.has(parentCode(b)))),
        ...near(parts.filter((s) => !blockSections.has(s.code))),
        ...otherDongs,
      ];
      const walkMap = pieces.length ? mapOf(blockFoci, walkParts, walkOthers) : sectionMap;
      if (level === 'block') return walkMap;

      // Closest: each piece the focus reaches is cut by the roads inside it.
      const leafFoci = areasInRange(walkParts, range);
      const roadDongs = dongFoci.filter((d) => leafFoci.some((l) => l.code.startsWith(`${d.code}-`)));
      const roadPieces = (await filesOf('road', roadDongs)).flatMap((list) => list ?? []).filter((p) => under(p, leafFoci));
      if (signal?.aborted) return null;
      if (!roadPieces.length) return walkMap;
      return mapOf(leafFoci, splitInto(leafFoci, roadPieces), [
        ...near(walkParts.filter((p) => !leafFoci.includes(p))), ...walkOthers.filter((a) => !walkParts.includes(a)),
      ]);
    } catch (error) {
      if (import.meta.env.DEV && !signal?.aborted) console.warn('Admin areas loading failed', error);
      return null;
    }
  }
}

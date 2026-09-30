import type { Bbox, LonLat, RoadKind, RoadSegment } from '../domain/districtMap';

export interface RoadQuery {
  bbox: Bbox;
  includeMinor: boolean;
}

/** Road center lines for the illustrated map. Never rejects: failure → []. */
export interface RoadNetworkService {
  fetchRoads(query: RoadQuery, signal?: AbortSignal): Promise<RoadSegment[]>;
}

// Keyless OSM data. Works the same whichever map provider is showing, since
// Kakao doesn't expose its road geometry.
// Public instances rate-limit hard (429) and go down; try them in order.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_WAYS = 5000;
const MAX_POINTS_PER_WAY = 2000;

const MAJOR = ['motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link'];
const MINOR = ['tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'pedestrian'];

export const roadKindOf = (highway: string): RoadKind | null =>
  MAJOR.includes(highway) ? 'major' : MINOR.includes(highway) ? 'minor' : null;

export function buildOverpassQuery({ bbox, includeMinor }: RoadQuery): string {
  const classes = includeMinor ? [...MAJOR, ...MINOR] : [...MAJOR, 'tertiary'];
  const b = [bbox.south, bbox.west, bbox.north, bbox.east].map((n) => n.toFixed(5)).join(',');
  // Tunnels would carve roads through blocks that are really above ground.
  return `[out:json][timeout:12];way(${b})[highway~"^(${classes.join('|')})$"][tunnel!~"yes"][area!~"yes"];out geom;`;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Overpass JSON is external input: check the shape, drop anything odd. */
export function parseOverpassRoads(data: unknown): RoadSegment[] {
  const elements = (data as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];
  const roads: RoadSegment[] = [];
  for (const el of elements.slice(0, MAX_WAYS)) {
    const way = el as {
      type?: unknown;
      tags?: { highway?: unknown; oneway?: unknown; name?: unknown };
      geometry?: unknown;
    };
    if (way?.type !== 'way' || typeof way.tags?.highway !== 'string' || !Array.isArray(way.geometry)) continue;
    const kind = roadKindOf(way.tags.highway);
    if (!kind) continue;
    const path: LonLat[] = [];
    for (const node of way.geometry.slice(0, MAX_POINTS_PER_WAY)) {
      const { lat, lon } = (node ?? {}) as { lat?: unknown; lon?: unknown };
      if (isFiniteNumber(lat) && isFiniteNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) path.push([lon, lat]);
    }
    if (path.length < 2) continue;
    const road: RoadSegment = { kind, path };
    // One carriageway of a divided road; ramps are oneway too but aren't paired.
    const oneway = way.tags.oneway;
    if ((oneway === 'yes' || oneway === '1' || oneway === '-1') && !way.tags.highway.endsWith('_link')) {
      road.oneway = true;
      if (oneway === '-1') path.reverse();
    }
    if (typeof way.tags.name === 'string') road.name = way.tags.name.slice(0, 100);
    roads.push(road);
  }
  return roads;
}

export class OverpassRoadNetwork implements RoadNetworkService {
  constructor(private readonly endpoints: string[] = OVERPASS_ENDPOINTS) {}

  async fetchRoads(query: RoadQuery, signal?: AbortSignal): Promise<RoadSegment[]> {
    const body = buildOverpassQuery(query);
    for (const endpoint of this.endpoints) {
      if (signal?.aborted) return [];
      const data = await this.attempt(endpoint, body, signal);
      if (data !== null) return parseOverpassRoads(data);
    }
    return [];
  }

  /** One endpoint; null means "try the next one". */
  private async attempt(endpoint: string, query: string, externalSignal?: AbortSignal): Promise<unknown | null> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort);
    const timeoutId = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
}

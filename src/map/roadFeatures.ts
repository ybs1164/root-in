/**
 * Road data pulled out of the basemap's vector tiles as plain GeoJSON, so we
 * can draw roads in our own style (or hand them to anything else) instead of
 * relying on the provider's rendering. Source schema: OpenMapTiles, as served
 * by Carto (`transportation` / `transportation_name` source layers).
 */

/** How prominently a road is drawn; OpenMapTiles has too many classes to style one by one. */
export type RoadRank = 'major' | 'mid' | 'minor' | 'path';

export interface RoadProperties {
  kind: 'road' | 'name';
  rank: RoadRank;
  /** Only on `kind: 'name'` features. */
  name?: string;
}

export type RoadCollection = GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString, RoadProperties>;

const RANK: Record<string, RoadRank> = {
  motorway: 'major',
  trunk: 'major',
  primary: 'major',
  secondary: 'mid',
  tertiary: 'mid',
  minor: 'minor',
  service: 'minor',
  path: 'path',
  track: 'path',
};

/** Rail, ferry, transit, … are in the same source layer but aren't roads. */
export function roadRank(roadClass: unknown): RoadRank | null {
  return typeof roadClass === 'string' ? (RANK[roadClass] ?? null) : null;
}

/** The minimum a tile feature needs; MapLibre's query results satisfy it. */
export interface TileFeature {
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown> | null;
}

/**
 * Tile queries return the same road once per tile it crosses (each clipped
 * to that tile) and repeat features across overlapping zoom levels, so
 * dedupe by exact geometry. Clipped pieces stay separate; round line caps
 * hide the seams when drawn.
 */
export function toRoadCollection(roads: TileFeature[], names: TileFeature[] = []): RoadCollection {
  const seen = new Set<string>();
  const features: RoadCollection['features'] = [];
  const add = (f: TileFeature, kind: RoadProperties['kind']) => {
    const g = f.geometry;
    if (g.type !== 'LineString' && g.type !== 'MultiLineString') return;
    const rank = roadRank(f.properties?.class);
    if (!rank) return;
    const name = kind === 'name' ? f.properties?.name : undefined;
    if (kind === 'name' && (typeof name !== 'string' || name.trim() === '')) return;
    const key = `${kind}|${JSON.stringify(g.coordinates)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const properties: RoadProperties = kind === 'name' ? { kind, rank, name: name as string } : { kind, rank };
    features.push({ type: 'Feature', properties, geometry: g });
  };
  roads.forEach((f) => add(f, 'road'));
  names.forEach((f) => add(f, 'name'));
  return { type: 'FeatureCollection', features };
}

type LngLat = [number, number];
type Xy = [number, number];

const METERS_PER_DEG = 111_320;

/** Local flat projection in meters; plenty accurate at course scale (a few km). */
function projector(originLat: number) {
  const kx = METERS_PER_DEG * Math.cos((originLat * Math.PI) / 180);
  return ([lng, lat]: LngLat): Xy => [lng * kx, lat * METERS_PER_DEG];
}

function pointSegmentDistance([px, py]: Xy, [ax, ay]: Xy, [bx, by]: Xy): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToPolyline(p: Xy, line: Xy[]): number {
  if (line.length === 1) return Math.hypot(p[0] - line[0][0], p[1] - line[0][1]);
  let min = Infinity;
  for (let i = 1; i < line.length; i++) min = Math.min(min, pointSegmentDistance(p, line[i - 1], line[i]));
  return min;
}

/**
 * Keeps only the stretches of road within `meters` of the course's straight
 * stop-to-stop line — the roads you'd look at to walk that course. This is a
 * corridor, not routing (CLAUDE.md: no real path finding).
 *
 * Road segments are split into steps of at most a quarter of `meters`, so a
 * long straight road is cut close to the corridor edge instead of being kept
 * or dropped whole.
 */
export function clipToCorridor(roads: RoadCollection, route: LngLat[], meters: number): RoadCollection {
  if (route.length === 0) return { type: 'FeatureCollection', features: [] };
  const project = projector(route[0][1]);
  const routeXy = route.map(project);
  const step = meters / 4;
  const inside = (p: LngLat) => distanceToPolyline(project(p), routeXy) <= meters;

  const clipLine = (line: GeoJSON.Position[]): LngLat[][] => {
    const runs: LngLat[][] = [];
    let run: LngLat[] = [];
    const flush = () => {
      if (run.length >= 2) runs.push(run);
      run = [];
    };
    for (let i = 0; i < line.length; i++) {
      const b = line[i] as LngLat;
      // Densify the segment ending at `b` so the cut lands near the edge.
      const points: LngLat[] = [b];
      if (i > 0) {
        const a = line[i - 1] as LngLat;
        const [ax, ay] = project(a);
        const [bx, by] = project(b);
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
        points.length = 0;
        for (let k = 1; k <= n; k++) points.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
        if (n === 0) points.push(b);
      }
      for (const p of points) {
        if (inside(p)) run.push(p);
        else flush();
      }
    }
    flush();
    return runs;
  };

  const features: RoadCollection['features'] = [];
  for (const f of roads.features) {
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const runs = lines.flatMap(clipLine);
    if (runs.length === 0) continue;
    const geometry: GeoJSON.LineString | GeoJSON.MultiLineString =
      runs.length === 1 ? { type: 'LineString', coordinates: runs[0] } : { type: 'MultiLineString', coordinates: runs };
    features.push({ ...f, geometry });
  }
  return { type: 'FeatureCollection', features };
}

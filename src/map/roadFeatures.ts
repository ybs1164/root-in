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

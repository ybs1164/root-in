import { describe, expect, it } from 'vitest';
import { clipToCorridor, roadRank, toRoadCollection, type RoadCollection, type TileFeature } from './roadFeatures';

const line = (coords: [number, number][], properties: Record<string, unknown>): TileFeature => ({
  geometry: { type: 'LineString', coordinates: coords },
  properties,
});

describe('road features from vector tiles', () => {
  it('ranks OpenMapTiles road classes and drops non-roads', () => {
    expect(roadRank('primary')).toBe('major');
    expect(roadRank('tertiary')).toBe('mid');
    expect(roadRank('service')).toBe('minor');
    expect(roadRank('path')).toBe('path');
    expect(roadRank('rail')).toBeNull();
    expect(roadRank('ferry')).toBeNull();
    expect(roadRank(undefined)).toBeNull();
  });

  it('dedupes the copies a tile query returns and keeps only named labels', () => {
    const a = line([[126.97, 37.52], [126.98, 37.53]], { class: 'minor' });
    const out = toRoadCollection(
      [a, { ...a }, line([[126.9, 37.5], [126.91, 37.5]], { class: 'rail' }), { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { class: 'minor' } }],
      [line([[126.97, 37.52], [126.98, 37.53]], { class: 'primary', name: '한강대로' }), line([[1, 1], [2, 2]], { class: 'minor', name: ' ' })],
    );
    expect(out.features.map((f) => f.properties)).toEqual([
      { kind: 'road', rank: 'minor' },
      { kind: 'name', rank: 'major', name: '한강대로' },
    ]);
  });
});

describe('clipToCorridor', () => {
  // Along the equator 1e-3 deg ≈ 111 m in both axes, which keeps the numbers readable.
  const roads = (...lines: [number, number][][]): RoadCollection => ({
    type: 'FeatureCollection',
    features: lines.map((coordinates) => ({ type: 'Feature', properties: { kind: 'road', rank: 'minor' }, geometry: { type: 'LineString', coordinates } })),
  });
  const route: [number, number][] = [[0, 0], [0.01, 0]]; // ~1.1 km east-west

  it('drops roads that never come near the course', () => {
    expect(clipToCorridor(roads([[0, 0.005], [0.01, 0.005]]), route, 100).features).toEqual([]);
  });

  it('keeps a road running alongside the course whole', () => {
    const out = clipToCorridor(roads([[0, 0.0005], [0.01, 0.0005]]), route, 100);
    const line = out.features[0].geometry as GeoJSON.LineString;
    expect(line.coordinates[0]).toEqual([0, 0.0005]);
    expect(line.coordinates.at(-1)).toEqual([0.01, 0.0005]);
  });

  it('cuts a crossing road at the corridor edge', () => {
    const out = clipToCorridor(roads([[0.005, -0.01], [0.005, 0.01]]), route, 100);
    const ys = (out.features[0].geometry as GeoJSON.LineString).coordinates.map((c) => c[1]);
    // 100 m ≈ 0.0009 deg; the cut lands within one 25 m step of it.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.0009);
    expect(Math.min(...ys)).toBeLessThan(-0.0006);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.0009);
    expect(Math.max(...ys)).toBeGreaterThan(0.0006);
  });

  it('splits a road that leaves and re-enters the corridor', () => {
    const out = clipToCorridor(roads([[0, 0], [0, 0.005], [0.01, 0.005], [0.01, 0]]), route, 100);
    expect(out.features[0].geometry.type).toBe('MultiLineString');
  });
});

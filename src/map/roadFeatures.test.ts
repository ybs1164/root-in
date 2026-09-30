import { describe, expect, it } from 'vitest';
import { roadRank, toRoadCollection, type TileFeature } from './roadFeatures';

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

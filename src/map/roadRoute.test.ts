import { describe, expect, it } from 'vitest';
import type { RoadCollection } from './roadFeatures';
import { roadsAlongCourse } from './roadRoute';

// Near the equator 1e-3 deg ≈ 111 m on both axes, which keeps numbers readable.
const roads = (...lines: [number, number][][]): RoadCollection => ({
  type: 'FeatureCollection',
  features: lines.map((coordinates) => ({ type: 'Feature', properties: { kind: 'road', rank: 'minor' }, geometry: { type: 'LineString', coordinates } })),
});
const coords = (r: RoadCollection) => r.features.flatMap((f) => (f.geometry as GeoJSON.LineString).coordinates);

describe('roadsAlongCourse', () => {
  const cross = roads(
    [[-0.002, 0], [0, 0], [0.002, 0]],
    [[0, -0.002], [0, 0], [0, 0.002]],
  );

  it('draws the street the course runs along, corner to corner, and nothing else', () => {
    const { roads: out, missedLegs } = roadsAlongCourse(cross, [[-0.001, 0.0001], [0.001, 0.0001]]);
    expect(missedLegs).toBe(0);
    const pts = coords(out);
    expect(pts.every(([, y]) => Math.abs(y) < 1e-9)).toBe(true);
    expect(Math.min(...pts.map(([x]) => x))).toBeCloseTo(-0.002, 6);
    expect(Math.max(...pts.map(([x]) => x))).toBeCloseTo(0.002, 6);
  });

  it('turns at a junction when the course does', () => {
    const { roads: out } = roadsAlongCourse(cross, [[-0.001, 0.0001], [0.0001, 0.001]]);
    const pts = coords(out);
    expect(pts.some(([x, y]) => x === 0 && y > 0.0019)).toBe(true); // up the vertical arm
    expect(pts.some(([x, y]) => x === 0 && y < -0.0019)).toBe(false); // not down it
  });

  it('reconnects a street that tile clipping split into overlapping pieces', () => {
    // As querySourceFeatures returns it: two pieces overlapping by ~20 m, no shared vertex.
    const seam = roads([[0, 0], [0.0011, 0]], [[0.0009, 0.00001], [0.002, 0.00001]]);
    const { roads: out, missedLegs } = roadsAlongCourse(seam, [[0.0001, 0.0001], [0.0019, 0.0001]]);
    expect(missedLegs).toBe(0);
    expect(out.features).toHaveLength(1);
    const xs = coords(out).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(0.002, 6);
  });

  it('reports legs it cannot route', () => {
    const apart = roads([[0, 0], [0.002, 0]], [[0, 0.005], [0.002, 0.005]]);
    expect(roadsAlongCourse(apart, [[0.001, 0], [0.001, 0.005]]).missedLegs).toBe(1);
    // A stop ~500 m from any road.
    expect(roadsAlongCourse(cross, [[-0.001, 0], [0.005, 0.005]]).missedLegs).toBe(1);
  });
});

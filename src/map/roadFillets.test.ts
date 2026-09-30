import { describe, expect, it } from 'vitest';
import { projection } from './localProjection';
import type { RoadCollection } from './roadFeatures';
import { junctionFillets } from './roadFillets';

// Lines built in local meters around the equator, then converted to lng/lat.
const proj = projection(0);
const roads = (...lines: [number, number][][]): RoadCollection => ({
  type: 'FeatureCollection',
  features: lines.map((pts) => ({
    type: 'Feature',
    properties: { kind: 'road', rank: 'minor' },
    geometry: { type: 'LineString', coordinates: pts.map(proj.toLngLat) },
  })),
});
const ringMeters = (f: GeoJSON.Feature<GeoJSON.Polygon>) => f.geometry.coordinates[0].map((c) => proj.toXy(c as [number, number]));

describe('junctionFillets', () => {
  it('rounds all four corners of a crossing', () => {
    const cross = roads([[0, 0], [200, 0]], [[0, 0], [-200, 0]], [[0, 0], [0, 200]], [[0, 0], [0, -200]]);
    const out = junctionFillets(cross, 10, 15);
    expect(out.features).toHaveLength(4);
    // The north-east patch starts at the block corner (10, 10) and stays in that block's corner.
    const ne = out.features.map(ringMeters).find(([c]) => c[0] > 0 && c[1] > 0)!;
    expect(ne[0][0]).toBeCloseTo(10, 6);
    expect(ne[0][1]).toBeCloseTo(10, 6);
    for (const [x, y] of ne) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(25 + 1e-6); // tangent point: w + r along the arm
    }
  });

  it('rounds only the two inside corners of a T', () => {
    const tee = roads([[0, 0], [200, 0]], [[0, 0], [-200, 0]], [[0, 0], [0, 200]]);
    expect(junctionFillets(tee, 10, 15).features).toHaveLength(2);
  });

  it('leaves a straight join and a lone dead end alone', () => {
    expect(junctionFillets(roads([[0, 0], [200, 0]], [[0, 0], [-200, 0]]), 10, 15).features).toHaveLength(0);
    expect(junctionFillets(roads([[0, 0], [200, 0]]), 10, 15).features).toHaveLength(0);
  });

  it('shrinks the radius to fit a short arm', () => {
    const short = roads([[0, 0], [200, 0]], [[0, 0], [0, 20]]);
    const [f] = junctionFillets(short, 10, 50).features;
    const ys = ringMeters(f).map(([, y]) => y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(20);
  });
});

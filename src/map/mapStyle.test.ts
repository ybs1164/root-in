import { describe, expect, it } from 'vitest';
import type { AreaShapes } from '../domain/adminAreas';
import { metersPerPixelAtZoom, roadWidthPx } from '../domain/baseMap';
import type { Ring } from '../domain/districtMap';
import { AREA_SOURCES, BASE_SOURCES, MAP_LAYERS, mapSourceData, roadWidthExpression } from './mapStyle';

const ring: Ring = [[127, 37], [127.01, 37], [127.01, 37.01], [127, 37.01], [127, 37]];
const areas: AreaShapes = { parts: [[ring]], others: [[ring], [ring]] };
const withBase: AreaShapes = {
  ...areas,
  base: { land: [[ring]], parks: [[ring], [ring]], roads: [{ tier: 4, path: [[127, 37], [127.01, 37]] }, { tier: 1, path: [[127, 37.005], [127.01, 37.005]] }] },
};

/** Reads `roadWidthExpression` at one zoom stop for one tier. */
function widthAt(expression: unknown[], zoom: number, tier: number): number {
  const stops = expression.slice(3);
  const match = stops[stops.indexOf(zoom) + 1] as unknown[];
  return match[match.indexOf(tier, 2) + 1] as number;
}

describe('main map style', () => {
  it('stacks land, the 동 tint, parks and roads in that order, over water', () => {
    expect(MAP_LAYERS.map((l) => l.id)).toEqual(['area-cover', 'base-land', 'area-parts', 'base-parks', 'base-road-edge', 'base-roads']);
    expect(MAP_LAYERS.find((l) => l.id === 'area-parts')!.token).toBe('--map-tint');
    // Every layer's token is a map role (styles.css), so the dark scheme repaints them all.
    for (const layer of MAP_LAYERS) expect(layer.token).toMatch(/^--map-/);
  });

  it('covers the page with land only while there is no base map, so the screen is never all water', () => {
    expect(mapSourceData('area-cover', areas).features).toHaveLength(1);
    expect(mapSourceData('area-cover', withBase).features).toHaveLength(0);
    expect(mapSourceData('area-cover', null).features).toHaveLength(0);
  });

  it('draws the base map and the tinted 동, but not the neighbouring areas (they are just land)', () => {
    expect(mapSourceData('base-land', withBase).features).toHaveLength(1);
    expect(mapSourceData('base-parks', withBase).features).toHaveLength(2);
    expect(mapSourceData('area-parts', withBase).features).toHaveLength(1);
    expect(MAP_LAYERS.some((l) => l.source === 'area-others')).toBe(false);
    const roads = mapSourceData('base-roads', withBase).features;
    expect(roads.map((r) => r.properties?.tier)).toEqual([4, 1]);
    expect(roads[0].geometry).toEqual({ type: 'LineString', coordinates: [[127, 37], [127.01, 37]] });
    // Sources the updates re-send cover every source a layer draws.
    expect(new Set([...AREA_SOURCES, ...BASE_SOURCES])).toEqual(new Set(MAP_LAYERS.map((l) => l.source)));
  });

  it('gives roads the same widths as the base map rules, by zoom and tier', () => {
    const expression = roadWidthExpression();
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['exponential', 2], ['zoom']]);
    for (const zoom of [8, 12, 16]) {
      for (const tier of [1, 2, 3, 4, 5] as const) {
        expect(widthAt(expression, zoom, tier)).toBeCloseTo(roadWidthPx(tier, metersPerPixelAtZoom(zoom, 36.5)), 1);
      }
    }
    // Zoomed out, streets are hidden (0 wide); avenues stay.
    expect(widthAt(expression, 8, 4)).toBe(0);
    expect(widthAt(expression, 8, 1)).toBeGreaterThan(0);
  });

  it('puts a slightly wider edge only under trunk roads', () => {
    const edge = roadWidthExpression(2, [1]);
    expect(widthAt(edge, 14, 1)).toBeCloseTo(widthAt(roadWidthExpression(), 14, 1) + 2, 1);
    expect(widthAt(edge, 14, 2)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { AreaShapes } from '../domain/adminAreas';
import type { Ring } from '../domain/districtMap';
import { AREA_SOURCES, BASE_SOURCES, MAP_LAYERS, mapSourceData, pickKakaoLand } from './mapStyle';

const ring: Ring = [[127, 37], [127.01, 37], [127.01, 37.01], [127, 37.01], [127, 37]];
const areas: AreaShapes = { parts: [[ring]], others: [[ring], [ring]] };
const withBase: AreaShapes = { ...areas, base: { land: [[ring]] } };

describe('main map style', () => {
  it('draws roads and parks over the land and district tints', () => {
    expect(MAP_LAYERS.map((l) => l.id)).toEqual(['area-cover', 'base-land', 'area-shadow', 'area-parts', 'base-parks', 'base-roads']);
    expect(MAP_LAYERS.find((l) => l.id === 'base-roads')?.type).toBe('line');
    expect(MAP_LAYERS.find((l) => l.id === 'area-shadow')!.source).toBe('area-drop');
    expect(MAP_LAYERS.find((l) => l.id === 'area-parts')!.tones).toEqual(['--map-tone-0', '--map-tone-1', '--map-tone-2']);
    // Every layer's token is a map role (styles.css), so the dark scheme repaints them all.
    for (const layer of MAP_LAYERS) expect(layer.token).toMatch(/^--map-/);
  });

  it('gives each part its tone and the shadow its own shape', () => {
    const toned: AreaShapes = { ...withBase, parts: [[ring], [ring]], partTones: [2, 0], partsOutline: [[ring]], partsDrop: [[ring], [ring]] };
    expect(mapSourceData('area-parts', toned).features.map((f) => f.properties?.tone)).toEqual([2, 0]);
    expect(mapSourceData('area-outline', toned).features).toHaveLength(1);
    expect(mapSourceData('area-drop', toned).features).toHaveLength(2);
  });

  it('sends park geometry and road widths to the renderer', () => {
    const shapes: AreaShapes = { ...areas, base: { land: [[ring]], parks: [[ring]], roads: [{ path: ring, width: 4, tier: 4 }] } };
    expect(mapSourceData('base-parks', shapes).features).toHaveLength(1);
    expect(mapSourceData('base-roads', shapes).features[0]).toMatchObject({ properties: { width: 4 }, geometry: { type: 'LineString', coordinates: ring } });
  });

  it('covers the page with land only while there is no base map, so the screen is never all water', () => {
    expect(mapSourceData('area-cover', areas).features).toHaveLength(1);
    expect(mapSourceData('area-cover', withBase).features).toHaveLength(0);
    expect(mapSourceData('area-cover', null).features).toHaveLength(0);
  });

  it('draws the base land and the tinted 동, but not the neighbouring areas (they are just land)', () => {
    expect(mapSourceData('base-land', withBase).features).toHaveLength(1);
    expect(mapSourceData('area-parts', withBase).features).toHaveLength(1);
    expect(MAP_LAYERS.some((l) => l.source === 'area-others')).toBe(false);
    // Sources the updates re-send cover every source a layer draws.
    expect(new Set([...AREA_SOURCES, ...BASE_SOURCES])).toEqual(new Set(MAP_LAYERS.map((l) => l.source)));
  });
});

describe('the base land on Kakao', () => {
  const square = (x: number, size: number): Ring => [[x, 37], [x + size, 37], [x + size, 37 + size], [x, 37 + size], [x, 37]];

  it('keeps the biggest land polygons within the limit', () => {
    const land = [square(127, 0.001), square(127.1, 0.05), square(127.2, 0.01)].map((r) => [r]);
    expect(pickKakaoLand({ land }, 2).map((p) => p[0][0][0])).toEqual([127.1, 127.2]);
    expect(pickKakaoLand({ land }, 5)).toHaveLength(3);
  });

  it('is empty without a base map', () => {
    expect(pickKakaoLand(undefined)).toEqual([]);
  });
});

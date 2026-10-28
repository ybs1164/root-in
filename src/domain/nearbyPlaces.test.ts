import { describe, expect, it } from 'vitest';
import type { MapViewport } from './districtMap';
import type { KindShop } from './placeMatch';
import { selectNearbyPlaces } from './nearbyPlaces';

const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const shop = (name: string, x: number, y: number, kind: KindShop['kind'] = 'cafe'): KindShop => ({ name, x, y, kind });
const a = shop('동네카페', 12700400, 3700500);
const b = shop('식당', 12700800, 3700700, 'restaurant');

describe('nearby place selection', () => {
  it('shows only on-screen places at neighborhood scale with the right kinds', () => {
    const places = selectNearbyPlaces([a, b, shop('화면 밖', 12800000, 3700500)], viewport);
    expect(places.map((p) => [p.name, p.kind, p.center])).toEqual([
      ['동네카페', 'cafe', [127.004, 37.005]], ['식당', 'restaurant', [127.008, 37.007]],
    ]);
    expect(selectNearbyPlaces([a], { ...viewport, widthPx: 40 })).toEqual([]);
  });

  it('spaces crowded icons and co-located shops consistently regardless of file order', () => {
    const shops = [a, { ...a, name: '같은 건물', kind: 'restaurant' as const }, b, { ...b, x: b.x + 1 }];
    const selected = selectNearbyPlaces(shops, viewport);
    expect(selected).toHaveLength(2);
    expect(selectNearbyPlaces([...shops].reverse(), viewport)).toEqual(selected);
    expect(new Set(selected.map((p) => p.id)).size).toBe(2);
  });

  it('keeps icons clear of covered panels and the actual rotated screen edges', () => {
    expect(selectNearbyPlaces([a, b], viewport, { left: 0, right: 120, top: 0, bottom: 0 }).map((p) => p.name)).toEqual(['동네카페']);
    const rotated = { ...viewport, screen: { width: 160, height: 160, bearing: 45 } };
    expect(selectNearbyPlaces([a, b], rotated).map((p) => p.name)).toEqual(['동네카페']);
  });
});

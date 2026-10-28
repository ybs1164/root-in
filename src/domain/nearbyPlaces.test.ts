import { describe, expect, it } from 'vitest';
import type { MapViewport } from './districtMap';
import type { KindShop } from './placeMatch';
import { nearbyPlaceAt, nearbyPlaceBounds, nearbyPlacesEnabled, selectNearbyPlaces } from './nearbyPlaces';

const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const shop = (name: string, x: number, y: number, kind: KindShop['kind'] = 'cafe'): KindShop => ({ name, x, y, kind });
const a = shop('동네카페', 12700400, 3700500);
const b = shop('식당', 12700800, 3700700, 'restaurant');

describe('nearby place selection', () => {
  it('shows local places at neighborhood scale with the right kinds', () => {
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

  it('keeps the same representatives when the screen rotates or resizes at the same scale', () => {
    const rotated = { ...viewport, screen: { width: 160, height: 160, bearing: 45 } };
    expect(selectNearbyPlaces([a, b], rotated)).toEqual(selectNearbyPlaces([a, b], viewport));
    const resized = { ...rotated, widthPx: 800, bounds: { ...viewport.bounds, east: 127.02 } };
    expect(selectNearbyPlaces([a, b], resized)).toEqual(selectNearbyPlaces([a, b], viewport));
  });

  const dense = Array.from({ length: 40 * 40 }, (_, i) => shop(`상가${i}`, 12699800 + (i % 40) * 40, 3699800 + Math.floor(i / 40) * 40));
  const ids = (places: ReturnType<typeof selectNearbyPlaces>) => new Set(places.map((p) => p.id));
  const common = (places: ReturnType<typeof selectNearbyPlaces>) => places.filter((p) =>
    p.center[0] > 127.003 && p.center[0] < 127.007 && p.center[1] > 37.003 && p.center[1] < 37.007);

  it('does not replace visible places as other shops enter or leave the viewport', () => {
    const original = common(selectNearbyPlaces(dense, viewport));
    expect(original.length).toBeGreaterThan(0);
    for (const shift of [-0.002, -0.001, 0.001, 0.002]) {
      const moved = { ...viewport, bounds: { west: 127 + shift, east: 127.01 + shift, south: 37 + shift, north: 37.01 + shift } };
      expect(common(selectNearbyPlaces(dense, moved))).toEqual(original);
    }
  });

  it('only adds representatives when zooming in and restores the old set when zooming out', () => {
    const coarse = selectNearbyPlaces(dense, viewport);
    const fine = selectNearbyPlaces(dense, { ...viewport, widthPx: 800 });
    expect(fine.length).toBeGreaterThan(coarse.length);
    const fineIds = ids(fine);
    // The prefetch margin shrinks in meters; compare places on the shared screen.
    expect(coarse.filter((p) => p.center[0] >= viewport.bounds.west && p.center[0] <= viewport.bounds.east &&
      p.center[1] >= viewport.bounds.south && p.center[1] <= viewport.bounds.north).every((p) => fineIds.has(p.id))).toBe(true);
    expect(selectNearbyPlaces(dense, viewport)).toEqual(coarse);
  });

  it('uses camera zoom rather than pitched bounds or screen area to determine density', () => {
    const scale = 0.01 / 400;
    const normal = { ...viewport, worldDegreesPerPixel: scale };
    const pitched = { ...normal, bounds: { west: 126.9, east: 127.1, south: 36.9, north: 37.1 }, screen: { width: 900, height: 1400, bearing: 80 } };
    expect(nearbyPlacesEnabled(pitched)).toBe(true);
    expect(common(selectNearbyPlaces(dense, pitched))).toEqual(common(selectNearbyPlaces(dense, normal)));
    expect(nearbyPlacesEnabled({ ...pitched, worldDegreesPerPixel: scale * 100 })).toBe(false);
  });

  it('loads complete cells beyond screen edges so off-screen shops can keep their priority', () => {
    const bounds = nearbyPlaceBounds(viewport);
    expect(bounds.west).toBeLessThan(viewport.bounds.west);
    expect(bounds.east).toBeGreaterThan(viewport.bounds.east);
    expect(bounds.south).toBeLessThan(viewport.bounds.south);
    expect(bounds.north).toBeGreaterThan(viewport.bounds.north);
    const edge = shop('가장자리', 12699990, 3700500);
    expect(selectNearbyPlaces([edge], viewport).map((p) => p.name)).toEqual(['가장자리']);
  });
});

describe('the place under the bubble and pin card', () => {
  const places = selectNearbyPlaces([a, b], viewport);
  it('returns the same name, kind, identity and coordinate as the nearest map icon', () => {
    const place = nearbyPlaceAt(places, [127.00401, 37.005], viewport);
    expect(place).toBe(places[0]);
    expect(place).toMatchObject({ name: '동네카페', kind: 'cafe', center: [127.004, 37.005] });
  });
  it('leaves empty spots and zoomed-out maps to address lookup rather than a distant shop', () => {
    expect(nearbyPlaceAt(places, [127.006, 37.006], viewport)).toBeNull();
    expect(nearbyPlaceAt(places, [127.004, 37.005], { ...viewport, widthPx: 20 })).toBeNull();
    expect(nearbyPlaceAt(places, [127.004, 37.005], null)).toBeNull();
  });
  it('reduces the pick radius at close zoom and uses a stable tie break', () => {
    const point: [number, number] = [127.004, 37.005];
    const close = { ...viewport, widthPx: 4000 };
    expect(nearbyPlaceAt(places, [127.0042, 37.005], viewport)).toBe(places[0]);
    expect(nearbyPlaceAt(places, [127.0042, 37.005], close)).toBeNull();
    const twins = [{ ...places[0], id: 'b' }, { ...places[0], id: 'a' }];
    expect(nearbyPlaceAt(twins, point, viewport)?.id).toBe('a');
    expect(nearbyPlaceAt([...twins].reverse(), point, viewport)?.id).toBe('a');
  });
});

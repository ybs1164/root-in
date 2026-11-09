import { describe, expect, it } from 'vitest';
import type { MapViewport } from './districtMap';
import type { KindShop } from './placeMatch';
import { nearbyPlaceAt, nearbyPlaceBounds, nearbyPlacesEnabled, shopCandidates } from './nearbyPlaces';

const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const shop = (name: string, x: number, y: number, kind: KindShop['kind'] = 'cafe'): KindShop => ({ name, x, y, kind });
const a = shop('동네카페', 12700400, 3700500);
const b = shop('식당', 12700800, 3700700, 'restaurant');
const places = (shops: KindShop[], view = viewport) => shopCandidates(shops, view).map((c) => c.place);

describe('nearby shop candidates', () => {
  it('turns shops into places with kinds at neighborhood scale only', () => {
    expect(places([a, b, shop('먼 곳', 12800000, 3700500)]).map((p) => [p.name, p.kind, p.center])).toEqual([
      ['동네카페', 'cafe', [127.004, 37.005]], ['식당', 'restaurant', [127.008, 37.007]],
    ]);
    expect(shopCandidates([a], { ...viewport, widthPx: 40 })).toEqual([]);
    expect(nearbyPlacesEnabled({ ...viewport, worldDegreesPerPixel: 0.01 / 400 * 100 })).toBe(false);
  });

  it('scores brand recognition by how often a name repeats, with a cap', () => {
    const chain = Array.from({ length: 64 }, (_, i) => shop('체인', 12700000 + i * 10, 3700100));
    const scored = shopCandidates([a, ...chain], viewport);
    expect(scored.find((c) => c.place.name === '동네카페')?.fame).toBe(0);
    expect(scored.find((c) => c.place.name === '체인')?.fame).toBeCloseTo(0.3);
    const placeholders = Array.from({ length: 64 }, (_, i) => shop('업소명없음', 12700000 + i * 10, 3700200));
    const lone = Array.from({ length: 64 }, (_, i) => shop('수', 12700000 + i * 10, 3700300));
    const listed = shopCandidates([...placeholders, ...lone], viewport);
    expect(listed.map((c) => c.place.name)).not.toContain('업소명없음');
    expect(listed.every((c) => c.fame === 0)).toBe(true);
  });

  it('loads complete cells beyond screen edges so neighbouring districts are read', () => {
    const bounds = nearbyPlaceBounds(viewport);
    expect(bounds.west).toBeLessThan(viewport.bounds.west);
    expect(bounds.east).toBeGreaterThan(viewport.bounds.east);
    expect(bounds.south).toBeLessThan(viewport.bounds.south);
    expect(bounds.north).toBeGreaterThan(viewport.bounds.north);
  });
});

describe('the place under the bubble and pin card', () => {
  const shown = places([a, b]);
  it('returns the same name, kind, identity and coordinate as the nearest map icon', () => {
    const place = nearbyPlaceAt(shown, [127.00401, 37.005], viewport);
    expect(place).toBe(shown[0]);
    expect(place).toMatchObject({ name: '동네카페', kind: 'cafe', center: [127.004, 37.005] });
  });
  it('leaves empty spots and zoomed-out maps to address lookup rather than a distant shop', () => {
    expect(nearbyPlaceAt(shown, [127.006, 37.006], viewport)).toBeNull();
    expect(nearbyPlaceAt(shown, [127.004, 37.005], { ...viewport, widthPx: 20 })).toBeNull();
    expect(nearbyPlaceAt(shown, [127.004, 37.005], null)).toBeNull();
  });
  it('reduces the pick radius at close zoom and uses a stable tie break', () => {
    const point: [number, number] = [127.004, 37.005];
    const close = { ...viewport, widthPx: 4000 };
    expect(nearbyPlaceAt(shown, [127.0042, 37.005], viewport)).toBe(shown[0]);
    expect(nearbyPlaceAt(shown, [127.0042, 37.005], close)).toBeNull();
    const twins = [{ ...shown[0], id: 'b' }, { ...shown[0], id: 'a' }];
    expect(nearbyPlaceAt(twins, point, viewport)?.id).toBe('a');
    expect(nearbyPlaceAt([...twins].reverse(), point, viewport)?.id).toBe('a');
  });
});

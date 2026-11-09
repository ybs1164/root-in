import { parsePlaceArea } from './poiAppearance';
import type { Bbox, MapViewport } from './districtMap';
import { haversineMeters } from './geo';
import { KIND_GROUPS, kindIcon } from './placeKinds';
import type { KindShop } from './placeMatch';
import type { PlaceRef } from '../types/course';
import { landmarksEnabled } from './landmarkPlaces';
import type { SceneCandidate } from './poiScene';

/** Neighborhood scale at a fixed latitude: panning cannot change density. */
export const NEARBY_MAX_MPP = 12;
const REFERENCE_METERS_PER_DEGREE = 111_320 * Math.cos(37.5 * Math.PI / 180);
const CELL_PX = 80;
const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
const latitude = (y: number) => (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI;

const worldScale = (viewport: MapViewport) => viewport.worldDegreesPerPixel ??
  (viewport.bounds.east - viewport.bounds.west) / viewport.widthPx;

export function nearbyPlacesEnabled(viewport: MapViewport): boolean {
  const scale = worldScale(viewport);
  return viewport.widthPx > 0 && Number.isFinite(scale) && scale > 0 && scale * REFERENCE_METERS_PER_DEGREE <= NEARBY_MAX_MPP;
}

/** Powers of two make each finer grid a subdivision of the previous one. */
export function nearbyPlaceCellSize(viewport: MapViewport): number {
  return 2 ** Math.ceil(Math.log2(worldScale(viewport) * CELL_PX) - 1e-9);
}

/** Load whole world-anchored cells, including a margin for dragging and border districts. */
export function nearbyPlaceBounds(viewport: MapViewport): Bbox {
  const size = nearbyPlaceCellSize(viewport);
  const b = viewport.bounds;
  return {
    west: (Math.floor(b.west / size) - 1) * size,
    east: (Math.floor(b.east / size) + 2) * size,
    south: latitude((Math.floor(mercatorY(b.south) / size) - 1) * size),
    north: latitude((Math.floor(mercatorY(b.north) / size) + 2) * size),
  };
}

const NO_NAME = /^(업소명|상호명?)?없음$/u;
const shopKey = (shop: KindShop) => `${shop.x}:${shop.y}:${shop.kind}:${shop.name}`;

export const shopPlace = (shop: KindShop): PlaceRef => ({
  id: `nearby:${shopKey(shop)}`,
  name: shop.name,
  center: [shop.x / 1e5, shop.y / 1e5],
  kind: shop.kind,
  ...parsePlaceArea(shop),
  category: KIND_GROUPS.find((group) => group.icon === kindIcon(shop.kind))?.label,
});

/**
 * Shops in the loaded cells, scored by brand recognition: how often the same
 * name appears in the loaded districts (상가정보 has no renown of its own).
 * The scene then keeps one per kind (domain/poiScene.ts).
 */
export function shopCandidates(shops: KindShop[], viewport: MapViewport): SceneCandidate[] {
  if (!nearbyPlacesEnabled(viewport)) return [];
  const bounds = nearbyPlaceBounds(viewport);
  const counts = new Map<string, number>();
  // One-letter names (수, 별…) repeat without being one brand.
  for (const shop of shops) if (Array.from(shop.name).length > 1) counts.set(shop.name, (counts.get(shop.name) ?? 0) + 1);
  const result: SceneCandidate[] = [];
  for (const shop of shops) {
    // 상가정보's placeholder for a missing name: no place to show, and it repeats like a big brand.
    if (NO_NAME.test(shop.name)) continue;
    const lon = shop.x / 1e5, lat = shop.y / 1e5;
    if (lon < bounds.west || lon >= bounds.east || lat < bounds.south || lat >= bounds.north) continue;
    result.push({ place: shopPlace(shop), fame: 0.3 * Math.min(1, Math.log2(counts.get(shop.name) ?? 1) / 5) });
  }
  return result;
}

/** The bubble and a pin opened there use exactly the same nearby place. */
export function nearbyPlaceAt(places: PlaceRef[], center: [number, number], viewport: MapViewport | null): PlaceRef | null {
  if (!viewport || !landmarksEnabled(viewport)) return null;
  const mpp = worldScale(viewport) * 111_320 * Math.cos(center[1] * Math.PI / 180);
  const radius = Math.min(40, Math.max(8, 20 * mpp));
  let best: PlaceRef | null = null;
  let distance = radius;
  for (const place of places) {
    const meters = haversineMeters(center, place.center);
    if (meters < distance || (meters === distance && (!best || place.id < best.id))) {
      best = place;
      distance = meters;
    }
  }
  return best;
}

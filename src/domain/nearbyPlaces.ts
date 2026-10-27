import type { LabelCover } from './areaLabels';
import { metersPerPixel, type MapViewport } from './districtMap';
import { screenProjection } from './districtRendering';
import { KIND_GROUPS, kindIcon } from './placeKinds';
import type { KindShop } from './placeMatch';
import type { PlaceRef } from '../types/course';

/** Places appear at neighborhood scale; wider views keep just the areas. */
export const NEARBY_MAX_MPP = 12;
const SPACING_PX = 54;
const EDGE_PX = 16;

/** Stable geographic ordering and pixel spacing keep crowded streets readable. */
export function selectNearbyPlaces(shops: KindShop[], viewport: MapViewport, cover?: LabelCover): PlaceRef[] {
  if (!(viewport.widthPx > 0) || metersPerPixel(viewport) > NEARBY_MAX_MPP) return [];
  const { bounds, screen } = viewport;
  const projection = screenProjection(viewport);
  const top = projection.project([bounds.west, bounds.north]).Y / 100;
  const bottom = projection.project([bounds.west, bounds.south]).Y / 100;
  const width = screen?.width ?? viewport.widthPx;
  const height = screen?.height ?? top - bottom;
  const turn = (screen?.bearing ?? 0) * Math.PI / 180;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const candidates = shops.flatMap((shop) => {
    const center: [number, number] = [shop.x / 1e5, shop.y / 1e5];
    if (center[0] < bounds.west || center[0] > bounds.east || center[1] < bounds.south || center[1] > bounds.north) return [];
    const p = projection.project(center);
    const dx = p.X / 100 - viewport.widthPx / 2, dy = p.Y / 100 - (top + bottom) / 2;
    const x = width / 2 + dx * cos - dy * sin;
    const y = height / 2 - dx * sin - dy * cos;
    if (x < (cover?.left ?? 0) + EDGE_PX || x > width - (cover?.right ?? 0) - EDGE_PX ||
      y < (cover?.top ?? 0) + EDGE_PX || y > height - (cover?.bottom ?? 0) - EDGE_PX) return [];
    return [{ shop, center, x, y }];
  }).sort((a, b) => a.shop.x - b.shop.x || a.shop.y - b.shop.y || a.shop.name.localeCompare(b.shop.name) || a.shop.kind.localeCompare(b.shop.kind));
  const chosen: typeof candidates = [];
  const limit = Math.min(160, Math.ceil(width * height / (SPACING_PX * SPACING_PX)));
  for (const candidate of candidates) {
    if (chosen.some((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y) < SPACING_PX ||
      (Math.abs(candidate.x - p.x) < 84 && Math.abs(candidate.y - p.y) < 42))) continue;
    chosen.push(candidate);
    if (chosen.length >= limit) break;
  }
  return chosen.map(({ shop, center }) => ({
    id: `nearby:${shop.x}:${shop.y}:${shop.kind}:${shop.name}`,
    name: shop.name,
    center,
    kind: shop.kind,
    category: KIND_GROUPS.find((group) => group.icon === kindIcon(shop.kind))?.label,
  }));
}

import type { PlaceRef } from '../types/course';
import { APPROVED_POI_STICKERS } from './poiStickerKinds';
import { POI_STICKER_SCALE } from './poiStickerScale';

export interface PlaceArea {
  /** Place/building footprint in square metres. */
  areaM2?: number;
  /** Known site/parcel area, never the surrounding administrative district. */
  landAreaM2?: number;
}

export function parsePlaceArea(value: unknown): PlaceArea {
  if (!value || typeof value !== 'object') return {};
  const data = value as Record<string, unknown>;
  const result: PlaceArea = {};
  for (const key of ['areaM2', 'landAreaM2'] as const) {
    const n = data[key];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) result[key] = n;
  }
  return result;
}

const approved = new Set<string>(APPROVED_POI_STICKERS);
export function poiStickerUrl(kind: PlaceRef['kind']): string | null {
  return kind && approved.has(kind) ? `${import.meta.env.BASE_URL}poi-stickers/${kind}.png` : null;
}

/** Shared visual area, compensating for each image's transparent padding and shape. */
export function poiAppearance(place: Pick<PlaceRef, 'kind'>) {
  return {
    sticker: poiStickerUrl(place.kind),
    size: 48,
    artScale: (place.kind && POI_STICKER_SCALE[place.kind]) || 1,
    rotation: 0,
    source: 'uniform',
  };
}

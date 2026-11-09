import { parsePlaceArea } from './poiAppearance';
import type { MapViewport } from './districtMap';
import { isPlaceKind } from './placeKinds';
import { publicFacilityKind } from './placeKindRules';
import type { PlaceRef } from '../types/course';

export interface Landmark extends PlaceRef {
  importance: 0 | 1 | 2;
  /** 0..100 renown from OSM tags and footprint (build_landmarks.py `fame`). */
  fame?: number;
}
const MAX_MPP = [40, 16, 4] as const;
const REFERENCE_METERS_PER_DEGREE = 111_320 * Math.cos(37.5 * Math.PI / 180);
export const landmarkScale = (view: MapViewport) => view.worldDegreesPerPixel ?? (view.bounds.east - view.bounds.west) / view.widthPx;
export const landmarksEnabled = (view: MapViewport) => {
  const scale = landmarkScale(view);
  return view.widthPx > 0 && Number.isFinite(scale) && scale > 0 && scale * REFERENCE_METERS_PER_DEGREE <= MAX_MPP[0];
};

export function parseLandmarks(value: unknown): Landmark[] | null {
  const data = value as { v?: unknown; r?: unknown } | null;
  if (data?.v !== 1 || !Array.isArray(data.r)) return null;
  return data.r.flatMap((row: unknown) => {
    if (!Array.isArray(row) || (row.length !== 7 && row.length !== 8)) return [];
    const [id, name, x, y, kind, category, importance] = row;
    if (typeof id !== 'string' || !/^[nwr]\d+$/.test(id) || typeof name !== 'string' || !name || name.length > 80 ||
      !Number.isInteger(x) || !Number.isInteger(y) || x < 124e5 || x > 132e5 || y < 33e5 || y > 39e5 ||
      !isPlaceKind(kind) || typeof category !== 'string' || ![0, 1, 2].includes(importance)) return [];
    const resolvedKind = kind === 'building' && category === '공공시설' ? publicFacilityKind(name) : kind;
    const extra = row[7] as { f?: unknown } | undefined;
    const fame = typeof extra?.f === 'number' && Number.isInteger(extra.f) && extra.f > 0 && extra.f <= 100 ? extra.f : undefined;
    return [{ id: `landmark:${id}`, name, center: [x / 1e5, y / 1e5] as [number, number], kind: resolvedKind, category, importance,
      ...(fame ? { fame } : {}), ...parsePlaceArea(row[7]) }];
  });
}

/** OSM renown from which a neighbourhood landmark (a palace, a famous museum) shows as far out as campuses. */
export const PROMOTE_FAME = 70;
/**
 * Shown from this scale down: campuses and stations far out, named buildings
 * close in. Only tier 1 can be promoted: overview tiles carry no tier 2 rows.
 */
export const landmarkEligible = (place: Landmark, view: MapViewport) => {
  const tier = place.importance === 1 && (place.fame ?? 0) >= PROMOTE_FAME ? 0 : place.importance;
  return landmarksEnabled(view) && landmarkScale(view) * REFERENCE_METERS_PER_DEGREE <= MAX_MPP[tier];
};

/** Landmarks the screen (plus a margin for dragging) may show at this scale; the scene picks among them. */
export function eligibleLandmarks(places: Landmark[], view: MapViewport): Landmark[] {
  if (!landmarksEnabled(view)) return [];
  const margin = 2 ** Math.ceil(Math.log2(landmarkScale(view) * 120) - 1e-9);
  const b = view.bounds;
  const seen = new Set<string>();
  return places.filter((place) => {
    const [lon, lat] = place.center;
    if (seen.has(place.id) || !landmarkEligible(place, view) ||
      lon < b.west - margin || lon > b.east + margin || lat < b.south - margin || lat > b.north + margin) return false;
    seen.add(place.id);
    return true;
  });
}

const TIER_FAME = [0.45, 0.3, 0.15] as const;
/** Tier sets the floor; OSM renown (wikidata, heritage, size) adds up to 0.55, so a famous palace outranks a plain station. */
export const landmarkFame = (place: Landmark) => TIER_FAME[place.importance] + 0.55 * ((place.fame ?? 0) / 100);

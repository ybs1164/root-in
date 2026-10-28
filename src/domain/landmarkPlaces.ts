import type { MapViewport } from './districtMap';
import { isPlaceKind } from './placeKinds';
import type { PlaceRef } from '../types/course';

export interface Landmark extends PlaceRef { importance: 0 | 1 | 2 }
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
    if (!Array.isArray(row) || row.length !== 7) return [];
    const [id, name, x, y, kind, category, importance] = row;
    if (typeof id !== 'string' || !/^[nwr]\d+$/.test(id) || typeof name !== 'string' || !name || name.length > 80 ||
      !Number.isInteger(x) || !Number.isInteger(y) || x < 124e5 || x > 132e5 || y < 33e5 || y > 39e5 ||
      !isPlaceKind(kind) || typeof category !== 'string' || ![0, 1, 2].includes(importance)) return [];
    return [{ id: `landmark:${id}`, name, center: [x / 1e5, y / 1e5] as [number, number], kind, category, importance }];
  });
}

/** Dedicated stable cells keep campuses and stations out of the shop lottery. */
export function selectLandmarks(places: Landmark[], view: MapViewport): PlaceRef[] {
  if (!landmarksEnabled(view)) return [];
  const scale = landmarkScale(view), mpp = scale * REFERENCE_METERS_PER_DEGREE;
  const size = 2 ** Math.ceil(Math.log2(scale * 120) - 1e-9);
  const margin = size;
  const b = view.bounds;
  const cells = new Map<string, Landmark>();
  // At broad scales, a campus remains an orientation point even when its
  // station is represented by a node with a smaller OSM id in the same cell.
  const rank = (place: Landmark) => place.importance === 0 && place.kind === 'school' ? 0 : 1;
  for (const place of [...places].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))) {
    if (mpp > MAX_MPP[place.importance]) continue;
    const [lon, lat] = place.center;
    if (lon < b.west - margin || lon > b.east + margin || lat < b.south - margin || lat > b.north + margin) continue;
    const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
    const key = `${place.importance}:${Math.floor(lon / size)}:${Math.floor(y / size)}`;
    if (!cells.has(key)) cells.set(key, place);
  }
  return [...cells.values()];
}

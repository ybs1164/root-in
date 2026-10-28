import type { PlaceRef } from '../types/course';
import { TODAY_PING_RADIUS_M } from './dayPings';
import { haversineMeters } from './geo';
import { isExcluded, type ExcludedPlace } from './privacy';

/** How many places the camera offers to send the photo as (current spot included). */
export const CAMERA_PLACE_LIMIT = 10;

/** What the spot itself is called when reverse geocoding finds no name. */
export const HERE_NAME = '현재 위치';

/**
 * Where a camera shot can say it was taken, first one picked by default: the
 * spot I'm standing on (named by reverse geocoding), then my own pins within
 * 50m (as TODAY offers them), then named places around (cafés, restaurants…),
 * each nearest first. A place twice (same id, or the same name at the same
 * spot) is listed once, and none near a 제외 주소 — those never leave the phone.
 */
export function cameraPlaces(
  here: [number, number],
  spot: PlaceRef | null,
  pins: readonly { place: PlaceRef }[],
  around: readonly PlaceRef[],
  excluded: ExcludedPlace[],
): PlaceRef[] {
  const near = (places: readonly PlaceRef[]) =>
    places
      .map((place) => ({ place, m: haversineMeters(place.center, here) }))
      .sort((a, b) => a.m - b.m)
      .map(({ place }) => place);
  const mine = near(pins.map((p) => p.place).filter((p) => haversineMeters(p.center, here) <= TODAY_PING_RADIUS_M));
  const first: PlaceRef = { ...(spot ?? { id: `here:${here[0]},${here[1]}` }), name: spot?.name.trim() || HERE_NAME, center: here };
  const ids = new Set<string>();
  const names = new Set<string>();
  const out: PlaceRef[] = [];
  for (const place of [first, ...mine, ...near(around)]) {
    const name = place.name.trim();
    if (!name || ids.has(place.id) || names.has(name)) continue;
    if (isExcluded(place, excluded)) continue;
    ids.add(place.id);
    names.add(name);
    out.push(place);
    if (out.length >= CAMERA_PLACE_LIMIT) break;
  }
  return out;
}

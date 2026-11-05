import type { StoredPing } from './dayPings';
import { TODAY_PING_RADIUS_M } from './dayPings';
import { haversineMeters } from './geo';
import type { PlaceRef } from '../types/course';
import type { Pin } from '../types/pin';

/** The place id of a pin made from a visit: which ping it came from. */
const visitPlaceId = (pingId: string) => `visit:${pingId}`;

/** A ping of this place: the same name within the radius a photo pings by. */
const samePlace = (a: { name: string; center: [number, number] }, b: { name: string; center: [number, number] }) =>
  a.name === b.name && haversineMeters(a.center, b.center) <= TODAY_PING_RADIUS_M;

/**
 * Places I've been (my pings — every camera shot is one, whichever groups it
 * went to) that aren't pins yet, to pin as 미분류. A ping is looked at once:
 * `done` holds the ones already settled, so a pin deleted afterwards isn't
 * brought back. 제외 주소 pings stay off the pins (they'd go to the server).
 * Returns the places to pin and every ping settled by this pass.
 */
export function visitedPlaces(
  pings: readonly StoredPing[],
  pins: readonly Pin[],
  done: ReadonlySet<string>,
): { places: PlaceRef[]; settled: string[] } {
  const places: PlaceRef[] = [];
  const settled: string[] = [];
  for (const ping of pings) {
    if (done.has(ping.id)) continue;
    settled.push(ping.id);
    if (ping.local) continue;
    if (pins.some((pin) => pin.id === ping.pinId || samePlace(pin.place, ping))) continue;
    if (places.some((place) => samePlace(place, ping))) continue;
    places.push({
      id: visitPlaceId(ping.id),
      name: ping.name,
      center: ping.center,
      ...(ping.address ? { address: ping.address } : {}),
    });
  }
  return { places, settled };
}

export interface PlacePhoto {
  /** The ping it was taken at. */
  id: string;
  url: string;
  at: string;
}

/**
 * The photos I took at a place (TODAY's, on this phone), newest first: the
 * pings recorded from its pin, the visit it was pinned from (kept through a
 * rename), or of the same place by name and distance.
 */
export function placePhotos(
  place: Pick<PlaceRef, 'id' | 'name' | 'center'>,
  pinId: string | null,
  pings: readonly StoredPing[],
  photos: Readonly<Record<string, string>>,
): PlacePhoto[] {
  return pings
    .filter(
      (ping) =>
        photos[ping.id] && ((pinId && ping.pinId === pinId) || place.id === visitPlaceId(ping.id) || samePlace(place, ping)),
    )
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((ping) => ({ id: ping.id, url: photos[ping.id], at: ping.at }));
}

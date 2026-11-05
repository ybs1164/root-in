import { haversineMeters } from './geo';
import type { PlaceKind } from './placeKinds';
import type { PlaceRef } from '../types/course';
import type { Pin } from '../types/pin';

/** Identifies the lookup's input, so a late answer cannot change an edited place. */
export const pinKindKey = (place: PlaceRef): string => JSON.stringify([place.id, place.name, place.address, ...place.center]);
export interface PinKindMatch { pinId: string; placeKey: string; kind: PlaceKind }

/** Fill missing kinds in the latest pins; keep category choices, edits and deletions. */
export function withPinKinds(pins: Pin[], matches: PinKindMatch[], at = new Date().toISOString()): Pin[] {
  const byPin = new Map(matches.map((match) => [match.pinId, match]));
  let changed = false;
  const next = pins.map((pin) => {
    const match = byPin.get(pin.id);
    if (!match || pin.place.kind || match.placeKey !== pinKindKey(pin.place)) return pin;
    changed = true;
    return { ...pin, place: { ...pin.place, kind: match.kind }, updatedAt: at };
  });
  return changed ? next : pins;
}

/** How near a POI of the same name must be to count as the pinned place. */
export const SAME_POI_M = 50;

/** The same place: the same id, or the same name close by. */
export const isSamePoi = (a: Pick<PlaceRef, 'id' | 'name' | 'center'>, b: Pick<PlaceRef, 'id' | 'name' | 'center'>) =>
  a.id === b.id || (a.name === b.name && haversineMeters(a.center, b.center) <= SAME_POI_M);

/**
 * Kinds for pins that have none, taken from the POI on the map they stand
 * for. A pin made from a ping (or a long press) carries only a name and a
 * spot, while the map's POI at that place knows its kind: without this the
 * pin hides that POI and shows no sticker of its own.
 */
export function kindsFromPlaces(pins: readonly Pin[], places: readonly PlaceRef[]): PinKindMatch[] {
  const matches: PinKindMatch[] = [];
  for (const pin of pins) {
    if (pin.place.kind) continue;
    const poi = places.find((place) => place.kind && isSamePoi(pin.place, place));
    if (poi?.kind) matches.push({ pinId: pin.id, placeKey: pinKindKey(pin.place), kind: poi.kind });
  }
  return matches;
}

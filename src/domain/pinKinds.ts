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

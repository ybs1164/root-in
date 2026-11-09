import { useEffect, useState } from 'react';
import { addressRoute } from '../domain/addressRoute';
import type { PlaceRef } from '../types/course';

type Reverse = (center: [number, number]) => Promise<PlaceRef | null>;

/** The longest a card waits for its address before showing without it. */
export const ADDRESS_WAIT_MS = 1500;

// Spots already looked up this session: reopening a card shows its line at once.
const found = new Map<string, string | null>();
const keyOf = ([lng, lat]: [number, number]) => `${lng.toFixed(5)},${lat.toFixed(5)}`;
// A line with its 동 (addressRoute's `to`); one naming only the city looks it up too.
const full = (address: string | null | undefined) => !!addressRoute(address ?? undefined)?.to;

/**
 * The address a card's top line reads (addressRoute). A place saved without
 * one that names its 동 — a POI sticker, a pin made from a ping, a long press
 * — gets the address nearest its spot by reverse geocoding (shown only, never
 * saved). `ready` once there's an answer (or after ADDRESS_WAIT_MS): the card
 * waits for it, so the name and the line come up together.
 */
export function usePlaceAddress(
  place: Pick<PlaceRef, 'center' | 'address'> | null,
  reverse: Reverse | null,
): { address: string | undefined; ready: boolean } {
  const own = full(place?.address) ? place?.address : undefined;
  const key = place && !own && reverse ? keyOf(place.center) : null;
  const [, setTick] = useState(0);
  const [gaveUp, setGaveUp] = useState<string | null>(null);
  useEffect(() => {
    if (!key || !place || !reverse || found.has(key)) return;
    let alive = true;
    void reverse(place.center).then((spot) => {
      found.set(key, spot?.address ?? null);
      if (alive) setTick((n) => n + 1);
    });
    const timer = window.setTimeout(() => alive && setGaveUp(key), ADDRESS_WAIT_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // place.center is what `key` stands for.
  }, [key, reverse]);
  const near = key ? found.get(key) : undefined;
  return {
    address: own ?? (full(near) ? (near ?? undefined) : undefined) ?? place?.address ?? near ?? undefined,
    ready: !key || found.has(key) || gaveUp === key,
  };
}

import { pinKindKey, type PinKindMatch } from '../domain/pinKinds';
import type { Pin } from '../types/pin';
import type { PlaceKindService } from './placeKindService';

/** Bound concurrent file reads while enriching older saved pins. */
export async function resolvePinKinds(pins: Pin[], service: PlaceKindService, signal: AbortSignal): Promise<PinKindMatch[]> {
  const matches: PinKindMatch[] = [];
  let next = 0;
  const work = async () => {
    while (!signal.aborted && next < pins.length) {
      const pin = pins[next++];
      if (pin.place.kind) continue;
      try {
        const kind = await service.lookup(pin.place, signal);
        if (kind && !signal.aborted) matches.push({ pinId: pin.id, placeKey: pinKindKey(pin.place), kind });
      } catch { /* A failed lookup leaves the ordinary pin available. */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, pins.length) }, work));
  return matches;
}

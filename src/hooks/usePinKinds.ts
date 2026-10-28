import { useEffect, useRef } from 'react';
import { pinKindKey, withPinKinds } from '../domain/pinKinds';
import { placeKindService } from '../services/placeKindService';
import { resolvePinKinds } from '../services/pinKindResolver';
import type { Pin } from '../types/pin';
import type { usePins } from './usePins';

/** Earlier saved pins get the same automatic icons as newly searched places. */
export function usePinKinds(pins: Pin[], transform: ReturnType<typeof usePins>['transform']) {
  const tried = useRef(new Set<string>());
  useEffect(() => {
    const keyOf = (pin: Pin) => `${pin.id}|${pinKindKey(pin.place)}`;
    const missing = pins.filter((pin) => !pin.place.kind && !tried.current.has(keyOf(pin)));
    if (!missing.length) return;
    for (const pin of missing) tried.current.add(keyOf(pin));
    const controller = new AbortController();
    let finished = false;
    void resolvePinKinds(missing, placeKindService, controller.signal).then((matches) => {
      finished = true;
      if (controller.signal.aborted || !matches.length) return;
      transform((current) => {
        const next = withPinKinds(current.pins, matches);
        return next === current.pins ? null : { ...current, pins: next };
      });
    });
    return () => {
      controller.abort();
      if (!finished) for (const pin of missing) tried.current.delete(keyOf(pin));
    };
  }, [pins, transform]);
}

import { useEffect, useState } from 'react';
import type { MyLocation } from '../domain/dayPings';
import { watchPosition } from '../lib/geolocation';
import { inKorea } from '../services/pinShareService';

/**
 * The phone's position while the app is in front (null until the first fix,
 * or when it's denied or outside Korea — the app only covers Korea). Stops
 * watching in the background so the GPS isn't kept on.
 */
export function useMyLocation(): MyLocation | null {
  const [me, setMe] = useState<MyLocation | null>(null);
  useEffect(() => {
    let stop: (() => void) | null = null;
    const start = () => {
      stop ??= watchPosition((center, at) => setMe(inKorea(center) ? { center, at } : null));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else {
        stop?.();
        stop = null;
      }
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop?.();
    };
  }, []);
  return me;
}

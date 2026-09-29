import { useCallback, useEffect, useState } from 'react';
import { clearPinsFromLocation, PINS_HASH_KEY, pinShareService } from '../services/pinShareService';
import type { SharedPinSet } from '../types/pin';

type IncomingState = { status: 'none' } | { status: 'invalid' } | { status: 'ready'; set: SharedPinSet };

/** Like useIncomingCourse, for `#pins=…` links. */
export function useIncomingPins() {
  const [state, setState] = useState<IncomingState>({ status: 'none' });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!window.location.hash.includes(`${PINS_HASH_KEY}=`)) return;
      const set = await pinShareService.resolveFromUrl(window.location.href);
      if (!cancelled) setState(set ? { status: 'ready', set } : { status: 'invalid' });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', check);
    };
  }, []);

  const dismiss = useCallback(() => {
    clearPinsFromLocation();
    setState({ status: 'none' });
  }, []);

  return { incoming: state, dismiss };
}

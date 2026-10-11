import { useEffect, useRef } from 'react';
import { onNativeBack } from '../lib/native';

/** `handler` closes one layer and returns true, or returns false when nothing is left to close. */
export function useBackButton(handler: () => boolean): void {
  // Kept in a ref so the native listener is added once, not on every render.
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => onNativeBack(() => latest.current()), []);
}

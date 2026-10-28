import { useCallback, useEffect, useRef, useState } from 'react';
import type { MyLocation } from '../domain/dayPings';
import { requestLocation, watchPosition, type LocationError } from '../lib/geolocation';
import { inKorea } from '../services/pinShareService';
import { onAppVisibility } from '../lib/native';

const KEY = 'goodroot:location:v1';
const savedEnabled = () => {
  try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
};
function saveEnabled(enabled: boolean) {
  try { localStorage.setItem(KEY, String(enabled)); } catch { /* Available for this session. */ }
}

/** Opt-in foreground location, shared by the map, TODAY and photo sending. */
export function useMyLocation() {
  const [me, setMe] = useState<MyLocation | null>(null);
  const [enabled, setEnabled] = useState(savedEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);
  const request = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { request.current += 1; }, []);
  // Keep a recent dot through a transient timeout, but never indefinitely.
  useEffect(() => {
    if (!me) return;
    const timer = setTimeout(() => setMe(null), Math.max(0, me.at + 60000 - Date.now()));
    return () => clearTimeout(timer);
  }, [me]);

  const enable = useCallback(async () => {
    if (pending.current) return null;
    pending.current = true;
    const id = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const result = await requestLocation();
      if (id !== request.current) return null;
      if (!result.center) {
        setError(result.error);
        if (result.error === 'denied' || result.error === 'disabled' || result.error === 'unsupported') {
          setMe(null);
          setEnabled(false);
          saveEnabled(false);
        }
        return null;
      }
      const fix = inKorea(result.center) ? { center: result.center, at: result.at } : null;
      setMe(fix);
      setEnabled(true);
      saveEnabled(true);
      return fix;
    } finally {
      pending.current = false;
      if (id === request.current) setBusy(false);
    }
  }, []);

  const disable = useCallback(() => {
    request.current += 1;
    setEnabled(false);
    saveEnabled(false);
    setBusy(false);
    setMe(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stop: (() => void) | null = null;
    const unlisten = onAppVisibility((active) => {
      if (active) {
        stop ??= watchPosition((center, at) => {
          setMe(inKorea(center) ? { center, at } : null);
          setError(null);
        }, (failure) => {
          setError(failure);
          if (failure === 'denied' || failure === 'disabled' || failure === 'unsupported') {
            setMe(null);
            setEnabled(false);
            saveEnabled(false);
          }
        });
      } else {
        stop?.();
        stop = null;
        setMe(null);
      }
    });
    return () => {
      unlisten();
      stop?.();
    };
  }, [enabled]);
  return { me, enabled, busy, error, enable, disable };
}

export type MyLocationControl = ReturnType<typeof useMyLocation>;

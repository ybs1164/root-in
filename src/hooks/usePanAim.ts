import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { haversineMeters as distanceMeters } from '../domain/geo';
import { nearbyPlaceAt } from '../domain/nearbyPlaces';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';

// How often the crosshair's place name is looked up while the map moves, and
// how far it must have moved to be worth asking again.
const AIM_LOOKUP_MS = 300;
const AIM_MIN_MOVE_M = 8;

interface PanAim {
  /** Nothing else is open on the pin screen: a drag of the map aims. */
  on: boolean;
  searchService: PlaceSearchService | null;
  mapEl: RefObject<HTMLElement | null>;
  /** The map's events as the app hears them; the aim takes `move` while it's on. */
  mapEvents: { readonly current: { move: (center: [number, number]) => void } };
  /** The places drawn on the map right now (they name the point at once). */
  nearby: { readonly current: { places: Parameters<typeof nearbyPlaceAt>[0]; viewport: Parameters<typeof nearbyPlaceAt>[2] } };
}

/**
 * Dragging the map on the pin screen (nothing else open): a crosshair at
 * its middle with the name of the place under it, kept up to date as it
 * moves. Up the moment a press on the map starts moving it (a tap on a pin
 * that centres the map doesn't), gone the moment the finger lifts. Names:
 * nearby icons name the point immediately. Address lookups fill empty spots,
 * one at a time, without ever showing a reply for an earlier camera position.
 *
 * `refresh` looks the point up again (the places on the map changed).
 */
export function usePanAim({ on, searchService, mapEl, mapEvents, nearby }: PanAim) {
  const [aiming, setAiming] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const refreshRef = useRef(() => {});
  useEffect(() => {
    if (!on || !searchService) return;
    const el = mapEl.current;
    let alive = true;
    let pressed = false;
    let dragging = false;
    let asked: [number, number] | null = null;
    let wanted: [number, number] | null = null;
    let lastAt = 0;
    let busy = false;
    let session = 0;
    let fallbackName: { center: [number, number]; name: string } | null = null;
    let timer: number | undefined;
    const next = () => {
      if (!alive || !dragging || !wanted) return;
      const context = nearby.current;
      const place = nearbyPlaceAt(context.places, wanted, context.viewport);
      setName(place?.name ?? (fallbackName && distanceMeters(fallbackName.center, wanted) < AIM_MIN_MOVE_M ? fallbackName.name : null));
      if (place || busy || timer !== undefined) return;
      if (asked && distanceMeters(asked, wanted) < AIM_MIN_MOVE_M) return;
      const wait = AIM_LOOKUP_MS - (performance.now() - lastAt);
      if (wait > 0) {
        timer = window.setTimeout(() => {
          timer = undefined;
          next();
        }, wait);
        return;
      }
      const center = wanted;
      asked = center;
      lastAt = performance.now();
      busy = true;
      const requestSession = session;
      void searchService.reverse(center).then((named) => {
        busy = false;
        if (!alive || !dragging) return;
        if (requestSession === session) fallbackName = { center, name: named?.name ?? '이름 없는 곳' };
        next();
      });
    };
    refreshRef.current = next;
    const down = (e: Event) => {
      const target = e.target as Element;
      if (!el?.contains(target)) return;
      // A tap on a pin or stop moves the map itself (centring it): not a drag.
      if (target.closest('button, .map-marker, [data-pin-id]')) return;
      pressed = true;
    };
    const up = (e?: Event) => {
      if (e && 'touches' in e && (e as TouchEvent).touches.length > 0) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      window.clearTimeout(timer);
      timer = undefined;
      setAiming(false);
    };
    mapEvents.current.move = (center) => {
      if (pressed && !dragging) {
        dragging = true;
        session += 1;
        asked = null;
        fallbackName = null;
        lastAt = 0;
        setName(null);
        setAiming(true);
      }
      if (!dragging) return;
      wanted = center;
      next();
    };
    // Touch and mouse ends too: a map SDK that swallows the pointer events
    // (or a lost pointer capture) must still never leave the crosshair up.
    const starts = ['pointerdown', 'touchstart', 'mousedown'];
    const ends = ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup'];
    starts.forEach((t) => document.addEventListener(t, down, true));
    ends.forEach((t) => document.addEventListener(t, up, true));
    window.addEventListener('blur', up);
    return () => {
      alive = false;
      refreshRef.current = () => {};
      window.clearTimeout(timer);
      setAiming(false);
      mapEvents.current.move = () => {};
      starts.forEach((t) => document.removeEventListener(t, down, true));
      ends.forEach((t) => document.removeEventListener(t, up, true));
      window.removeEventListener('blur', up);
    };
    // `mapEl`, `mapEvents` and `nearby` are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, searchService]);
  const refresh = useCallback(() => refreshRef.current(), []);
  return { aiming, name, refresh };
}

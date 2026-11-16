import { useEffect, useState } from 'react';

/** Once the map has glided over to a route, the pins fade off (matches .app--pins-away), and only then do its stops drop in. */
export const PINS_FADE_MS = 250;

/**
 * A route put on show takes the map in turns: it glides over with the pins
 * still there, and the moment the glide ends (`setLandedRoute`, from the fit)
 * the pins fade away and the route's own stops drop in. Stepping to another
 * route (< >) keeps the pins hidden until the route view is closed.
 */
export function useRouteArrival(shownRouteKey: string | null) {
  const [pinsAway, setPinsAway] = useState<'no' | 'fading' | 'gone'>('no');
  // Only 'gone' changes the markers: re-making them mid-fade would cut the fade short.
  const pinsGone = pinsAway === 'gone';
  // The route the map has finished gliding to.
  const [landedRoute, setLandedRoute] = useState<string | null>(null);
  const routeLanded = !!shownRouteKey && landedRoute === shownRouteKey;
  useEffect(() => {
    if (!shownRouteKey) {
      setLandedRoute(null);
      return setPinsAway('no');
    }
    if (pinsGone || !routeLanded) return;
    setPinsAway('fading');
    const fade = window.setTimeout(() => setPinsAway('gone'), PINS_FADE_MS);
    return () => window.clearTimeout(fade);
  }, [shownRouteKey, routeLanded, pinsGone]);
  return {
    pinsAway,
    pinsGone,
    routeLanded,
    setLandedRoute,
    /** Back to showing it from the start: the glide, the fade, the stops dropping in again. */
    replay: () => {
      setLandedRoute(null);
      setPinsAway('no');
    },
    /** A step to the next route, even during the first fade: the pins stay off. */
    keepPinsOff: () => setPinsAway('gone'),
  };
}

/** True while `on`, and for `ms` after it: something kept mounted a moment so it can slide away. */
export function useLingering(on: boolean, ms: number): boolean {
  const [lingers, setLingers] = useState(on);
  useEffect(() => {
    if (on) return setLingers(true);
    const t = window.setTimeout(() => setLingers(false), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return on || lingers;
}

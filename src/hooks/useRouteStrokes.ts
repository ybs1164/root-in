import { useEffect, useRef, type RefObject } from 'react';
import { pinAt } from '../components/RouteBuildLayer';
import { PRESS } from '../domain/dayPings';
import type { CourseMap } from '../map/courseMap';

interface RouteStrokes {
  /** 경로 is open on the map (its sheet up, or a route on show). */
  on: boolean;
  mapEl: RefObject<HTMLElement | null>;
  mapRef: RefObject<CourseMap | null>;
  /** A route is being made or edited: the build layer takes the strokes. */
  busy: boolean;
  /** A saved route is on show. */
  showing: boolean;
  /** A press on a pin started moving: straight into making a route, that pin first. */
  onStart: (pinId: string) => void;
  /** …then every pin the finger crosses joins it. */
  onCross: (pinId: string) => void;
  /** A quick tap on bare map with a route on show: it lets go of the route (the sheet comes back up). */
  onLetGo: () => void;
  /** …with none on show: 경로 closes altogether. */
  onClose: () => void;
}

/**
 * With the 경로 sheet up (and no route being made): a quick tap on bare map
 * closes 경로 altogether; pressing a pin and dragging goes straight into
 * making a route, that pin first, then every pin the finger crosses.
 * Listened for on the document in the capture phase, ahead of the map; the
 * listener stays for all of 경로 so a stroke that started it keeps going
 * after the build layer mounts (that layer only takes strokes it began).
 * Returns that stroke's finger, for the build layer's dashed preview line.
 */
export function useRouteStrokes(options: RouteStrokes): RefObject<{ x: number; y: number } | null> {
  const { on, mapEl, mapRef } = options;
  const latest = useRef(options);
  latest.current = options;
  const handoff = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = mapEl.current;
    if (!on || !el) return;
    let stroke: { x: number; y: number; at: number; pin: string | null; drawing: boolean; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      stroke = null;
      // Making or editing a route: the build layer takes the strokes.
      if (!e.isPrimary || latest.current.busy || !el.contains(e.target as Node)) return;
      stroke = { x: e.clientX, y: e.clientY, at: performance.now(), pin: pinAt(e.clientX, e.clientY), drawing: false, moved: false };
      if (stroke.pin) mapRef.current?.setPanEnabled(false);
    };
    const move = (e: PointerEvent) => {
      const s = stroke;
      if (!s || !e.isPrimary) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > PRESS.slopPx) {
        s.moved = true;
        if (s.pin) {
          s.drawing = true;
          latest.current.onStart(s.pin);
        }
      }
      if (!s.drawing) return;
      e.preventDefault();
      handoff.current = { x: e.clientX, y: e.clientY };
      const id = pinAt(e.clientX, e.clientY);
      if (id) latest.current.onCross(id);
    };
    const up = (e: PointerEvent) => {
      const s = stroke;
      stroke = null;
      handoff.current = null;
      if (!s || !e.isPrimary) return;
      if (s.pin) mapRef.current?.setPanEnabled(true);
      if (s.drawing) {
        // The stroke may end on a pin; its click shouldn't open the pin card.
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300);
        return;
      }
      // A quick tap on bare map (not a pan, not a long press, not on a marker):
      // with a route on show it just lets go of it (the sheet comes back up);
      // otherwise it closes 경로.
      const onMarker = (e.target as Element | null)?.closest('.map-marker');
      if (!s.moved && !s.pin && !onMarker && performance.now() - s.at < PRESS.longMs && el.contains(e.target as Node)) {
        if (latest.current.showing) return latest.current.onLetGo();
        latest.current.onClose();
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return handoff;
}

/**
 * While `on`: a quick tap on bare map (not a pan, a long press or a marker)
 * calls `onTap` — unless `cardOpen` when the touch started (that tap only
 * closes the pin card or place card).
 */
export function useBareMapTap(on: boolean, mapEl: RefObject<HTMLElement | null>, cardOpen: boolean, onTap: () => void): void {
  const latest = useRef({ cardOpen, onTap });
  latest.current = { cardOpen, onTap };
  useEffect(() => {
    const el = mapEl.current;
    if (!on || !el) return;
    let tap: { x: number; y: number; at: number; card: boolean } | null = null;
    const down = (e: PointerEvent) => {
      tap = e.isPrimary && el.contains(e.target as Node) ? { x: e.clientX, y: e.clientY, at: performance.now(), card: latest.current.cardOpen } : null;
    };
    const up = (e: PointerEvent) => {
      const t = tap;
      tap = null;
      if (!t || !e.isPrimary || t.card || !el.contains(e.target as Node)) return;
      if ((e.target as Element | null)?.closest('.map-marker')) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > PRESS.slopPx || performance.now() - t.at >= PRESS.longMs) return;
      latest.current.onTap();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}

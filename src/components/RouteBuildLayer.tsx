import { useEffect, useRef, useState } from 'react';
import type { RouteFolder } from '../domain/routeFolders';
import RouteCreateSheet, { type RouteCreateDraft } from './RouteCreateSheet';
import { COURSE_LIMITS } from '../domain/course';
import { ROUTE_NOTE_MAX, ROUTE_TITLE_MAX } from '../domain/routeBuild';
import { stopCentre } from './StopLines';

interface RouteBuildLayerProps {
  /** The map's container: drawing and the cancel-tap only count inside it. */
  mapEl: HTMLElement | null;
  /** Pin ids chosen so far, in order. */
  chosen: string[];
  /** Adds a pin as the next stop (ignored if it's already in or the route is full). */
  onAdd: (pinId: string) => void;
  /** A tap on the bare map: drop the route being made (editing: finish the edit). */
  onCancel: () => void;
  onPanEnabled: (enabled: boolean) => void;
  defaultTitle: string;
  /**
   * A stroke begun before this layer appeared (dragging from a pin in the
   * folder view): the app keeps its finger here so the dashed preview line
   * can follow it too.
   */
  handoff?: { current: { x: number; y: number } | null };
  /** 생성 on the sheet: the route's name, description, icon and folder (null = 미분류). */
  onCreate: (title: string, note: string, icon: string | undefined, folder: string | null) => void;
  /** The user's folders, for the sheet's folder choice. */
  folders?: RouteFolder[];
  /**
   * Editing a saved route instead of making one: stops are picked the same
   * way, but the edit sheet has the ✓ (no button or name dialog here).
   */
  editing?: boolean;
}

/** Matches `.route-create.is-leaving` in styles.css: the sheet stays mounted while it slides down. */
const SHEET_OUT_MS = 200;

/** Movement before a press counts as a drag (drawing, or panning the map). */
const SLOP_PX = 10;

interface Stroke {
  x: number;
  y: number;
  startPin: string | null;
  /** Started on the route's last numbered stop: the stroke carries the route on from there. */
  fromLast: boolean;
  drawing: boolean;
  moved: boolean;
  fingerX: number;
  fingerY: number;
}

/** The pin marker under a screen point, if any (also under a numbered stop drawn on top of it). */
export function pinAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).dataset?.pinId;
    if (id) return id;
  }
  return null;
}


/**
 * Making a route over the map. Pins tapped (or swept through in one stroke,
 * starting on a pin) join in order and are joined by straight lines, drawn
 * here from the markers' screen positions so they show even before the
 * basemap has loaded. A tap on bare map cancels; ✓ asks for a name and a
 * description, and 루트 생성 saves it.
 */
export default function RouteBuildLayer({ mapEl, chosen, onAdd, onCancel, onPanEnabled, defaultTitle, handoff, onCreate, folders = [], editing = false }: RouteBuildLayerProps) {
  const handoffRef = useRef(handoff);
  handoffRef.current = handoff;
  const trailEl = useRef<SVGLineElement | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const handlers = useRef({ onAdd, onCancel, onPanEnabled });
  handlers.current = { onAdd, onCancel, onPanEnabled };

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // The stops' lines are StopLines (the app draws them for any route); this
  // adds the dashed one from the last stop to a finger mid-stroke.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const own = stroke.current;
      const outer = handoffRef.current?.current ?? null;
      const s = own?.drawing ? own : outer ? { drawing: true, fingerX: outer.x, fingerY: outer.y } : null;
      // A stroke under way (this layer's, or one handed over): the sheet waits for it to end.
      const busy = !!s;
      if (busy !== busyRef.current) {
        busyRef.current = busy;
        setBusy(busy);
      }
      const last = stopCentre(chosenRef.current.length);
      const trail = trailEl.current;
      if (trail) {
        const on = !!(s?.drawing && last);
        trail.style.display = on ? '' : 'none';
        if (on && last && s) {
          trail.setAttribute('x1', String(last.x));
          trail.setAttribute('y1', String(last.y));
          trail.setAttribute('x2', String(s.fingerX));
          trail.setAttribute('y2', String(s.fingerY));
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Strokes over the map. Listened for on the document in the capture phase,
  // ahead of the map's own handlers, but only for presses that start on the map.
  useEffect(() => {
    if (!mapEl) return;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || !mapEl.contains(e.target as Node)) return;
      const startPin = pinAt(e.clientX, e.clientY);
      // The last stop's own pin may be hidden under it (editing a route hides
      // its pins), so the numbered marker counts as somewhere to start too.
      const stop = (e.target as Element | null)?.closest?.<HTMLElement>('.map-marker[data-stop]');
      const fromLast = !startPin && !!stop && Number(stop.dataset.stop) === chosenRef.current.length;
      stroke.current = { x: e.clientX, y: e.clientY, startPin, fromLast, drawing: false, moved: false, fingerX: e.clientX, fingerY: e.clientY };
      // Starting on a pin (or the last stop) may become a drawing stroke: keep the map still under it.
      if (startPin || fromLast) handlers.current.onPanEnabled(false);
    };
    const move = (e: PointerEvent) => {
      const s = stroke.current;
      if (!s || !e.isPrimary) return;
      s.fingerX = e.clientX;
      s.fingerY = e.clientY;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP_PX) {
        s.moved = true;
        if (s.startPin) {
          s.drawing = true;
          handlers.current.onAdd(s.startPin);
        } else if (s.fromLast) {
          s.drawing = true; // already the last stop: nothing to add for the start
        }
      }
      if (!s.drawing) return;
      e.preventDefault();
      const id = pinAt(e.clientX, e.clientY);
      if (id) handlers.current.onAdd(id);
    };
    const up = (e: PointerEvent) => {
      const s = stroke.current;
      if (!s || !e.isPrimary) return;
      stroke.current = null;
      if (s.startPin || s.fromLast) handlers.current.onPanEnabled(true);
      if (s.drawing) {
        // The stroke may end on a pin, whose click would take it back out.
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300);
        return;
      }
      // A plain tap on bare map (not a pan, not a marker) drops the route
      // being made — or, editing, finishes the edit. A marker's tap is its
      // own (a stop's number takes it out).
      const onMarker = (e.target as Element | null)?.closest?.('.map-marker');
      if (!s.moved && !s.startPin && !s.fromLast && !onMarker && mapEl.contains(e.target as Node)) {
        // That tap's click comes after the layer has gone: it mustn't land on
        // whatever shows up under the finger (a route's < > arrows, say).
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300);
        handlers.current.onCancel();
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
      handlers.current.onPanEnabled(true);
    };
  }, [mapEl]);

  // The create sheet: up once the route has two stops and no stroke is
  // under way (a single drag through two pins brings it up when it ends),
  // then up for as long as it has two; at one it goes back down.
  const [sheetUp, setSheetUp] = useState(false);
  useEffect(() => {
    if (chosen.length < COURSE_LIMITS.minStops) setSheetUp(false);
    else if (!busy) setSheetUp(true);
  }, [chosen.length, busy]);
  // Kept a moment after going down, to slide away.
  const [sheetShown, setSheetShown] = useState(false);
  useEffect(() => {
    if (sheetUp) return setSheetShown(true);
    const t = window.setTimeout(() => setSheetShown(false), SHEET_OUT_MS);
    return () => window.clearTimeout(t);
  }, [sheetUp]);
  const [draft, setDraft] = useState<RouteCreateDraft>({ title: defaultTitle, note: '', folder: null });

  return (
    <>
      <svg className="stop-lines" aria-hidden>
        <line ref={trailEl} className="route-build__trail" />
      </svg>

      {!editing && (
        <p className="route-build__hint" role="status">
          드래그 또는 클릭으로 루트 추가
        </p>
      )}

      {!editing && sheetShown && (
        <RouteCreateSheet
          draft={draft}
          onDraft={setDraft}
          defaultTitle={defaultTitle}
          folders={folders}
          leaving={!sheetUp}
          onCreate={() => {
            if (chosen.length < COURSE_LIMITS.minStops) return;
            const title = draft.title.replace(/\s+/g, ' ').trim() || defaultTitle;
            onCreate(title.slice(0, ROUTE_TITLE_MAX), draft.note.trim().slice(0, ROUTE_NOTE_MAX), draft.icon, draft.folder);
          }}
        />
      )}

    </>
  );
}

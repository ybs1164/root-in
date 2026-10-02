import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COURSE_LIMITS } from '../domain/course';
import { ROUTE_TITLE_MAX } from '../domain/routeBuild';
import { RouteIconFace, RouteIconOptions } from './RouteIconOptions';
import { stopCentre } from './StopLines';

interface RouteBuildLayerProps {
  /** The map's container: drawing and the cancel-tap only count inside it. */
  mapEl: HTMLElement | null;
  /** Pin ids chosen so far, in order. */
  chosen: string[];
  /** Adds a pin as the next stop (ignored if it's already in or the route is full). */
  onAdd: (pinId: string) => void;
  /** A tap on the bare map: drop the route being made. */
  onCancel: () => void;
  onPanEnabled: (enabled: boolean) => void;
  defaultTitle: string;
  /**
   * A stroke begun before this layer appeared (dragging from a pin in the
   * folder view): the app keeps its finger here so the dashed preview line
   * can follow it too.
   */
  handoff?: { current: { x: number; y: number } | null };
  onCreate: (title: string, note: string, icon: string | undefined) => void;
  /**
   * Editing a saved route instead of making one: stops are picked the same
   * way, but the edit sheet has the ✓ (no button or name dialog here) and a
   * tap on bare map changes nothing.
   */
  editing?: boolean;
}

/** Movement before a press counts as a drag (drawing, or panning the map). */
const SLOP_PX = 10;

interface Stroke {
  x: number;
  y: number;
  startPin: string | null;
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
export default function RouteBuildLayer({ mapEl, chosen, onAdd, onCancel, onPanEnabled, defaultTitle, handoff, onCreate, editing = false }: RouteBuildLayerProps) {
  const handoffRef = useRef(handoff);
  handoffRef.current = handoff;
  const trailEl = useRef<SVGLineElement | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const handlers = useRef({ onAdd, onCancel, onPanEnabled });
  handlers.current = { onAdd, onCancel, onPanEnabled };

  // The stops' lines are StopLines (the app draws them for any route); this
  // adds the dashed one from the last stop to a finger mid-stroke.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const own = stroke.current;
      const outer = handoffRef.current?.current ?? null;
      const s = own?.drawing ? own : outer ? { drawing: true, fingerX: outer.x, fingerY: outer.y } : null;
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
      stroke.current = { x: e.clientX, y: e.clientY, startPin, drawing: false, moved: false, fingerX: e.clientX, fingerY: e.clientY };
      // Starting on a pin may become a drawing stroke: keep the map still under it.
      if (startPin) handlers.current.onPanEnabled(false);
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
      if (s.startPin) handlers.current.onPanEnabled(true);
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
      // A plain tap on bare map (not a pan) drops the route being made.
      if (!s.moved && !s.startPin && mapEl.contains(e.target as Node)) handlers.current.onCancel();
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

  // ✓ → name and description, in a native modal <dialog>.
  const dialogEl = useRef<HTMLDialogElement | null>(null);
  const [asking, setAsking] = useState(false);
  // The route's decorative icon (none to start with), and whether its picker is open.
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [pickingIcon, setPickingIcon] = useState(false);
  useEffect(() => {
    const d = dialogEl.current;
    if (asking && d && !d.open) d.showModal();
  }, [asking]);

  return (
    <>
      <svg className="stop-lines" aria-hidden>
        <line ref={trailEl} className="route-build__trail" />
      </svg>

      {!editing && (
      <button
        className="route-build__done"
        aria-label={`경로 완성 (${chosen.length}곳)`}
        disabled={chosen.length < COURSE_LIMITS.minStops}
        onClick={() => setAsking(true)}
      >
        <Check size={26} aria-hidden />
      </button>
      )}

      {asking && (
        <dialog ref={dialogEl} className="confirm-dialog route-build__dialog" aria-label="루트 만들기" onClose={() => setAsking(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const title = String(data.get('title') ?? '').trim() || defaultTitle;
              onCreate(title.slice(0, ROUTE_TITLE_MAX), String(data.get('note') ?? '').trim().slice(0, COURSE_LIMITS.note), icon);
              dialogEl.current?.close();
            }}
          >
            <div className="route-build__name">
              <button
                type="button"
                className={`route-build__icon ${icon ? '' : 'is-empty'}`}
                aria-label={`아이콘 ${icon ?? '없음'}, 바꾸기`}
                aria-expanded={pickingIcon}
                onClick={() => setPickingIcon((v) => !v)}
              >
                <RouteIconFace icon={icon} />
              </button>
              <input name="title" className="route-build__field" aria-label="이름" placeholder="이름" defaultValue={defaultTitle} maxLength={ROUTE_TITLE_MAX} />
            </div>
            {pickingIcon && (
              <div className="route-build__icons" role="group" aria-label="아이콘">
                <RouteIconOptions
                  value={icon}
                  onPick={(i) => {
                    setIcon(i);
                    setPickingIcon(false);
                  }}
                />
              </div>
            )}
            <textarea name="note" className="route-build__field route-build__note" aria-label="설명" placeholder="설명" maxLength={COURSE_LIMITS.note} rows={3} />
            <div className="confirm-dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={() => dialogEl.current?.close()}>
                취소
              </button>
              <button type="submit" className="btn btn--primary">
                루트 생성
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}

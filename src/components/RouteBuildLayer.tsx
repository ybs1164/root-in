import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COURSE_LIMITS } from '../domain/course';

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
  onCreate: (title: string, note: string) => void;
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
function pinAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).dataset?.pinId;
    if (id) return id;
  }
  return null;
}

function markerCentre(pinId: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`.map-marker--pin[data-pin-id="${CSS.escape(pinId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Making a route over the map. Pins tapped (or swept through in one stroke,
 * starting on a pin) join in order and are joined by straight lines, drawn
 * here from the markers' screen positions so they show even before the
 * basemap has loaded. A tap on bare map cancels; ✓ asks for a name and a
 * description, and 루트 생성 saves it.
 */
export default function RouteBuildLayer({ mapEl, chosen, onAdd, onCancel, onPanEnabled, defaultTitle, onCreate }: RouteBuildLayerProps) {
  const lineEl = useRef<SVGPolylineElement | null>(null);
  const trailEl = useRef<SVGLineElement | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const handlers = useRef({ onAdd, onCancel, onPanEnabled });
  handlers.current = { onAdd, onCancel, onPanEnabled };

  // The lines follow the markers as the map moves: redrawn every frame while open.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const points = chosenRef.current.map(markerCentre).filter((p): p is { x: number; y: number } => !!p);
      lineEl.current?.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
      const s = stroke.current;
      const last = points[points.length - 1];
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
  useEffect(() => {
    const d = dialogEl.current;
    if (asking && d && !d.open) d.showModal();
  }, [asking]);

  return (
    <>
      <svg className="route-build__lines" aria-hidden>
        <polyline ref={lineEl} />
        <line ref={trailEl} className="route-build__trail" />
      </svg>

      <button
        className="route-build__done"
        aria-label={`경로 완성 (${chosen.length}곳)`}
        disabled={chosen.length < COURSE_LIMITS.minStops}
        onClick={() => setAsking(true)}
      >
        <Check size={26} aria-hidden />
      </button>

      {asking && (
        <dialog ref={dialogEl} className="confirm-dialog route-build__dialog" aria-label="루트 만들기" onClose={() => setAsking(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const title = String(data.get('title') ?? '').trim() || defaultTitle;
              onCreate(title.slice(0, COURSE_LIMITS.title), String(data.get('note') ?? '').trim().slice(0, COURSE_LIMITS.note));
              dialogEl.current?.close();
            }}
          >
            <input name="title" className="route-build__field" aria-label="경로 이름" placeholder="경로 이름" defaultValue={defaultTitle} maxLength={COURSE_LIMITS.title} />
            <textarea name="note" className="route-build__field route-build__note" aria-label="경로 설명" placeholder="경로 설명" maxLength={COURSE_LIMITS.note} rows={3} />
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

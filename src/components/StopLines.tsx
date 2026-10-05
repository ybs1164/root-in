import { useEffect, useRef, type CSSProperties } from 'react';
import type { RouteEdgeStyle, RouteStopShape } from '../domain/routeStyle';
import type { PinIcon, PinTint } from '../types/pin';
import PinGlyph from './PinGlyph';
import { placeLabels } from '../domain/stopLabels';
import { PingIcon } from './DayPings';
import { pinColorCss } from '../domain/pin';

/** Screen centre of the numbered stop marker `n` (1-based), if it's on the map. */
export function stopCentre(n: number): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`.map-marker[data-stop="${n}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface StopLinesProps {
  count: number;
  pinStyles?: { icon: PinIcon; color: PinTint }[];
  /** Per line between stops (null / missing = solid). */
  edgeStyles?: (RouteEdgeStyle | null)[];
  /** Per stop (null / missing = the plain numbered marker). */
  stopShapes?: (RouteStopShape | null)[];
  /**
   * Plays the route in, as a calendar day's pings do: after `delayMs` (the map
   * gliding over), the stops drop in one by one and each line draws itself to
   * the next stop. A new `key` replays it.
   */
  play?: { key: string; delayMs: number };
  /** The stops' place names, shown beside them (a route on show); left out, no names. */
  names?: string[];
}

/** Between stops dropping in; a drop's length; a line drawing itself. */
const STOP_STEP_MS = 180;
const DROP_MS = 450;
const LINE_MS = 320;

/**
 * Straight lines between a route's numbered stops, drawn over the map from
 * the markers' screen positions (moved every frame so they follow pans and
 * zooms). The map's own line needs its style loaded; these show regardless.
 * A stop given a shape is drawn here as that shape and its marker hidden
 * (`data-shape`), the marker staying in place for taps and long presses.
 */
export default function StopLines({ count, edgeStyles, stopShapes, play, names, pinStyles }: StopLinesProps) {
  // When the current playback started (performance.now(), after its delay); null = all shown.
  const playStart = useRef<number | null>(null);
  useEffect(() => {
    playStart.current = play ? performance.now() + play.delayMs : null;
  }, [play?.key]);

  const segs = useRef<(SVGLineElement | null)[]>([]);
  const shapes = useRef<(HTMLDivElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  // The names' sizes, measured once they're laid out (they're kept laid out, only faded out, so they can be).
  const labelSizes = useRef<{ w: number; h: number }[]>([]);
  useEffect(() => {
    labelSizes.current = [];
  }, [names?.join('\n')]);
  const shapesRef = useRef(stopShapes);
  shapesRef.current = stopShapes;

  useEffect(() => {
    let frame = 0;
    // Sets or clears a data flag only when it changes (it restarts CSS animations).
    const flag = (el: HTMLElement | null | undefined, name: 'hidden' | 'drop', on: boolean) => {
      if (!el || (name in el.dataset) === on) return;
      if (on) el.dataset[name] = '';
      else delete el.dataset[name];
    };
    const draw = () => {
      const centres = Array.from({ length: count }, (_, i) => stopCentre(i + 1));
      const start = playStart.current;
      const elapsed = start === null ? Infinity : performance.now() - start;
      if (elapsed > (count - 1) * STOP_STEP_MS + DROP_MS + LINE_MS) playStart.current = null;
      for (let i = 0; i < count - 1; i += 1) {
        const seg = segs.current[i];
        const [a, b] = [centres[i], centres[i + 1]];
        if (!seg) continue;
        // Line i draws once stop i has landed, reaching stop i + 1 as it drops.
        const t = Math.max(0, Math.min(1, (elapsed - (i * STOP_STEP_MS + DROP_MS * 0.6)) / LINE_MS));
        seg.style.display = a && b && t > 0 ? '' : 'none';
        if (a && b) {
          seg.setAttribute('x1', String(a.x));
          seg.setAttribute('y1', String(a.y));
          seg.setAttribute('x2', String(a.x + (b.x - a.x) * t));
          seg.setAttribute('y2', String(a.y + (b.y - a.y) * t));
        }
      }
      for (let i = 0; i < count; i += 1) {
        const marker = document.querySelector<HTMLElement>(`.map-marker[data-stop="${i + 1}"]`);
        const shape = shapesRef.current?.[i] ?? '';
        if (marker && (marker.dataset.shape ?? '') !== shape) {
          if (shape) marker.dataset.shape = shape;
          else delete marker.dataset.shape;
        }
        // Hidden until its turn, then dropping in, then just there.
        const since = elapsed - i * STOP_STEP_MS;
        const el = shapes.current[i];
        for (const target of [marker, el]) {
          flag(target, 'hidden', since < 0);
          flag(target, 'drop', since >= 0 && since < DROP_MS);
        }
        const c = centres[i];
        if (el) {
          el.style.display = c && shape ? '' : 'none';
          if (c) el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        }
        // Its name: shown once it has landed (placed for all the stops below).
        const label = labels.current[i];
        if (label) {
          const shown = !!c && since >= 0;
          if (('shown' in label.dataset) !== shown) {
            if (shown) label.dataset.shown = '';
            else delete label.dataset.shown;
          }
          if (c) label.style.transform = `translate(${c.x}px, ${c.y}px)`;
        }
      }
      // The names: each below its stop, or off the side its lines, the other
      // names and the other stops leave clear.
      if (labels.current.some(Boolean) && centres.every(Boolean)) {
        const sizes = labels.current.slice(0, count).map((el, i) => {
          const known = labelSizes.current[i];
          if (known?.w) return known;
          const text = el?.firstElementChild as HTMLElement | null;
          const size = { w: text?.offsetWidth ?? 0, h: text?.offsetHeight ?? 0 };
          labelSizes.current[i] = size;
          return size;
        });
        const sides = placeLabels(centres as { x: number; y: number }[], sizes);
        sides.forEach((side, i) => {
          const el = labels.current[i];
          if (el && el.dataset.side !== side) el.dataset.side = side;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>('.map-marker[data-shape], .map-marker[data-hidden], .map-marker[data-drop]').forEach((m) => {
        delete m.dataset.shape;
        delete m.dataset.hidden;
        delete m.dataset.drop;
      });
    };
  }, [count, names?.length]);

  return (
    <>
      <svg className="stop-lines" aria-hidden>
        {Array.from({ length: Math.max(0, count - 1) }, (_, i) => (
          <line
            key={i}
            ref={(el) => {
              segs.current[i] = el;
            }}
            className={`stop-lines__seg stop-lines__seg--${edgeStyles?.[i] ?? 'solid'}`}
          />
        ))}
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const shape = stopShapes?.[i];
        return (
          <div
            key={i}
            ref={(el) => {
              shapes.current[i] = el;
            }}
            className={`stop-shape stop-shape--${shape ?? 'none'}`}
            style={shape === 'transparent' ? { '--stop-pin': pinColorCss(pinStyles?.[i]?.color ?? 0) } as CSSProperties : undefined}
            aria-hidden
          >
            {shape === 'transparent' ? <PinGlyph icon={pinStyles?.[i]?.icon ?? 'pin'} /> : shape && <PingIcon shape={shape} />}
          </div>
        );
      })}
      {names?.slice(0, count).map((name, i) => (
        <span
          key={`label-${i}`}
          ref={(el) => {
            labels.current[i] = el;
          }}
          className="stop-label"
          aria-hidden
        >
          <span className="stop-label__text">{name}</span>
        </span>
      ))}
    </>
  );
}

import { useEffect, useRef } from 'react';
import type { EdgeStyle, PingShape } from '../domain/dayPings';
import { PingIcon } from './DayPings';

/** Screen centre of the numbered stop marker `n` (1-based), if it's on the map. */
export function stopCentre(n: number): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`.map-marker[data-stop="${n}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface StopLinesProps {
  count: number;
  /** Per line between stops (null / missing = solid). */
  edgeStyles?: (EdgeStyle | null)[];
  /** Per stop (null / missing = the plain numbered marker). */
  stopShapes?: (PingShape | null)[];
}

/**
 * Straight lines between a route's numbered stops, drawn over the map from
 * the markers' screen positions (moved every frame so they follow pans and
 * zooms). The map's own line needs its style loaded; these show regardless.
 * A stop given a shape is drawn here as that shape and its marker hidden
 * (`data-shape`), the marker staying in place for taps and long presses.
 */
export default function StopLines({ count, edgeStyles, stopShapes }: StopLinesProps) {
  const segs = useRef<(SVGLineElement | null)[]>([]);
  const shapes = useRef<(HTMLDivElement | null)[]>([]);
  const shapesRef = useRef(stopShapes);
  shapesRef.current = stopShapes;

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const centres = Array.from({ length: count }, (_, i) => stopCentre(i + 1));
      for (let i = 0; i < count - 1; i += 1) {
        const seg = segs.current[i];
        const [a, b] = [centres[i], centres[i + 1]];
        if (!seg) continue;
        seg.style.display = a && b ? '' : 'none';
        if (a && b) {
          seg.setAttribute('x1', String(a.x));
          seg.setAttribute('y1', String(a.y));
          seg.setAttribute('x2', String(b.x));
          seg.setAttribute('y2', String(b.y));
        }
      }
      for (let i = 0; i < count; i += 1) {
        const marker = document.querySelector<HTMLElement>(`.map-marker[data-stop="${i + 1}"]`);
        const shape = shapesRef.current?.[i] ?? '';
        if (marker && (marker.dataset.shape ?? '') !== shape) {
          if (shape) marker.dataset.shape = shape;
          else delete marker.dataset.shape;
        }
        const el = shapes.current[i];
        const c = centres[i];
        if (el) {
          el.style.display = c && shape ? '' : 'none';
          if (c) el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>('.map-marker[data-shape]').forEach((m) => delete m.dataset.shape);
    };
  }, [count]);

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
            aria-hidden
          >
            {shape && <PingIcon shape={shape} />}
          </div>
        );
      })}
    </>
  );
}

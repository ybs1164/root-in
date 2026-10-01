import { useEffect, useRef } from 'react';

/** Screen centre of the numbered stop marker `n` (1-based), if it's on the map. */
export function stopCentre(n: number): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`.map-marker[data-stop="${n}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Straight lines between a route's numbered stops, drawn over the map from
 * the markers' screen positions (redrawn every frame so they follow pans and
 * zooms). The map's own line needs its style loaded; these show regardless.
 */
export default function StopLines({ count }: { count: number }) {
  const lineEl = useRef<SVGPolylineElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const points: string[] = [];
      for (let n = 1; n <= count; n += 1) {
        const p = stopCentre(n);
        if (p) points.push(`${p.x},${p.y}`);
      }
      lineEl.current?.setAttribute('points', points.join(' '));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [count]);
  return (
    <svg className="stop-lines" aria-hidden>
      <polyline ref={lineEl} />
    </svg>
  );
}

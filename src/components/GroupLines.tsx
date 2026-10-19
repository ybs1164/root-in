import { useEffect, useRef } from 'react';

export interface GroupLine {
  member: string;
  color: string;
  count: number;
  faded: boolean;
}

/** Screen centre of a member's `seq`th ping marker, if it's on the map. */
function pingCentre(member: string, seq: number): string | null {
  const el = document.querySelector<HTMLElement>(`.group-ping[data-member="${member}"][data-seq="${seq}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)}`;
}

/**
 * We Now: each member's day as a straight line through their pings, in their
 * colour, drawn over the map from the markers' screen positions (moved every
 * frame so they follow pans and zooms), as StopLines does for a route.
 */
export default function GroupLines({ lines }: { lines: GroupLine[] }) {
  const refs = useRef<(SVGPolylineElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      lines.forEach((line, i) => {
        const el = refs.current[i];
        if (!el) return;
        const points = Array.from({ length: line.count }, (_, k) => pingCentre(line.member, k)).filter(Boolean).join(' ');
        if (el.getAttribute('points') !== points) el.setAttribute('points', points);
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  return (
    <svg className="group-lines" aria-hidden>
      {lines.map((line, i) => (
        <polyline
          key={line.member}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={line.faded ? 'is-faded' : undefined}
          style={{ stroke: line.color }}
        />
      ))}
    </svg>
  );
}

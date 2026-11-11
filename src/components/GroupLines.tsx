import { useEffect, useRef } from 'react';
import type { LineLook } from '../domain/dayPings';

export interface GroupLine {
  member: string;
  color: string;
  count: number;
  faded: boolean;
  /** Per leg: one from island to island on the atlas (a trip between regions), drawn dotted with no casing. */
  jumps?: boolean[];
  /** Per leg: the style its member long-pressed it into (none = the plain solid line). */
  styles?: (LineLook | undefined)[];
}

/** Screen centre of a member's `seq`th ping marker, if it's on the map. */
export function pingCentre(member: string, seq: number): [number, number] | null {
  const el = document.querySelector<HTMLElement>(`.group-ping[data-member="${member}"][data-seq="${seq}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
}

/**
 * We Now: each member's day as straight lines from ping to ping, in their
 * colour, drawn over the map from the markers' screen positions (moved every
 * frame so they follow pans and zooms) and under the markers. Like TODAY's
 * lines, each leg is its own line on its own casing, drawn in order, so the
 * next leg's casing cuts the one before at every ping rather than running
 * through as one polyline.
 */
export default function GroupLines({ lines }: { lines: GroupLine[] }) {
  /** Per member, per leg: [casing, line]. */
  const legs = useRef<Record<string, ([SVGLineElement | null, SVGLineElement | null] | undefined)[]>>({});
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      for (const line of lines) {
        const ends = Array.from({ length: line.count }, (_, k) => pingCentre(line.member, k));
        (legs.current[line.member] ?? []).forEach((pair, k) => {
          const [a, b] = [ends[k], ends[k + 1]];
          for (const el of pair ?? []) {
            if (!el) continue;
            if (!a || !b) {
              el.style.visibility = 'hidden';
              continue;
            }
            el.style.visibility = '';
            el.setAttribute('x1', String(a[0]));
            el.setAttribute('y1', String(a[1]));
            el.setAttribute('x2', String(b[0]));
            el.setAttribute('y2', String(b[1]));
          }
        });
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  return (
    <svg className="group-lines" aria-hidden>
      {lines.map((line) => (
        <g key={line.member} className={line.faded ? 'is-faded' : undefined} style={{ stroke: line.color }}>
          {Array.from({ length: Math.max(0, line.count - 1) }, (_, k) => (
            <g key={k} className={[line.jumps?.[k] && 'is-jump', line.styles?.[k] && line.styles[k] !== 'solid' && `is-${line.styles[k]}`].filter(Boolean).join(' ') || undefined}>
              <line
                className="group-lines__case"
                ref={(el) => {
                  (legs.current[line.member] ??= [])[k] = [el, legs.current[line.member]?.[k]?.[1] ?? null];
                }}
              />
              <line
                ref={(el) => {
                  (legs.current[line.member] ??= [])[k] = [legs.current[line.member]?.[k]?.[0] ?? null, el];
                }}
              />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
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

/** Where a line ends: a ping's screen centre, or null when it isn't on the map. */
export type PingCentreOf = (member: string, seq: number) => [number, number] | null;

export interface LinesHandle {
  /** Moves every leg to these ends (the atlas calls it as it moves its markers). */
  draw(centre: PingCentreOf): void;
}

/**
 * We Now: each member's day as straight lines from ping to ping, in their
 * colour, drawn over the map at the markers' screen positions and under the
 * markers. Like TODAY's lines, each leg is its own line on its own casing,
 * drawn in order, so the next leg's casing cuts the one before at every ping
 * rather than running through as one polyline.
 *
 * Given a `handle`, whoever moves the markers moves the lines in the same
 * frame (the atlas: a loop of the lines' own read the markers a frame late,
 * so the lines trailed the pins in a zoom, and it repainted every frame even
 * at rest). Without one, a loop follows the markers on the page.
 */
export default function GroupLines({ lines, handle }: { lines: GroupLine[]; handle?: Ref<LinesHandle> }) {
  /** Per member, per leg: [casing, line]. */
  const legs = useRef<Record<string, ([SVGLineElement | null, SVGLineElement | null] | undefined)[]>>({});
  /** What each line was last set to: a leg that hasn't moved isn't touched (nor repainted). */
  const set = useRef(new WeakMap<SVGLineElement, string>());
  const draw = useCallback(
    (centre: PingCentreOf) => {
      for (const line of lines) {
        const ends = Array.from({ length: line.count }, (_, k) => centre(line.member, k));
        (legs.current[line.member] ?? []).forEach((pair, k) => {
          const [a, b] = [ends[k], ends[k + 1]];
          const at = a && b ? `${a[0]} ${a[1]} ${b[0]} ${b[1]}` : '';
          for (const el of pair ?? []) {
            if (!el || set.current.get(el) === at) continue;
            set.current.set(el, at);
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
    },
    [lines],
  );
  useImperativeHandle(handle, () => ({ draw }), [draw]);
  const driven = !!handle;
  useEffect(() => {
    if (driven) return;
    let frame = 0;
    const loop = () => {
      draw(pingCentre);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [draw, driven]);

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

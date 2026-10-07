import { useId, type CSSProperties } from 'react';
import type { PatternId } from '../domain/decor';
import { markTransform, PATTERN_TILES } from '../lib/dayPatterns';

/**
 * A day's background pattern (꾸미기), filling its box behind everything.
 * Flowing patterns slide by exactly one tile per loop, so the loop never
 * shows a seam.
 */
export default function DayPattern({
  pattern,
  className = '',
  scale = 1,
  accent,
}: {
  pattern: PatternId;
  className?: string;
  /** Shrinks or grows the tile (the 꾸미기 sheet's previews); the loop scales with it. */
  scale?: number;
  /** Draws in another theme's accent (a day's own pattern under the share screen's theme). */
  accent?: string;
}) {
  const id = `pattern-${useId().replace(/:/g, '')}`;
  if (pattern === 'none') return null;
  const tile = PATTERN_TILES[pattern];
  const flow = tile.flow;
  const pad = tile.size * scale;
  const sheet = (
    <svg className="day-pattern__sheet" aria-hidden>
      <defs>
        <pattern
          id={id}
          width={tile.size}
          height={tile.size}
          patternUnits="userSpaceOnUse"
          patternTransform={scale === 1 ? undefined : `scale(${scale})`}
        >
          {tile.marks.map((m, i) => {
            const stroke = m.stroke ?? tile.stroke;
            return (
              <path
                key={i}
                d={m.d}
                transform={markTransform(m)}
                opacity={m.alpha}
                className={stroke ? 'day-pattern__line' : 'day-pattern__mark'}
                style={stroke ? { strokeWidth: stroke } : undefined}
              />
            );
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
  return (
    <div className={`day-pattern ${className}`} style={accent ? ({ '--accent': accent } as CSSProperties) : undefined} aria-hidden>
      {flow ? (
        // The loop moves an HTML box holding the pattern, not the SVG inside
        // it: a transform on an HTML element runs on the compositor, while one
        // on an SVG shape repainted the whole pattern every frame. The box
        // reaches one tile past every edge (the most a loop moves it), and
        // starting a whole tile out keeps the tiles where they were.
        <div
          className="day-pattern__flow"
          style={
            {
              inset: `${-pad}px`,
              '--flow-x': `${flow.x * scale}px`,
              '--flow-y': `${flow.y * scale}px`,
              animationDuration: `${flow.seconds}s`,
            } as CSSProperties
          }
        >
          {sheet}
        </div>
      ) : (
        sheet
      )}
      {tile.margin && (
        <svg className="day-pattern__sheet" aria-hidden>
          <rect x={tile.margin.x * scale} y="0" width={tile.margin.width * scale} height="100%" className="day-pattern__mark" />
        </svg>
      )}
    </div>
  );
}

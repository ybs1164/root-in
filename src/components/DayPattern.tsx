import { useId, type CSSProperties } from 'react';
import type { PatternId } from '../domain/decor';
import { markTransform, PATTERN_TILES } from '../lib/dayPatterns';

/**
 * A day's background pattern (꾸미기), filling its box behind everything.
 * Flowing patterns slide by exactly one tile per loop, so the loop never
 * shows a seam.
 */
export default function DayPattern({ pattern, className = '' }: { pattern: PatternId; className?: string }) {
  const id = `pattern-${useId().replace(/:/g, '')}`;
  if (pattern === 'none') return null;
  const tile = PATTERN_TILES[pattern];
  const flow = tile.flow;
  return (
    <svg className={`day-pattern ${className}`} aria-hidden>
      <defs>
        <pattern id={id} width={tile.size} height={tile.size} patternUnits="userSpaceOnUse">
          {tile.marks.map((m, i) => (
            <path
              key={i}
              d={m.d}
              transform={markTransform(m)}
              className={tile.stroke ? 'day-pattern__line' : 'day-pattern__mark'}
              style={tile.stroke ? { strokeWidth: tile.stroke } : undefined}
            />
          ))}
        </pattern>
      </defs>
      {/* Oversized so it still covers the box wherever the loop has moved it. */}
      <rect
        x={-tile.size}
        y={-tile.size}
        width="4000"
        height="4000"
        fill={`url(#${id})`}
        className={flow ? 'day-pattern__flow' : undefined}
        style={
          flow
            ? ({ '--flow-x': `${flow.x}px`, '--flow-y': `${flow.y}px`, animationDuration: `${flow.seconds}s` } as CSSProperties)
            : undefined
        }
      />
    </svg>
  );
}

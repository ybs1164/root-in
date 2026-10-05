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
}: {
  pattern: PatternId;
  className?: string;
  /** Shrinks or grows the tile (the 꾸미기 sheet's previews); the loop scales with it. */
  scale?: number;
}) {
  const id = `pattern-${useId().replace(/:/g, '')}`;
  if (pattern === 'none') return null;
  const tile = PATTERN_TILES[pattern];
  const flow = tile.flow;
  return (
    <svg className={`day-pattern ${className}`} aria-hidden>
      <defs>
        <pattern
          id={id}
          width={tile.size}
          height={tile.size}
          patternUnits="userSpaceOnUse"
          patternTransform={scale === 1 ? undefined : `scale(${scale})`}
        >
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
        x={-tile.size * scale}
        y={-tile.size * scale}
        width="4000"
        height="4000"
        fill={`url(#${id})`}
        className={flow ? 'day-pattern__flow' : undefined}
        style={
          flow
            ? ({ '--flow-x': `${flow.x * scale}px`, '--flow-y': `${flow.y * scale}px`, animationDuration: `${flow.seconds}s` } as CSSProperties)
            : undefined
        }
      />
      {tile.margin && (
        <rect
          x={tile.margin.x * scale}
          y="0"
          width={tile.margin.width * scale}
          height="100%"
          className="day-pattern__mark"
        />
      )}
    </svg>
  );
}

import { EDGE_STYLES, PING_SHAPES, type EdgeStyle, type PingShape } from './dayPings';

/**
 * How a saved route is drawn, chosen by long-pressing it on the map: a shape
 * per stop (null = the plain numbered marker) and a style per line between
 * stops (null = solid). Same vocabulary as a calendar day's pings.
 */
export interface RouteLook {
  stopShapes?: (PingShape | null)[];
  edgeStyles?: (EdgeStyle | null)[];
}

const SHAPES = new Set<string>(PING_SHAPES.map((s) => s.shape));
const STYLES = new Set<string>(EDGE_STYLES.map((s) => s.style));

/** Keeps known values only, one per slot; all-empty becomes undefined (nothing to store). */
function clean<T extends string>(values: unknown, length: number, known: Set<string>): (T | null)[] | undefined {
  if (!Array.isArray(values) || length <= 0) return undefined;
  const out = Array.from({ length }, (_, i) => (typeof values[i] === 'string' && known.has(values[i]) ? (values[i] as T) : null));
  return out.some((v) => v !== null) ? out : undefined;
}

/** What a course stores for its look, for `stopCount` stops. */
export function cleanRouteLook(look: RouteLook, stopCount: number): RouteLook {
  return {
    stopShapes: clean<PingShape>(look.stopShapes, stopCount, SHAPES),
    edgeStyles: clean<EdgeStyle>(look.edgeStyles, stopCount - 1, STYLES),
  };
}

/** Sets one stop's shape (null back to the numbered marker). */
export function withStopShape(look: RouteLook, stopCount: number, index: number, shape: PingShape | null): RouteLook {
  const shapes = Array.from({ length: stopCount }, (_, i) => look.stopShapes?.[i] ?? null);
  shapes[index] = shape;
  return cleanRouteLook({ ...look, stopShapes: shapes }, stopCount);
}

/** Sets the style of the line from stop `index` to the next. */
export function withEdgeStyle(look: RouteLook, stopCount: number, index: number, style: EdgeStyle | null): RouteLook {
  const styles = Array.from({ length: stopCount - 1 }, (_, i) => look.edgeStyles?.[i] ?? null);
  styles[index] = style;
  return cleanRouteLook({ ...look, edgeStyles: styles }, stopCount);
}

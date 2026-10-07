import { COURSE_LIMITS } from './course';
import type { RouteEdgeStyle, RouteStopShape } from './routeStyle';
import { cleanRouteLook, type RouteLook } from './routeStyle';

/**
 * Making a route from pins: pins tapped in order become its stops. Tapping
 * a chosen pin again takes it out; past the course limit nothing is added.
 */
export function toggleBuildStop(chosen: readonly string[], pinId: string): string[] {
  if (chosen.includes(pinId)) return chosen.filter((id) => id !== pinId);
  if (chosen.length >= COURSE_LIMITS.maxStops) return [...chosen];
  return [...chosen, pinId];
}

export const DEFAULT_ROUTE_NAME = 'IN MY ROOT';

/** A route's name: short enough to read big above the map (two lines at most on a phone). */
export const ROUTE_TITLE_MAX = 15;
/** A route's description: a line or two under its name in the folder sheet. */
export const ROUTE_NOTE_MAX = 100;

/** A new route's name: 'IN MY ROOT', or 'IN MY ROOT #2', 'IN MY ROOT #3', … when taken. */
export function nextRouteName(taken: Iterable<string>): string {
  const names = new Set([...taken].map((t) => t.trim()));
  if (!names.has(DEFAULT_ROUTE_NAME)) return DEFAULT_ROUTE_NAME;
  let n = 2;
  while (names.has(`${DEFAULT_ROUTE_NAME} #${n}`)) n += 1;
  return `${DEFAULT_ROUTE_NAME} #${n}`;
}

/**
 * Stop shapes and line styles picked (long press) while making a route, kept
 * by pin rather than by place in the order: taps take stops out and put them
 * back, and each keeps its own look. A line's style goes with the two pins it
 * joins, either way round.
 */
export interface BuildLook {
  shapes: Record<string, RouteStopShape>;
  edges: Record<string, RouteEdgeStyle>;
}

export const EMPTY_BUILD_LOOK: BuildLook = { shapes: {}, edges: {} };

export const buildEdgeKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The look for the route as it stands (pin ids in order), as a course stores it. */
export function buildRouteLook(ids: readonly string[], look: BuildLook): RouteLook {
  return cleanRouteLook(
    {
      stopShapes: ids.map((id) => look.shapes[id] ?? null),
      edgeStyles: ids.slice(1).map((id, i) => look.edges[buildEdgeKey(ids[i], id)] ?? null),
    },
    ids.length,
  );
}

/** Long press on stop `index`: its pin's shape (null back to its number). */
export function withBuildShape(look: BuildLook, ids: readonly string[], index: number, shape: RouteStopShape | null): BuildLook {
  const id = ids[index];
  if (!id) return look;
  const shapes = { ...look.shapes };
  if (shape) shapes[id] = shape;
  else delete shapes[id];
  return { ...look, shapes };
}

/** Long press on the line from stop `index` to the next. */
export function withBuildEdge(look: BuildLook, ids: readonly string[], index: number, style: RouteEdgeStyle | null): BuildLook {
  const a = ids[index];
  const b = ids[index + 1];
  if (!a || !b) return look;
  const edges = { ...look.edges };
  if (style && style !== 'solid') edges[buildEdgeKey(a, b)] = style;
  else delete edges[buildEdgeKey(a, b)];
  return { ...look, edges };
}

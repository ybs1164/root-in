import { COURSE_LIMITS } from './course';

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

/** A new route's name: 'IN MY ROOT', or 'IN MY ROOT 2', 'IN MY ROOT 3', … when taken. */
export function nextRouteName(taken: Iterable<string>): string {
  const names = new Set([...taken].map((t) => t.trim()));
  if (!names.has(DEFAULT_ROUTE_NAME)) return DEFAULT_ROUTE_NAME;
  let n = 2;
  while (names.has(`${DEFAULT_ROUTE_NAME} ${n}`)) n += 1;
  return `${DEFAULT_ROUTE_NAME} ${n}`;
}

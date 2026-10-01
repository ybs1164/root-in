import { COURSE_LIMITS } from './course';
import type { PlaceRef } from '../types/course';

/**
 * Making a route from pins: pins tapped in order become its stops. Tapping
 * a chosen pin again takes it out; past the course limit nothing is added.
 */
export function toggleBuildStop(chosen: readonly string[], pinId: string): string[] {
  if (chosen.includes(pinId)) return chosen.filter((id) => id !== pinId);
  if (chosen.length >= COURSE_LIMITS.maxStops) return [...chosen];
  return [...chosen, pinId];
}

/** A new route's title: '첫 곳 → 마지막 곳' (just the place for one stop). */
export function buildRouteTitle(stops: readonly PlaceRef[]): string {
  if (stops.length === 0) return '새 경로';
  const first = stops[0].name;
  const last = stops[stops.length - 1].name;
  const title = stops.length === 1 ? first : `${first} → ${last}`;
  return title.slice(0, COURSE_LIMITS.title);
}

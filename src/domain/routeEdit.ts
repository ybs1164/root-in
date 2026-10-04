import { COURSE_LIMITS } from './course';
import { cleanRouteLook, type RouteLook } from './routeStyle';
import type { CourseStop, PlaceRef } from '../types/course';

/** A route being edited, as it stands: what ✓ saves. */
export interface RouteEdit {
  id: string;
  stops: CourseStop[];
  note: string;
  /** The folder it is filed in (null = 미분류); moved there on ✓. */
  folder: string | null;
  /** Stop shapes and line styles, kept lined up with `stops` as they change. */
  look: RouteLook;
}

/** New stops for the route being edited, its look following them (shapes by place, lines by the places they join). */
export function withEditStops(edit: RouteEdit, stops: CourseStop[]): RouteEdit {
  return { ...edit, stops, look: remapRouteLook(edit.stops, edit.look, stops) };
}

/**
 * Editing a saved route (the pen by its name): its stops change the way a
 * new route's are picked — a tapped pin joins at the end or, if it's
 * already a stop, leaves — and the edit sheet's list reorders them.
 * Stops are matched by place id: a route's stops are snapshots, not pins.
 */
export function toggleEditStop(stops: readonly CourseStop[], place: PlaceRef): CourseStop[] {
  if (stops.some((s) => s.place.id === place.id)) return stops.filter((s) => s.place.id !== place.id);
  if (stops.length >= COURSE_LIMITS.maxStops) return [...stops];
  return [...stops, { place }];
}

/** A pin swept over mid-stroke: joins if it isn't a stop yet (never leaves). */
export function addEditStop(stops: readonly CourseStop[], place: PlaceRef): CourseStop[] {
  if (stops.some((s) => s.place.id === place.id) || stops.length >= COURSE_LIMITS.maxStops) return [...stops];
  return [...stops, { place }];
}

/** Moves the stop at `from` to `to`, the others closing up around it. */
export function moveStop<T>(stops: readonly T[], from: number, to: number): T[] {
  const next = [...stops];
  if (from < 0 || from >= next.length) return next;
  const [stop] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, stop);
  return next;
}

/**
 * A route's look after its stops changed: each stop keeps its shape, and a
 * line keeps its style while it still joins the same two places (either
 * way round). Lines that are new, and stops added, start plain.
 */
export function remapRouteLook(before: readonly CourseStop[], look: RouteLook, after: readonly CourseStop[]): RouteLook {
  const shapeOf = new Map(before.map((s, i) => [s.place.id, look.stopShapes?.[i] ?? null]));
  const edgeOf = new Map<string, NonNullable<RouteLook['edgeStyles']>[number]>();
  for (let i = 0; i + 1 < before.length; i += 1) {
    const style = look.edgeStyles?.[i] ?? null;
    edgeOf.set(`${before[i].place.id}>${before[i + 1].place.id}`, style);
    edgeOf.set(`${before[i + 1].place.id}>${before[i].place.id}`, style);
  }
  return cleanRouteLook(
    {
      stopShapes: after.map((s) => shapeOf.get(s.place.id) ?? null),
      edgeStyles: after.slice(1).map((s, i) => edgeOf.get(`${after[i].place.id}>${s.place.id}`) ?? null),
    },
    after.length,
  );
}

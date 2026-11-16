import type { Course } from '../types/course';
import { courseRepository, type CourseRepository } from './courseRepository';

export interface RouteRecommendation {
  /** The route's places in order: what makes two saved routes the same one. */
  placeIds: string[];
  placeNames: string[];
  /** How many saved routes go through exactly these places in this order. */
  count: number;
}

/** Two routes are the same recommendation when they visit the same places in the same order. */
const routeKey = (course: Pick<Course, 'stops'>): string => course.stops.map((stop) => stop.place.id).join('>');

/**
 * Extension point for the planned "recommend based on other users' saved
 * routes" feature (M3; nothing shows it yet).
 *
 * `repository.listAll()` is the seam: right now it only sees this one
 * browser's own routes (LocalCourseRepository), so this just counts routes
 * through the same places among them. Once routes are read from a backend,
 * `listAll()` starts returning every user's routes and this begins ranking
 * genuine cross-user popularity — no caller-side changes needed.
 */
export async function getPopularRoutes(
  repository: Pick<CourseRepository, 'listAll'> = courseRepository,
  limit = 3,
): Promise<RouteRecommendation[]> {
  const byRoute = new Map<string, RouteRecommendation>();
  for (const course of await repository.listAll()) {
    if (course.stops.length === 0) continue;
    const key = routeKey(course);
    const existing = byRoute.get(key);
    if (existing) existing.count += 1;
    else {
      byRoute.set(key, {
        placeIds: course.stops.map((stop) => stop.place.id),
        placeNames: course.stops.map((stop) => stop.place.name),
        count: 1,
      });
    }
  }
  return [...byRoute.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

import { travelRouteRepository, type TravelRouteRepository } from './travelRouteRepository';

export interface RouteRecommendation {
  originId: string;
  destinationId: string;
  originName: string;
  destinationName: string;
  /** How many saved routes matched this origin→destination pair. */
  count: number;
}

/**
 * Extension point for the planned "recommend based on other users' saved
 * routes" feature.
 *
 * `repository.listAll()` is the seam: right now it only sees this one
 * browser's own routes (LocalTravelRouteRepository), so this just counts
 * duplicate origin→destination pairs among them. Once travel routes move to
 * a real backend, `listAll()` starts returning every user's routes and this
 * function begins ranking genuine cross-user popularity — no caller-side
 * changes needed. From there it's natural to layer in things like recency,
 * distance from the user's current search, or per-user ratings.
 */
export async function getPopularRoutes(
  repository: TravelRouteRepository = travelRouteRepository,
  limit = 3,
): Promise<RouteRecommendation[]> {
  const routes = await repository.listAll();
  const byPair = new Map<string, RouteRecommendation>();

  for (const route of routes) {
    const key = `${route.origin.id}->${route.destination.id}`;
    const existing = byPair.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byPair.set(key, {
        originId: route.origin.id,
        destinationId: route.destination.id,
        originName: route.origin.name,
        destinationName: route.destination.name,
        count: 1,
      });
    }
  }

  return [...byPair.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

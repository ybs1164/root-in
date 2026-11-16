import { describe, expect, it } from 'vitest';

// M1 1.7 (docs/plan-m0-m1.md): the first prototype's origin → destination
// routes are gone from the app. What old data and old links still need stays
// where it is read: the `goodroot:travel-routes:v1` migration in
// courseRepository, the v1 `#share=` decoder in routeShareService.
const files = Object.keys(import.meta.glob('../**/*.{ts,tsx}'));

describe('1.7 Cleanup', () => {
  it('legacy TravelRoute UI, data/places.ts and routingService are removed', () => {
    expect(files.length).toBeGreaterThan(100);
    for (const gone of [
      'data/places.ts',
      'types/travelRoute.ts',
      'hooks/useTravelRoutes.ts',
      'services/travelRouteRepository.ts',
      'services/routingService.ts',
    ]) {
      expect(files, gone).not.toContain(`../${gone}`);
    }
  });
});

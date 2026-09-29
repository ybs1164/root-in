import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { PlaceRef, TravelRoute } from '../types/travelRoute';
import { getPopularRoutes } from './recommendationService';
import type { TravelRouteRepository } from './travelRouteRepository';

const route = (origin: PlaceRef, destination: PlaceRef, userId = 'u'): TravelRoute => ({
  id: Math.random().toString(16),
  userId,
  origin,
  destination,
  title: '',
  createdAt: '2026-09-28T00:00:00.000Z',
});

const fakeRepo = (routes: TravelRoute[]): TravelRouteRepository => ({
  listAll: async () => routes,
  listByUser: async (userId) => routes.filter((r) => r.userId === userId),
  add: async () => {
    throw new Error('not used');
  },
  remove: async () => {},
});

const { onionSeongsu: a, seoulForest: b, haeundae: c, gamcheon: d } = samplePlaces;

describe('getPopularRoutes', () => {
  it('ranks origin→destination pairs by how often they were saved', async () => {
    const repo = fakeRepo([route(a, b), route(c, d, 'x'), route(a, b, 'y'), route(a, b, 'z'), route(c, d)]);
    const result = await getPopularRoutes(repo);

    expect(result.map((r) => [r.originId, r.destinationId, r.count])).toEqual([
      [a.id, b.id, 3],
      [c.id, d.id, 2],
    ]);
  });

  it('treats direction as significant', async () => {
    const result = await getPopularRoutes(fakeRepo([route(a, b), route(b, a)]));
    expect(result).toHaveLength(2);
  });

  it('respects the limit', async () => {
    const repo = fakeRepo([route(a, b), route(b, c), route(c, d), route(d, a)]);
    expect(await getPopularRoutes(repo, 2)).toHaveLength(2);
  });

  it('returns nothing for an empty repository', async () => {
    expect(await getPopularRoutes(fakeRepo([]))).toEqual([]);
  });
});

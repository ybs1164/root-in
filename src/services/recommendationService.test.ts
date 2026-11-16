import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { Course, PlaceRef } from '../types/course';
import { getPopularRoutes } from './recommendationService';

const course = (places: PlaceRef[], userId = 'u'): Course => ({
  id: Math.random().toString(16),
  userId,
  title: '',
  theme: 'etc',
  travelMode: 'walk',
  stops: places.map((place) => ({ place })),
  createdAt: '2026-09-28T00:00:00.000Z',
});

const fakeRepo = (courses: Course[]) => ({ listAll: async () => courses });

const { onionSeongsu: a, seoulForest: b, haeundae: c, gamcheon: d } = samplePlaces;

describe('getPopularRoutes', () => {
  it('ranks routes through the same places by how often they were saved', async () => {
    const repo = fakeRepo([course([a, b]), course([c, d], 'x'), course([a, b], 'y'), course([a, b], 'z'), course([c, d])]);
    const result = await getPopularRoutes(repo);

    expect(result.map((r) => [r.placeIds, r.count])).toEqual([
      [[a.id, b.id], 3],
      [[c.id, d.id], 2],
    ]);
    expect(result[0].placeNames).toEqual([a.name, b.name]);
  });

  it('treats the order of the stops as significant', async () => {
    const result = await getPopularRoutes(fakeRepo([course([a, b]), course([b, a])]));
    expect(result).toHaveLength(2);
  });

  it('tells a route apart from a longer one that starts the same way', async () => {
    const result = await getPopularRoutes(fakeRepo([course([a, b]), course([a, b, c])]));
    expect(result.map((r) => r.placeIds.length).sort()).toEqual([2, 3]);
  });

  it('respects the limit', async () => {
    const repo = fakeRepo([course([a, b]), course([b, c]), course([c, d]), course([d, a])]);
    expect(await getPopularRoutes(repo, 2)).toHaveLength(2);
  });

  it('returns nothing for an empty repository', async () => {
    expect(await getPopularRoutes(fakeRepo([]))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { LocalTravelRouteRepository } from './travelRouteRepository';

const STORAGE_KEY = 'goodroot:travel-routes:v1';
const input = { origin: samplePlaces.onionSeongsu, destination: samplePlaces.seoulForest };

describe('LocalTravelRouteRepository', () => {
  it('adds a route with a default title and persists it', async () => {
    const repo = new LocalTravelRouteRepository();
    const route = await repo.add('me', input);

    expect(route.title).toBe('어니언 성수 → 서울숲');
    expect(route.userId).toBe('me');
    expect(await new LocalTravelRouteRepository().listByUser('me')).toEqual([route]);
  });

  it('trims title and note, dropping an empty note', async () => {
    const route = await new LocalTravelRouteRepository().add('me', { ...input, title: '  주말  ', note: '   ' });
    expect(route.title).toBe('주말');
    expect(route.note).toBeUndefined();
  });

  it('separates users in listByUser but not in listAll', async () => {
    const repo = new LocalTravelRouteRepository();
    await repo.add('me', input);
    await repo.add('you', input);

    expect(await repo.listByUser('me')).toHaveLength(1);
    expect(await repo.listAll()).toHaveLength(2);
  });

  it("only removes the caller's own route", async () => {
    const repo = new LocalTravelRouteRepository();
    const mine = await repo.add('me', input);

    await repo.remove(mine.id, 'someone-else');
    expect(await repo.listAll()).toHaveLength(1);

    await repo.remove(mine.id, 'me');
    expect(await repo.listAll()).toHaveLength(0);
  });

  it('treats corrupted storage as empty instead of throwing', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(await new LocalTravelRouteRepository().listAll()).toEqual([]);
  });
});

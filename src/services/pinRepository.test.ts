import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../domain/pin';
import { samplePlaces } from '../test/fixtures';
import type { Pin } from '../types/pin';
import { LocalPinCategoryRepository, LocalPinRepository } from './pinRepository';

const pin = (id: string, userId: string): Pin => ({
  id,
  userId,
  place: samplePlaces.onionSeongsu,
  categoryId: 'cafe',
  createdAt: '2026-09-29T00:00:00.000Z',
});

describe('pin storage', () => {
  it('pins and categories persist in goodroot:pins:v1 / goodroot:pin-categories:v1 with default categories on first run', async () => {
    const categories = new LocalPinCategoryRepository();
    expect(await categories.list()).toEqual(DEFAULT_CATEGORIES);
    expect(JSON.parse(localStorage.getItem('goodroot:pin-categories:v1') ?? '[]')).toHaveLength(DEFAULT_CATEGORIES.length);

    await categories.saveAll(DEFAULT_CATEGORIES.slice(0, 2));
    expect(await categories.list()).toHaveLength(2);
    // An emptied list stays empty (defaults are only for a first run).
    await categories.saveAll([]);
    expect(await categories.list()).toEqual([]);

    const pins = new LocalPinRepository();
    await pins.saveAll('u1', [pin('a', 'u1')]);
    await pins.saveAll('u2', [pin('b', 'u2')]);
    expect((await pins.listByUser('u1')).map((p) => p.id)).toEqual(['a']);
    expect(JSON.parse(localStorage.getItem('goodroot:pins:v1') ?? '[]')).toHaveLength(2);
  });

  it('drops malformed rows instead of failing the list', async () => {
    localStorage.setItem('goodroot:pins:v1', JSON.stringify([pin('ok', 'u1'), { id: 'bad', userId: 'u1' }, null]));
    localStorage.setItem('goodroot:pin-categories:v1', JSON.stringify([DEFAULT_CATEGORIES[0], { id: 'x', name: 'x', icon: 'rocket', color: 1 }]));
    expect((await new LocalPinRepository().listByUser('u1')).map((p) => p.id)).toEqual(['ok']);
    expect((await new LocalPinCategoryRepository().list()).map((c) => c.id)).toEqual(['cafe']);
  });
});

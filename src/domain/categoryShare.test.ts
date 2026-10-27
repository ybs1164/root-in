import { describe, expect, it } from 'vitest';
import type { Pin, PinCategory } from '../types/pin';
import { categorySnapshot, followCategory, subscribeCategory, type CategorySnapshot } from './categoryShare';

const cafe: PinCategory = { id: 'cafe', name: '카페', icon: 'cafe', color: 1, order: 0 };
const pin = (id: string, categoryId: string, extra: Partial<Pin> = {}): Pin => ({
  id: `pin-${id}`,
  userId: 'me',
  categoryId,
  place: { id, name: `장소 ${id}`, center: [127 + Number(id.length) / 100, 37.5] },
  createdAt: `2026-10-0${id.length}T00:00:00.000Z`,
  ...extra,
});

let n = 0;
const makePin = () => ({ id: `new-${(n += 1)}`, userId: 'me', createdAt: '2026-10-23T00:00:00.000Z' });

const snapshot = (ids: string[], look: CategorySnapshot['category'] = { name: '성수 카페', icon: 'cafe', color: 3 }): CategorySnapshot => ({
  category: look,
  places: ids.map((id) => ({ place: { id, name: `장소 ${id}`, center: [127.01, 37.5] as [number, number] } })),
});

describe('categorySnapshot', () => {
  it('carries the category look and its places oldest first, without 제외 주소 places', () => {
    const pins = [pin('bb', 'cafe'), pin('a', 'cafe', { memo: '창가 자리' }), pin('c', 'food')];
    const home = { id: 'home', kind: 'home' as const, address: '집', center: pins[0].place.center };
    const { snapshot: shot, removed } = categorySnapshot(cafe, pins, [home]);
    expect(shot.category).toEqual({ name: '카페', icon: 'cafe', color: 1 });
    expect(shot.places).toEqual([{ place: pins[1].place, memo: '창가 자리' }]);
    expect(removed).toBe(1);
  });
});

describe('subscribeCategory / followCategory', () => {
  const start = { pins: [pin('mine', 'cafe')], categories: [cafe] };

  it('makes a category in the owner look and pins their places into it', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x', 'y']), () => 'sub-cat', makePin);
    if ('problem' in made) throw new Error('not made');
    expect(made.state.categories.find((c) => c.id === 'sub-cat')).toMatchObject({ name: '성수 카페', icon: 'cafe', color: 3 });
    expect(made.state.pins.filter((p) => p.categoryId === 'sub-cat').map((p) => p.place.id)).toEqual(['x', 'y']);
    expect(made.sub).toMatchObject({ slug: 'Slug123456', categoryId: 'sub-cat', owner: '루트인', added: ['x', 'y'] });
  });

  it('adds, updates and takes out only what it put in', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x', 'y']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    // I add a place of my own to the followed category, and move y to my own one.
    const mineInSub = pin('own', 'sub');
    const state = {
      ...made.state,
      pins: [...made.state.pins.map((p) => (p.place.id === 'y' ? { ...p, categoryId: 'cafe' } : p)), mineInSub],
    };
    // The owner renamed x, took out y and added w.
    const next: CategorySnapshot = {
      category: made.sub.look,
      places: [
        { place: { id: 'x', name: '이름 바뀜', center: [127.01, 37.5] }, memo: '새 메모' },
        { place: { id: 'w', name: '새 곳', center: [127.02, 37.5] } },
      ],
    };
    const followed = followCategory(state, made.sub, next, makePin);
    if (followed.gone) throw new Error('gone');
    const inSub = followed.state.pins.filter((p) => p.categoryId === 'sub');
    expect(inSub.map((p) => p.place.id).sort()).toEqual(['own', 'w', 'x']);
    expect(inSub.find((p) => p.place.id === 'x')).toMatchObject({ place: { name: '이름 바뀜' }, memo: '새 메모' });
    // y is mine now (moved out), so it stays where I put it.
    expect(followed.state.pins.find((p) => p.place.id === 'y')?.categoryId).toBe('cafe');
    expect(followed.sub.added.sort()).toEqual(['w', 'x']);
    expect(followed.changed).toBe(true);
  });

  it('takes out a place the owner removed', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x', 'y']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    const followed = followCategory(made.state, made.sub, snapshot(['x']), makePin);
    if (followed.gone) throw new Error('gone');
    expect(followed.state.pins.some((p) => p.place.id === 'y')).toBe(false);
    expect(followed.sub.added).toEqual(['x']);
  });

  it('leaves a place I had pinned already where I filed it', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['mine', 'x']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    expect(made.state.pins.find((p) => p.place.id === 'mine')?.categoryId).toBe('cafe');
    expect(made.sub.added).toEqual(['x']);
  });

  it('follows the owner look only when theirs changes', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    const renamed = { ...made.state, categories: made.state.categories.map((c) => (c.id === 'sub' ? { ...c, name: '내 이름' } : c)) };
    const same = followCategory(renamed, made.sub, snapshot(['x']), makePin);
    if (same.gone) throw new Error('gone');
    expect(same.changed).toBe(false);
    expect(same.state.categories.find((c) => c.id === 'sub')?.name).toBe('내 이름');
    const recoloured = followCategory(renamed, made.sub, snapshot(['x'], { name: '성수 카페', icon: 'cafe', color: 5 }), makePin);
    if (recoloured.gone) throw new Error('gone');
    expect(recoloured.state.categories.find((c) => c.id === 'sub')).toMatchObject({ name: '성수 카페', color: 5 });
  });

  it('ends when I deleted the category', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    const deleted = { ...made.state, categories: made.state.categories.filter((c) => c.id !== 'sub') };
    expect(followCategory(deleted, made.sub, snapshot(['x', 'y']), makePin)).toEqual({ gone: true });
  });

  it('reports no change when nothing moved', () => {
    const made = subscribeCategory(start, 'Slug123456', '루트인', snapshot(['x']), () => 'sub', makePin);
    if ('problem' in made) throw new Error('not made');
    const again = followCategory(made.state, made.sub, snapshot(['x']), makePin);
    if (again.gone) throw new Error('gone');
    expect(again.changed).toBe(false);
    expect(again.sub).toBe(made.sub);
  });

  it('refuses when there are too many categories', () => {
    const full = Array.from({ length: 30 }, (_, i) => ({ ...cafe, id: `c${i}` }));
    expect(subscribeCategory({ pins: [], categories: full }, 'Slug123456', '', snapshot(['x']), () => 'sub', makePin)).toEqual({ problem: 'too-many' });
  });
});

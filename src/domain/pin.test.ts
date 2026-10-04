import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { Pin, PinCategory } from '../types/pin';
import {
  addCategory,
  buildPinSet,
  categoriesWithUncategorized,
  categoryStyle,
  DEFAULT_CATEGORIES,
  filterPins,
  filterPinsByCategories,
  importPinSet,
  moveCategory,
  orderedCategories,
  PIN_LIMITS,
  placeCategory,
  removeCategory,
  UNCATEGORIZED,
  upsertPin,
} from './pin';

const { onionSeongsu, seoulForest, nogariAlley } = samplePlaces;

let seq = 0;
const makeId = () => `id-${(seq += 1)}`;
const makePin = () => ({ id: makeId(), userId: 'u1', createdAt: `2026-09-29T00:00:${String(seq).padStart(2, '0')}.000Z` });

const withDessert = (): PinCategory[] => {
  const result = addCategory(DEFAULT_CATEGORIES, { name: '디저트', icon: 'cafe', color: 5 }, () => 'dessert');
  if ('problem' in result) throw new Error(result.problem);
  return result.categories;
};

const pin = (place: typeof onionSeongsu, categoryId: string, id = makeId()): Pin => ({
  id,
  userId: 'u1',
  place,
  categoryId,
  createdAt: '2026-09-29T00:00:00.000Z',
});

describe('pins', () => {
  it('addPin keeps one pin per place id and updates its category instead of duplicating', () => {
    const first = upsertPin([], { place: onionSeongsu, categoryId: 'cafe' }, makePin);
    if ('problem' in first) throw new Error();
    expect(first.existed).toBe(false);
    const again = upsertPin(first.pins, { place: onionSeongsu, categoryId: 'food' }, makePin);
    if ('problem' in again) throw new Error();
    expect(again.existed).toBe(true);
    expect(again.pins).toHaveLength(1);
    expect(again.pins[0]).toMatchObject({ id: first.pin.id, categoryId: 'food' });
  });

  it('refuses a new pin past the limit, but still re-files an existing one', () => {
    const full = Array.from({ length: PIN_LIMITS.maxPins }, (_, i) =>
      pin({ id: `p${i}`, name: `p${i}`, center: [127, 37.5] }, 'cafe', `pin-${i}`),
    );
    expect(upsertPin(full, { place: onionSeongsu, categoryId: 'cafe' }, makePin)).toEqual({ problem: 'too-many' });
    expect('pins' in upsertPin(full, { place: full[0].place, categoryId: 'food' }, makePin)).toBe(true);
  });

  it('a new category goes last, with its own icon and colour; a blank name or a full list is refused', () => {
    const categories = withDessert();
    expect(categoryStyle(categories, 'dessert')).toEqual({ icon: 'cafe', color: 5 });
    expect(orderedCategories(categories).map((c) => c.id).at(-1)).toBe('dessert');
    expect(addCategory(categories, { name: '  ' }, makeId)).toEqual({ problem: 'empty-name' });
    const full = Array.from({ length: PIN_LIMITS.maxCategories }, (_, i) => ({ ...DEFAULT_CATEGORIES[0], id: `c${i}`, order: i }));
    expect(addCategory(full, { name: '하나 더' }, makeId)).toEqual({ problem: 'too-many' });
  });

  it('deleting a category moves its pins to 미분류 instead of deleting them', () => {
    const categories = withDessert();
    const pins = [pin(onionSeongsu, 'dessert'), pin(seoulForest, 'cafe'), pin(nogariAlley, 'bar')];

    const removed = removeCategory(categories, pins, 'cafe');
    expect(removed.categories.map((c) => c.id)).not.toContain('cafe');
    // Only that category's pins move; the others (dessert included) stay put.
    expect(removed.pins.map((p) => p.categoryId)).toEqual(['dessert', UNCATEGORIZED.id, 'bar']);
    expect(removed.pins).toHaveLength(3);
  });

  it('moves a category one step up or down', () => {
    const moved = moveCategory(DEFAULT_CATEGORIES, 'food', -1);
    expect(orderedCategories(moved).map((c) => c.id).slice(0, 2)).toEqual(['food', 'cafe']);
    expect(moveCategory(DEFAULT_CATEGORIES, 'cafe', -1)).toBe(DEFAULT_CATEGORIES);
  });

  it('places a dragged category at any spot in the order', () => {
    const ids = (cats: typeof DEFAULT_CATEGORIES) => orderedCategories(cats).map((c) => c.id);
    expect(ids(placeCategory(DEFAULT_CATEGORIES, 'cafe', 3))).toEqual(['food', 'bar', 'photo', 'cafe', 'shop', 'togo']);
    expect(ids(placeCategory(DEFAULT_CATEGORIES, 'togo', 0))).toEqual(['togo', 'cafe', 'food', 'bar', 'photo', 'shop']);
    // Past the end clamps; the same spot changes nothing.
    expect(ids(placeCategory(DEFAULT_CATEGORIES, 'food', 99)).at(-1)).toBe('food');
    expect(placeCategory(DEFAULT_CATEGORIES, 'bar', 2)).toBe(DEFAULT_CATEGORIES);
  });

  it('filters by one category', () => {
    const categories = withDessert();
    const pins = [pin(onionSeongsu, 'dessert'), pin(seoulForest, 'cafe'), pin(nogariAlley, 'bar')];
    expect(filterPins(pins, categories, 'cafe').map((p) => p.place.name)).toEqual(['서울숲']);
    expect(filterPins(pins, categories, 'dessert')).toHaveLength(1);
    expect(filterPins(pins, categories, null)).toHaveLength(3);
  });

  it('filters by several picked categories at once; none picked shows all', () => {
    const categories = withDessert();
    const pins = [pin(onionSeongsu, 'dessert'), pin(seoulForest, 'cafe'), pin(nogariAlley, 'bar')];
    expect(filterPinsByCategories(pins, categories, new Set(['cafe', 'bar']))).toHaveLength(2);
    expect(filterPinsByCategories(pins, categories, new Set(['dessert', 'bar'])).map((p) => p.place.name).sort()).toEqual(['어니언 성수', '을지로 노가리골목']);
    expect(filterPinsByCategories(pins, categories, new Set())).toHaveLength(3);
    // Picked but since deleted: as good as none picked (ALL), not an empty map.
    expect(filterPinsByCategories(pins, categories, new Set(['gone']))).toHaveLength(3);
  });

  it('미분류 is the plain pin in the accent, first in every list, and filters to pins with no live category', () => {
    const categories = withDessert();
    expect(categoryStyle(categories, UNCATEGORIZED.id)).toEqual({ icon: 'pin', color: 0 });
    expect(categoryStyle(categories, 'gone')).toEqual({ icon: 'pin', color: 0 });
    expect(categoriesWithUncategorized(categories)[0].id).toBe(UNCATEGORIZED.id);
    const pins = [pin(onionSeongsu, UNCATEGORIZED.id), pin(seoulForest, 'gone'), pin(nogariAlley, 'bar')];
    expect(filterPinsByCategories(pins, categories, new Set([UNCATEGORIZED.id])).map((p) => p.place.name).sort()).toEqual(['서울숲', '어니언 성수']);
    expect(filterPinsByCategories(pins, categories, new Set([UNCATEGORIZED.id, 'bar']))).toHaveLength(3);
  });

  it('a pin set carries only the used categories, in order', () => {
    const categories = withDessert();
    const { set, dropped } = buildPinSet('성수', [pin(onionSeongsu, 'dessert'), pin(nogariAlley, 'bar')], categories, '지우');
    expect(dropped).toBe(0);
    expect(set.categories.map((c) => c.name)).toEqual(['술집', '디저트']);
    expect(set.pins.map((p) => set.categories[p.category].name)).toEqual(['디저트', '술집']);
    expect(set.sharedBy).toBe('지우');
  });

  it('importing a set merges categories by name and creates the missing ones', () => {
    const mine = DEFAULT_CATEGORIES;
    const { set } = buildPinSet('x', [pin(onionSeongsu, 'dessert'), pin(seoulForest, 'cafe')], withDessert());
    const existing = [pin(seoulForest, 'food')];
    const result = importPinSet(mine, existing, set, makeId, makePin);
    const dessert = result.categories.find((c) => c.name === '디저트');
    expect(dessert).toMatchObject({ icon: 'cafe', color: 5 });
    expect(result.categories.filter((c) => c.name === '카페')).toHaveLength(1);
    expect(result.added).toBe(1);
    // An already-pinned place is re-filed, not duplicated.
    expect(result.pins).toHaveLength(2);
    expect(result.pins.find((p) => p.place.id === seoulForest.id)?.categoryId).toBe('cafe');
    expect(result.pins.find((p) => p.place.id === onionSeongsu.id)?.categoryId).toBe(dessert?.id);
  });
});

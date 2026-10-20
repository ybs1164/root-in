import { describe, expect, it } from 'vitest';
import nameCases from '../../scripts/place-kinds/name-cases.json?raw';
import { matchKind, namesMatch, normalizePlaceName, type KindShop } from './placeMatch';

describe('normalizePlaceName', () => {
  it('agrees with build_places.py on every shared case', () => {
    for (const c of JSON.parse(nameCases) as { name: string; branch: string; expect: string }[]) {
      expect(normalizePlaceName(c.name, c.branch), c.name).toBe(c.expect);
    }
  });
});

describe('namesMatch', () => {
  it('matches equal, contained and mostly-equal names', () => {
    expect(namesMatch('스타벅스', '스타벅스')).toBe(true);
    expect(namesMatch('어니언', '어니언성수')).toBe(true);
    expect(namesMatch('파리바게뜨', '파리바게트')).toBe(true);
  });

  it('does not match different shops or one letter', () => {
    expect(namesMatch('스타벅스', '이디야커피')).toBe(false);
    expect(namesMatch('카', '카페어니언')).toBe(false);
    expect(namesMatch('', '어니언')).toBe(false);
  });
});

describe('matchKind', () => {
  // Around 어니언 성수 (127.0582, 37.5447); 1e-5° of latitude ≈ 1.1m.
  const at = (name: string, dx: number, dy: number, kind: KindShop['kind']): KindShop => ({ name, x: 12705820 + dx, y: 3754470 + dy, kind });
  const center: [number, number] = [127.0582, 37.5447];

  it('takes the nearest shop with a matching name within 40m', () => {
    const shops = [at('어니언', 0, 30, 'bakery'), at('미용실', 0, 2, 'salon'), at('어니언', 0, 3000, 'cafe')];
    expect(matchKind(shops, center, '어니언 성수점', false)).toBe('bakery');
  });

  it('ignores a matching name too far away', () => {
    expect(matchKind([at('어니언', 0, 60, 'bakery')], center, '어니언', false)).toBeNull();
  });

  it('a named search result never goes by distance alone', () => {
    expect(matchKind([at('미용실', 0, 2, 'salon')], center, '어니언', false)).toBeNull();
  });

  it('a picked spot takes the one kind of every shop within 15m', () => {
    expect(matchKind([at('가', 0, 5, 'cafe'), at('나', 5, 0, 'cafe'), at('다', 0, 30, 'salon')], center, null, true)).toBe('cafe');
    expect(matchKind([at('가', 0, 5, 'cafe'), at('나', 5, 0, 'salon')], center, null, true)).toBeNull();
    expect(matchKind([at('가', 0, 30, 'cafe')], center, null, true)).toBeNull();
  });
});

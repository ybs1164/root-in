import { describe, expect, it } from 'vitest';
import { hasHome, isExcluded, withHome, withoutExcluded, type ExcludedPlace } from './privacy';

const home: ExcludedPlace = { id: 'home', kind: 'home', address: '서울 성동구 성수이로 88', center: [127.0557, 37.5431] };

describe('제외 주소', () => {
  it('always starts with a 집 row, which must be filled in before sharing', () => {
    expect(withHome([]).map((p) => p.kind)).toEqual(['home']);
    expect(hasHome(withHome([]))).toBe(false);
    expect(hasHome([{ ...home, address: '  ' }])).toBe(false);
    expect(hasHome([home])).toBe(true);
    const other: ExcludedPlace = { id: 'x', kind: 'other', address: '회사' };
    expect(withHome([other, home]).map((p) => p.id)).toEqual(['home', 'x']);
  });

  it('drops places near an excluded address, or with the same written address', () => {
    // ~30 m away: same place.
    expect(isExcluded({ center: [127.0559, 37.5433] }, [home])).toBe(true);
    // ~1.7 km away (서울숲): kept.
    expect(isExcluded({ center: [127.0374, 37.5444] }, [home])).toBe(false);
    // No location found for the address: the written address still matches…
    const typed: ExcludedPlace = { id: 'home', kind: 'home', address: '성수이로 88' };
    expect(isExcluded({ center: [0, 0], address: '서울 성동구 성수이로 88' }, [typed])).toBe(true);
    // …but a bare road doesn't swallow a numbered address on it, or the reverse.
    expect(isExcluded({ center: [0, 0], address: '서울 성동구 성수이로' }, [typed])).toBe(false);
    const road: ExcludedPlace = { id: 'x', kind: 'other', address: '청계천로' };
    expect(isExcluded({ center: [0, 0], address: '서울 중구 청계천로 100' }, [road])).toBe(false);
    // An empty row excludes nothing.
    expect(isExcluded({ center: [127.0557, 37.5431] }, [{ id: 'home', kind: 'home', address: '', center: [127.0557, 37.5431] }])).toBe(false);
  });

  it('filters a list and counts what went', () => {
    const items = [{ center: [127.0557, 37.5431] as [number, number] }, { center: [127.0374, 37.5444] as [number, number] }];
    const { kept, removed } = withoutExcluded(items, (i) => i, [home]);
    expect(removed).toBe(1);
    expect(kept).toEqual([items[1]]);
  });
});

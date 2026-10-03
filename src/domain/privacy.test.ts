import { describe, expect, it } from 'vitest';
import { addressesMatch, homeIsSet, isExcluded, withoutExcluded, type ExcludedPlace } from './privacy';

const home: ExcludedPlace = { id: 'home', label: '집', address: '서울 성동구 아차산로9길 8', center: [127.0582, 37.5447] };

describe('제외 주소', () => {
  it('matches addresses across spacing, city long forms and extra region in front', () => {
    expect(addressesMatch('서울특별시 성동구 아차산로9길 8', '서울 성동구 아차산로9길 8')).toBe(true);
    expect(addressesMatch('성동구 아차산로9길8', '서울 성동구 아차산로9길 8')).toBe(true);
  });

  it('does not let a short or number-less address swallow others', () => {
    expect(addressesMatch('아차산로9길 8', '서울 성동구 아차산로9길 88')).toBe(false);
    expect(addressesMatch('서울 성동구', '서울 성동구 아차산로9길 8')).toBe(false);
    expect(addressesMatch('', '서울 성동구 아차산로9길 8')).toBe(false);
  });

  it('excludes by position within the radius, or by address', () => {
    expect(isExcluded({ center: [127.0585, 37.5448] }, [home])).toBe(true); // ~30 m away, no address
    expect(isExcluded({ center: [127.0374, 37.5444] }, [home])).toBe(false); // 서울숲, ~1.8 km
    expect(isExcluded({ address: '서울 성동구 아차산로9길 8', center: [0, 0] }, [{ ...home, center: undefined }])).toBe(true);
  });

  it('removes excluded items and counts them', () => {
    const stops = [{ c: [127.0582, 37.5447] as [number, number] }, { c: [127.0374, 37.5444] as [number, number] }];
    expect(withoutExcluded(stops, (s) => ({ center: s.c }), [home])).toEqual({ kept: [stops[1]], removed: 1 });
  });

  it('needs a home address before anything is shared', () => {
    expect(homeIsSet([{ id: 'home', label: '집', address: '  ' }])).toBe(false);
    expect(homeIsSet([home])).toBe(true);
  });
});

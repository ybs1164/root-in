import { describe, expect, it } from 'vitest';
import { addressRoute, romanize } from './addressRoute';

describe('romanize', () => {
  it.each([
    ['서울', 'seoul'],
    ['성수', 'seongsu'],
    ['성동', 'seongdong'],
    ['강남', 'gangnam'],
    ['종로', 'jongno'],
    ['신림', 'sillim'],
    ['왕십리', 'wangsimni'],
    ['독립문', 'dongnimmun'],
    ['한남', 'hannam'],
    ['을지로', 'euljiro'],
    ['부산', 'busan'],
    ['칼날', 'kallal'],
  ])('%s → %s', (hangul, roman) => {
    expect(romanize(hangul)).toBe(roman);
  });
});

describe('addressRoute', () => {
  it('takes the city and the 동 of a lot-number address', () => {
    expect(addressRoute('서울 성동구 성수동1가 685-20')).toEqual({ from: 'Seoul', to: 'Seongsu' });
    expect(addressRoute('서울특별시 중구 신당5동 12')).toEqual({ from: 'Seoul', to: 'Sindang' });
  });

  it('falls back to the 구 for a road address (no 동 in it)', () => {
    expect(addressRoute('서울 성동구 아차산로9길 8')).toEqual({ from: 'Seoul', to: 'Seongdong' });
  });

  it('shortens a province and picks the most specific district', () => {
    expect(addressRoute('경기도 성남시 분당구 판교역로 1')).toEqual({ from: 'Gyeonggi', to: 'Bundang' });
  });

  it('reads an already romanized address', () => {
    expect(addressRoute('Seoul Seongdong-gu Achasan-ro 9-gil')).toEqual({ from: 'Seoul', to: 'Seongdong' });
  });

  it('gives the city alone, or nothing, when that is all there is', () => {
    expect(addressRoute('부산')).toEqual({ from: 'Busan' });
    expect(addressRoute('')).toBeNull();
    expect(addressRoute(undefined)).toBeNull();
  });
});

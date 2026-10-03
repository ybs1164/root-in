import { beforeEach, describe, expect, it } from 'vitest';
import { loadPrivacy, savePrivacy } from './privacyRepository';

describe('privacyRepository', () => {
  beforeEach(() => window.localStorage.clear());

  it('always starts with an empty home entry', () => {
    expect(loadPrivacy().excluded).toEqual([{ id: 'home', label: '집', address: '' }]);
  });

  it('round-trips places, home kept first', () => {
    const work = { id: 'w', label: '회사', address: '서울 중구 을지로 1', center: [126.98, 37.56] as [number, number] };
    savePrivacy({ excluded: [work, { id: 'home', label: '집', address: '서울 성동구 아차산로9길 8' }] });
    expect(loadPrivacy().excluded.map((p) => p.id)).toEqual(['home', 'w']);
    expect(loadPrivacy().excluded[1]).toEqual(work);
  });

  it('drops malformed entries and positions outside Korea', () => {
    window.localStorage.setItem(
      'goodroot:privacy:v1',
      JSON.stringify({ excluded: [{ id: 'x', label: 'a', address: '어딘가', center: [0, 0] }, 'junk', { id: 1 }] }),
    );
    expect(loadPrivacy().excluded).toEqual([
      { id: 'home', label: '집', address: '' },
      { id: 'x', label: 'a', address: '어딘가' },
    ]);
  });
});

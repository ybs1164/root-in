import { describe, expect, it } from 'vitest';
import { loadPrivacy, savePrivacy } from './privacyRepository';

describe('privacy storage', () => {
  it('starts with an empty 집 and round-trips through goodroot:privacy:v1', () => {
    expect(loadPrivacy().excluded).toEqual([{ id: 'home', kind: 'home', address: '' }]);
    const excluded = [
      { id: 'home', kind: 'home' as const, address: '성수이로 88', center: [127.0557, 37.5431] as [number, number] },
      { id: 'w', kind: 'other' as const, address: '회사' },
    ];
    expect(savePrivacy({ excluded })).toBe(true);
    expect(loadPrivacy().excluded).toEqual(excluded);
  });

  it('drops bad rows, foreign coordinates and extra 집s; clamps the text', () => {
    localStorage.setItem(
      'goodroot:privacy:v1',
      JSON.stringify({
        excluded: [
          { id: 'w', kind: 'other', address: 'x'.repeat(200), center: [139.69, 35.68] },
          { id: 'home', kind: 'home', address: '집' },
          { id: 'home2', kind: 'home', address: '또 집' },
          { id: 'bad', kind: 'office', address: '?' },
          null,
        ],
      }),
    );
    const { excluded } = loadPrivacy();
    expect(excluded.map((p) => p.id)).toEqual(['home', 'w']);
    expect(excluded[1].address).toHaveLength(80);
    expect(excluded[1].center).toBeUndefined();
  });
});

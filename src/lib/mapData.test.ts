import { describe, expect, it } from 'vitest';
import { mapDataRoot } from './mapData';

describe('mapDataRoot', () => {
  it('reads the files shipped with the app when no hosted copy is set', () => {
    expect(mapDataRoot(undefined, '/')).toBe('/korea/');
    expect(mapDataRoot('  ', './')).toBe('./korea/');
  });

  it('uses the hosted package, always ending in one slash', () => {
    expect(mapDataRoot('https://map.example.com/korea-20261022', '/')).toBe('https://map.example.com/korea-20261022/');
    expect(mapDataRoot('https://map.example.com/korea-20261022/', '/')).toBe('https://map.example.com/korea-20261022/');
  });
});

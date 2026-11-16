import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { defaultTitle } from './course';

const { onionSeongsu, seongsuGalbi, seoulForest } = samplePlaces;
const three = [{ place: onionSeongsu }, { place: seongsuGalbi }, { place: seoulForest }];

describe('course domain', () => {
  it('defaultTitle is "첫 → 마지막" for 2 stops, "첫 외 N곳" for 3+', () => {
    expect(defaultTitle(three.slice(0, 2))).toBe('어니언 성수 → 성수 갈비집');
    expect(defaultTitle(three)).toBe('어니언 성수 외 2곳');
    expect(defaultTitle([])).toBe('새 코스');
  });
});

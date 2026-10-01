import { describe, expect, it } from 'vitest';
import { COURSE_LIMITS } from './course';
import { nextRouteName, toggleBuildStop } from './routeBuild';

describe('building a route from pins', () => {
  it('adds pins in the order tapped; a second tap takes one out', () => {
    let chosen = toggleBuildStop([], 'a');
    chosen = toggleBuildStop(chosen, 'b');
    chosen = toggleBuildStop(chosen, 'c');
    expect(chosen).toEqual(['a', 'b', 'c']);
    expect(toggleBuildStop(chosen, 'b')).toEqual(['a', 'c']);
  });

  it('stops adding at the course limit', () => {
    const full = Array.from({ length: COURSE_LIMITS.maxStops }, (_, i) => `p${i}`);
    expect(toggleBuildStop(full, 'more')).toEqual(full);
    expect(toggleBuildStop(full, 'p0')).toHaveLength(COURSE_LIMITS.maxStops - 1);
  });

  it("names new routes '나만의 루트', then 2, 3, … when taken", () => {
    expect(nextRouteName([])).toBe('나만의 루트');
    expect(nextRouteName(['나만의 루트'])).toBe('나만의 루트2');
    expect(nextRouteName(['나만의 루트', '나만의 루트2', '산책'])).toBe('나만의 루트3');
    expect(nextRouteName(['나만의 루트2'])).toBe('나만의 루트');
  });
});

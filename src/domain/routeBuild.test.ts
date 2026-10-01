import { describe, expect, it } from 'vitest';
import { COURSE_LIMITS } from './course';
import { buildRouteTitle, toggleBuildStop } from './routeBuild';

const place = (name: string) => ({ id: name, name, center: [127, 37.5] as [number, number] });

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

  it('titles the route by its first and last place', () => {
    expect(buildRouteTitle([place('어니언'), place('서울숲'), place('갈비집')])).toBe('어니언 → 갈비집');
    expect(buildRouteTitle([place('어니언')])).toBe('어니언');
  });
});

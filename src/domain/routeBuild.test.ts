import { describe, expect, it } from 'vitest';
import { COURSE_LIMITS } from './course';
import { buildRouteLook, EMPTY_BUILD_LOOK, nextRouteName, toggleBuildStop, withBuildEdge, withBuildShape } from './routeBuild';

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

  it("names new routes 'IN MY ROOT', then 2, 3, … when taken", () => {
    expect(nextRouteName([])).toBe('IN MY ROOT');
    expect(nextRouteName(['IN MY ROOT'])).toBe('IN MY ROOT 2');
    expect(nextRouteName(['IN MY ROOT', 'IN MY ROOT 2', '산책'])).toBe('IN MY ROOT 3');
    expect(nextRouteName(['IN MY ROOT 2'])).toBe('IN MY ROOT');
  });

  it('shapes and line styles picked while making a route stay with their pins', () => {
    let look = withBuildShape(EMPTY_BUILD_LOOK, ['a', 'b', 'c'], 1, 'heart');
    look = withBuildEdge(look, ['a', 'b', 'c'], 0, 'dotted');
    expect(buildRouteLook(['a', 'b', 'c'], look)).toEqual({ stopShapes: [null, 'heart', null], edgeStyles: ['dotted', null] });
    // a taken out and put back at the end: b keeps its heart, a–b's line is gone, b–a later still joins them.
    expect(buildRouteLook(['b', 'c', 'a'], look)).toEqual({ stopShapes: ['heart', null, null], edgeStyles: undefined });
    expect(buildRouteLook(['c', 'b', 'a'], look)).toEqual({ stopShapes: [null, 'heart', null], edgeStyles: [null, 'dotted'] });
    // Back to the number / a solid line: nothing left to keep.
    expect(buildRouteLook(['a', 'b'], withBuildEdge(withBuildShape(look, ['a', 'b'], 1, null), ['a', 'b'], 0, 'solid'))).toEqual({ stopShapes: undefined, edgeStyles: undefined });
  });
});

import { describe, expect, it } from 'vitest';
import { COURSE_LIMITS } from './course';
import { addEditStop, moveStop, remapRouteLook, toggleEditStop } from './routeEdit';
import type { CourseStop, PlaceRef } from '../types/course';

const place = (id: string): PlaceRef => ({ id, name: id, center: [127, 37.5] });
const stops = (...ids: string[]): CourseStop[] => ids.map((id) => ({ place: place(id) }));
const ids = (s: CourseStop[]) => s.map((x) => x.place.id);

describe('editing a saved route', () => {
  it('a tapped pin joins at the end, or leaves if it is already a stop', () => {
    expect(ids(toggleEditStop(stops('a', 'b'), place('c')))).toEqual(['a', 'b', 'c']);
    expect(ids(toggleEditStop(stops('a', 'b', 'c'), place('b')))).toEqual(['a', 'c']);
    const full = stops(...Array.from({ length: COURSE_LIMITS.maxStops }, (_, i) => `p${i}`));
    expect(toggleEditStop(full, place('x'))).toHaveLength(COURSE_LIMITS.maxStops);
  });

  it('a pin swept over only ever joins', () => {
    expect(ids(addEditStop(stops('a'), place('b')))).toEqual(['a', 'b']);
    expect(ids(addEditStop(stops('a', 'b'), place('a')))).toEqual(['a', 'b']);
  });

  it('keeps the other stops in order around a moved one', () => {
    expect(moveStop(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveStop(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveStop(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveStop(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('stops keep their shapes, lines their styles while they join the same two places', () => {
    const before = stops('a', 'b', 'c');
    const look = { stopShapes: ['heart', null, 'star'] as const, edgeStyles: ['dashed', 'dotted'] as const };
    // c, b, a, d: c–b is b–c reversed (dotted), b–a is a–b reversed (dashed), a–d is new.
    expect(remapRouteLook(before, { stopShapes: [...look.stopShapes], edgeStyles: [...look.edgeStyles] }, stops('c', 'b', 'a', 'd'))).toEqual({
      stopShapes: ['star', null, 'heart', null],
      edgeStyles: ['dotted', 'dashed', null],
    });
    // a, c: a line that wasn't there before starts plain; nothing left to store.
    expect(remapRouteLook(before, { edgeStyles: ['dashed', 'dotted'] }, stops('a', 'c'))).toEqual({ stopShapes: undefined, edgeStyles: undefined });
  });
});

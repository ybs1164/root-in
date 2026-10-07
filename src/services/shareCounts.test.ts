import { describe, expect, it } from 'vitest';
import { localCourses } from './courseRepository';
import { applyShareCounts } from './shareCounts';
import { onLocalWrote, onPulled } from './syncBus';
import type { Course } from '../types/course';

const route = (id: string, shareCount?: number): Course => ({
  id,
  userId: 'device',
  title: id,
  theme: 'etc',
  travelMode: 'walk',
  stops: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  ...(shareCount ? { shareCount } : {}),
});

describe('applyShareCounts', () => {
  it("puts the server's counts on the routes, tells the screens, and sends nothing back", () => {
    localCourses.write([route('a'), route('b', 4), route('c', 2)]);
    const wrote: string[] = [];
    const pulled: string[][] = [];
    const stopWrote = onLocalWrote((c) => wrote.push(c));
    const stopPulled = onPulled((c) => pulled.push([...c]));
    expect(applyShareCounts(new Map([['a', 3], ['c', 2]]))).toBe(true);
    expect(localCourses.read().map((c) => c.shareCount)).toEqual([3, undefined, 2]);
    expect(wrote).toEqual([]);
    expect(pulled).toEqual([['routes']]);
    expect(applyShareCounts(new Map([['a', 3], ['c', 2]]))).toBe(false);
    stopWrote();
    stopPulled();
  });
});

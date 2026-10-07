import { localCourses } from './courseRepository';
import { pulledFromServer, withoutEcho } from './syncBus';

/**
 * Puts the server's share counts (Course.shareCount, shown as `N Shares` on a
 * route row) on this device's routes. The count is the server's: it isn't part
 * of a synced route row, so writing it here sends nothing back. True if any changed.
 */
export function applyShareCounts(totals: ReadonlyMap<string, number>): boolean {
  const courses = localCourses.read();
  let changed = false;
  const next = courses.map((course) => {
    const total = totals.get(course.id) ?? 0;
    const count = total >= 1 ? total : undefined;
    if (count === course.shareCount) return course;
    changed = true;
    const { shareCount: _old, ...rest } = course;
    return count ? { ...rest, shareCount: count } : rest;
  });
  if (!changed) return false;
  withoutEcho(() => localCourses.write(next));
  pulledFromServer(new Set(['routes']));
  return true;
}

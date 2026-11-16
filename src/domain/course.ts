import type { CourseStop, CourseTheme, TravelMode } from '../types/course';

export const COURSE_LIMITS = {
  minStops: 2,
  maxStops: 10,
  title: 80,
  memo: 120,
  note: 280,
} as const;

export const COURSE_THEMES: CourseTheme[] = ['date', 'trip', 'food', 'etc'];

export const TRAVEL_MODES: TravelMode[] = ['walk', 'transit', 'drive'];

export function defaultTitle(stops: CourseStop[]): string {
  if (stops.length === 0) return '새 코스';
  const first = stops[0].place.name;
  if (stops.length === 1) return first;
  if (stops.length === 2) return `${first} → ${stops[1].place.name}`;
  return `${first} 외 ${stops.length - 1}곳`;
}

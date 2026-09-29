import type { CourseDraft, CourseStop, CourseTheme, PlaceRef, TravelMode } from '../types/course';

export const COURSE_LIMITS = {
  minStops: 2,
  maxStops: 10,
  title: 80,
  memo: 120,
  note: 280,
} as const;

export const COURSE_THEMES: CourseTheme[] = ['date', 'trip', 'food', 'etc'];
export const TRAVEL_MODES: TravelMode[] = ['walk', 'transit', 'drive'];

export const emptyDraft = (): CourseDraft => ({ title: '', theme: 'date', travelMode: 'walk', stops: [] });

export type CourseProblem = 'too-few-stops' | 'too-many-stops';

export const COURSE_PROBLEM_MESSAGES: Record<CourseProblem, string> = {
  'too-few-stops': `장소를 ${COURSE_LIMITS.minStops}곳 이상 추가하세요.`,
  'too-many-stops': `장소는 최대 ${COURSE_LIMITS.maxStops}곳까지 넣을 수 있어요.`,
};

export function validateCourse(draft: Pick<CourseDraft, 'stops'>): CourseProblem[] {
  const problems: CourseProblem[] = [];
  if (draft.stops.length < COURSE_LIMITS.minStops) problems.push('too-few-stops');
  if (draft.stops.length > COURSE_LIMITS.maxStops) problems.push('too-many-stops');
  return problems;
}

/** Returns the same array when the stop can't be added (full). */
export function addStop(stops: CourseStop[], place: PlaceRef): CourseStop[] {
  if (stops.length >= COURSE_LIMITS.maxStops) return stops;
  return [...stops, { place }];
}

export function moveStop<T extends CourseStop>(stops: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= stops.length || to >= stops.length) return stops;
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function removeStop<T extends CourseStop>(stops: T[], index: number): T[] {
  return stops.filter((_, i) => i !== index);
}

export function setStopMemo<T extends CourseStop>(stops: T[], index: number, memo: string): (T & CourseStop)[] {
  return stops.map((stop, i) => (i === index ? { ...stop, memo: memo.slice(0, COURSE_LIMITS.memo) || undefined } : stop));
}

export function defaultTitle(stops: CourseStop[]): string {
  if (stops.length === 0) return '새 코스';
  const first = stops[0].place.name;
  if (stops.length === 1) return first;
  if (stops.length === 2) return `${first} → ${stops[1].place.name}`;
  return `${first} 외 ${stops.length - 1}곳`;
}

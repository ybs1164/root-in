import type { PlaceRef } from '../types/course';
import type { DiaryDraft, DiaryEntry, DiaryMood, DiarySnapshot, DiaryStop } from '../types/diary';
import { COURSE_LIMITS } from './course';

export const DIARY_LIMITS = {
  // A whole day can hold more places than a planned course.
  maxStops: 15,
  title: 80,
  memo: COURSE_LIMITS.memo,
  text: 1000,
} as const;

export const DIARY_MOODS: DiaryMood[] = ['great', 'good', 'soso', 'tired'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day — not UTC, or late-night entries land on the wrong date. */
export const dateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const timeKey = (date: Date = new Date()): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const isDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const isTimeKey = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-09-28' → '9월 28일 (월)'; the year is added when it isn't this year. */
export function formatDiaryDate(key: string, now: Date = new Date()): string {
  if (!isDateKey(key)) return key;
  const [y, m, d] = key.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const base = `${m}월 ${d}일 (${weekday})`;
  return y === now.getFullYear() ? base : `${y}년 ${base}`;
}

export const emptyDiaryDraft = (date: string = dateKey()): DiaryDraft => ({
  date,
  title: '',
  travelMode: 'walk',
  stops: [],
});

export function defaultDiaryTitle(draft: Pick<DiaryDraft, 'date'>): string {
  return `${formatDiaryDate(draft.date)}의 기록`;
}

/** 'date · title', without repeating the date when the title already starts with it. */
export function diaryHeading(diary: { date: string; title: string }): string {
  const date = formatDiaryDate(diary.date);
  return diary.title.startsWith(date) ? diary.title : `${date} · ${diary.title}`;
}

/** Returns the same array when the day is already full. */
export function addDiaryStop(stops: DiaryStop[], place: PlaceRef, time?: string): DiaryStop[] {
  if (stops.length >= DIARY_LIMITS.maxStops) return stops;
  return [...stops, isTimeKey(time) ? { place, time } : { place }];
}

export function setStopTime(stops: DiaryStop[], index: number, time: string): DiaryStop[] {
  return stops.map((stop, i) => {
    if (i !== index) return stop;
    const { time: _drop, ...rest } = stop;
    return isTimeKey(time) ? { ...rest, time } : rest;
  });
}

/**
 * Orders stops by their noted time; stops without a time keep their place
 * relative to the timed stops before them (stable), so a partially timed day
 * isn't scrambled.
 */
export function sortStopsByTime(stops: DiaryStop[]): DiaryStop[] {
  let lastTime = '';
  const keyed = stops.map((stop, index) => {
    if (stop.time) lastTime = stop.time;
    return { stop, index, key: stop.time ?? lastTime };
  });
  return keyed
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index)
    .map(({ stop }) => stop);
}

export type DiaryProblem = 'no-stops' | 'bad-date';

export const DIARY_PROBLEM_MESSAGES: Record<DiaryProblem, string> = {
  'no-stops': '다녀온 장소를 1곳 이상 추가하세요.',
  'bad-date': '날짜를 확인해 주세요.',
};

export function validateDiary(draft: Pick<DiaryDraft, 'stops' | 'date'>): DiaryProblem[] {
  const problems: DiaryProblem[] = [];
  if (!isDateKey(draft.date)) problems.push('bad-date');
  if (draft.stops.length === 0) problems.push('no-stops');
  return problems;
}

export function toDiaryDraft(entry: DiaryEntry): DiaryDraft {
  const { id, date, title, mood, travelMode, stops, text } = entry;
  return { id, date, title, mood, travelMode, stops, text };
}

export function diarySnapshot(source: DiarySnapshot): DiarySnapshot {
  const { date, title, mood, travelMode, stops, text, sharedBy } = source;
  return { date, title, mood, travelMode, stops, text, sharedBy };
}

/** Newest day first; within a day, most recently written first. */
export function sortDiaries<T extends { date: string; createdAt?: string; updatedAt?: string; addedAt?: string }>(
  list: T[],
): T[] {
  const stamp = (e: T) => e.updatedAt ?? e.createdAt ?? e.addedAt ?? '';
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || stamp(b).localeCompare(stamp(a)));
}

import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { DiaryStop } from '../types/diary';
import {
  addDiaryStop,
  dateKey,
  DIARY_LIMITS,
  formatDiaryDate,
  isDateKey,
  isTimeKey,
  setStopTime,
  sortDiaries,
  sortStopsByTime,
  validateDiary,
} from './diary';

const { onionSeongsu, seongsuGalbi, seoulForest } = samplePlaces;

describe('diary domain', () => {
  it('dateKey uses the local calendar day', () => {
    expect(dateKey(new Date(2026, 8, 28, 23, 50))).toBe('2026-09-28');
  });

  it('validates date and time keys', () => {
    expect(isDateKey('2026-09-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('28/09/2026')).toBe(false);
    expect(isTimeKey('09:05')).toBe(true);
    expect(isTimeKey('24:00')).toBe(false);
    expect(isTimeKey('9:5')).toBe(false);
  });

  it('formats dates in Korean, adding the year only for other years', () => {
    const now = new Date(2026, 8, 28);
    expect(formatDiaryDate('2026-09-28', now)).toBe('9월 28일 (월)');
    expect(formatDiaryDate('2025-12-31', now)).toBe('2025년 12월 31일 (수)');
  });

  it('addDiaryStop keeps valid times and stops at the limit', () => {
    expect(addDiaryStop([], onionSeongsu, '10:30')).toEqual([{ place: onionSeongsu, time: '10:30' }]);
    expect(addDiaryStop([], onionSeongsu, 'soon')).toEqual([{ place: onionSeongsu }]);
    const full: DiaryStop[] = Array.from({ length: DIARY_LIMITS.maxStops }, () => ({ place: seoulForest }));
    expect(addDiaryStop(full, onionSeongsu)).toBe(full);
  });

  it('setStopTime sets and clears a time', () => {
    const stops: DiaryStop[] = [{ place: onionSeongsu, time: '10:00' }];
    expect(setStopTime(stops, 0, '11:15')[0].time).toBe('11:15');
    expect(setStopTime(stops, 0, '')[0]).toEqual({ place: onionSeongsu });
  });

  it('sortStopsByTime orders timed stops; untimed ones stay after the stop before them', () => {
    const stops: DiaryStop[] = [
      { place: seoulForest, time: '15:00' },
      { place: onionSeongsu, time: '10:00' },
      { place: seongsuGalbi },
    ];
    expect(sortStopsByTime(stops).map((s) => s.place.name)).toEqual(['어니언 성수', '성수 갈비집', '서울숲']);
  });

  it('requires a valid date and at least one stop', () => {
    expect(validateDiary({ date: '2026-09-28', stops: [] })).toEqual(['no-stops']);
    expect(validateDiary({ date: 'x', stops: [{ place: onionSeongsu }] })).toEqual(['bad-date']);
    expect(validateDiary({ date: '2026-09-28', stops: [{ place: onionSeongsu }] })).toEqual([]);
  });

  it('sortDiaries puts the newest day first', () => {
    const list = [
      { date: '2026-09-01', createdAt: 'a' },
      { date: '2026-09-28', createdAt: 'a' },
    ];
    expect(sortDiaries(list).map((e) => e.date)).toEqual(['2026-09-28', '2026-09-01']);
  });
});

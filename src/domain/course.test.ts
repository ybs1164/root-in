import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { addStop, COURSE_LIMITS, defaultTitle, moveStop, removeStop, setStopMemo, validateCourse } from './course';

const { onionSeongsu, seongsuGalbi, seoulForest } = samplePlaces;
const three = [{ place: onionSeongsu }, { place: seongsuGalbi }, { place: seoulForest }];

describe('course domain', () => {
  it('a course needs 2–10 stops', () => {
    expect(validateCourse({ stops: three.slice(0, 1) })).toEqual(['too-few-stops']);
    expect(validateCourse({ stops: three })).toEqual([]);
    expect(validateCourse({ stops: Array(11).fill(three[0]) })).toEqual(['too-many-stops']);
  });

  it('addStop refuses an 11th stop', () => {
    const full = Array(COURSE_LIMITS.maxStops).fill(three[0]);
    expect(addStop(full, seoulForest)).toBe(full);
    expect(addStop(three, seoulForest)).toHaveLength(4);
  });

  it('moveStop / removeStop return a new array and keep other stops in order', () => {
    const moved = moveStop(three, 2, 0);
    expect(moved.map((s) => s.place.name)).toEqual(['서울숲', '어니언 성수', '성수 갈비집']);
    expect(three[0].place).toBe(onionSeongsu);
    expect(moveStop(three, 0, 5)).toBe(three);
    expect(removeStop(three, 1).map((s) => s.place.name)).toEqual(['어니언 성수', '서울숲']);
  });

  it('setStopMemo clamps and clears memos', () => {
    expect(setStopMemo(three, 0, '가'.repeat(500))[0].memo).toHaveLength(COURSE_LIMITS.memo);
    expect(setStopMemo(three, 0, '')[0].memo).toBeUndefined();
  });

  it('defaultTitle is "첫 → 마지막" for 2 stops, "첫 외 N곳" for 3+', () => {
    expect(defaultTitle(three.slice(0, 2))).toBe('어니언 성수 → 성수 갈비집');
    expect(defaultTitle(three)).toBe('어니언 성수 외 2곳');
    expect(defaultTitle([])).toBe('새 코스');
  });
});

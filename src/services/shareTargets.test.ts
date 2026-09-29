import { beforeEach, describe, expect, it, vi } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { decodeSharedCourse } from './courseShareService';
import { decodeSharedDiary } from './diaryShareService';
import { decodeSharedPinSet } from './pinShareService';
import { planShare } from './shareTargets';

const token = (url: string, key: string) => new URLSearchParams(new URL(url).hash.slice(1)).get(key) ?? '';
const { onionSeongsu, seoulForest } = samplePlaces;

describe('unified share sheet', () => {
  // The link services build URLs from the page location.
  beforeEach(() => vi.stubGlobal('location', { origin: 'https://goodroot.app', pathname: '/' }));

  it('one share sheet handles course / day / pins targets', async () => {
    const course = planShare({ kind: 'course', draft: { title: '', theme: 'date', travelMode: 'walk', stops: [{ place: onionSeongsu }, { place: seoulForest }] } }, '지우');
    expect(course.heading).toBe('코스 공유');
    expect(course.summary).toBe('1. 어니언 성수  2. 서울숲');
    expect(decodeSharedCourse(token(await course.createUrl(), 'share'))?.sharedBy).toBe('지우');

    const day = planShare({ kind: 'day', draft: { date: '2026-09-29', title: '', travelMode: 'walk', stops: [{ place: onionSeongsu, time: '10:00' }] } }, '');
    expect(day.summary).toBe('1. 10:00 어니언 성수');
    expect(decodeSharedDiary(token(await day.createUrl(), 'diary'))?.stops[0].time).toBe('10:00');

    const pins = planShare(
      {
        kind: 'pins',
        set: { title: '카페', categories: [{ name: '카페', icon: 'cafe', color: 1 }], pins: [{ place: onionSeongsu, category: 0 }], sharedAt: '' },
        dropped: 3,
      },
      '지우',
    );
    expect(pins.heading).toBe('핀셋 공유');
    expect(pins.notice).toContain('30개');
    expect(decodeSharedPinSet(token(await pins.createUrl(), 'pins'))?.sharedBy).toBe('지우');
    expect(pins.text('https://x/')).toContain('📍 카페 (1곳)');
  });

  it('a shared plan leaves out my check-ins and times', async () => {
    const plan = planShare(
      {
        kind: 'day',
        draft: { date: '2026-09-30', kind: 'plan', title: '', travelMode: 'walk', stops: [{ place: onionSeongsu, time: '10:00', checked: true }] },
      },
      '',
    );
    const decoded = decodeSharedDiary(token(await plan.createUrl(), 'diary'));
    expect(decoded?.kind).toBe('plan');
    expect(decoded?.stops).toEqual([{ place: { id: onionSeongsu.id, name: onionSeongsu.name, center: onionSeongsu.center } }]);
  });
});

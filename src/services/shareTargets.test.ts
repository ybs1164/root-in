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

describe('planShare with 제외 주소', () => {
  const home = { id: 'home', label: '집', address: '서울 성동구 아차산로9길 8', center: [127.0582, 37.5447] as [number, number] };
  const at = (name: string, center: [number, number], address?: string) => ({ place: { id: name, name, center, address } });

  it('leaves excluded places out of a course link and says so', () => {
    const plan = planShare(
      { kind: 'course', draft: { title: '', theme: 'etc', travelMode: 'walk', stops: [at('집 앞', [127.0583, 37.5447]), at('서울숲', [127.0374, 37.5444])] } },
      '',
      '2026-10-03T00:00:00.000Z',
      [home],
    );
    expect(plan.summary).toBe('1. 서울숲');
    expect(plan.notice).toContain('1곳은 공유에서 빠졌어요');
  });

  it('matches by address when positions differ', () => {
    const plan = planShare(
      { kind: 'day', draft: { date: '2026-10-03', title: '', travelMode: 'walk', stops: [at('우리집', [0, 0], '서울특별시 성동구 아차산로9길 8'), at('카페', [127.0, 37.5])] } },
      '',
      '2026-10-03T00:00:00.000Z',
      [{ ...home, center: undefined }],
    );
    expect(plan.summary).not.toContain('우리집');
  });
});

import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { CourseDraft } from '../types/course';
import { LocalCourseRepository } from './courseRepository';

const draft = (overrides: Partial<CourseDraft> = {}): CourseDraft => ({
  title: '',
  theme: 'date',
  travelMode: 'walk',
  stops: [{ place: samplePlaces.onionSeongsu }, { place: samplePlaces.seongsuGalbi }, { place: samplePlaces.seoulForest }],
  ...overrides,
});

describe('LocalCourseRepository', () => {
  it('creates with a default title and persists', async () => {
    const saved = await new LocalCourseRepository().save('me', draft());
    expect(saved.title).toBe('어니언 성수 외 2곳');
    expect(await new LocalCourseRepository().listByUser('me')).toEqual([saved]);
  });

  it('keeps a decorative icon from the list, and drops anything else', async () => {
    const repo = new LocalCourseRepository();
    expect((await repo.save('me', draft({ icon: '🌸' }))).icon).toBe('🌸');
    expect((await repo.save('me', draft({ icon: '<b>' }))).icon).toBeUndefined();
  });

  it('updates in place when the draft has an id owned by the user', async () => {
    const repo = new LocalCourseRepository();
    const first = await repo.save('me', draft());
    const second = await repo.save('me', { ...draft({ title: '수정' }), id: first.id });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    const all = await repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('수정');
  });

  it('does not let another user overwrite a course', async () => {
    const repo = new LocalCourseRepository();
    const mine = await repo.save('me', draft());
    await repo.save('you', { ...draft({ title: 'hijack' }), id: mine.id });
    expect((await repo.listByUser('me'))[0].title).toBe(mine.title);
    expect(await repo.listAll()).toHaveLength(2);
  });

  it('removes only the owner course', async () => {
    const repo = new LocalCourseRepository();
    const mine = await repo.save('me', draft());
    await repo.remove(mine.id, 'you');
    expect(await repo.listAll()).toHaveLength(1);
    await repo.remove(mine.id, 'me');
    expect(await repo.listAll()).toHaveLength(0);
  });

  it('migrates travel-routes:v1 to 2-stop courses once, then removes the v1 key', async () => {
    localStorage.setItem(
      'goodroot:travel-routes:v1',
      JSON.stringify([
        {
          id: 'r1',
          userId: 'me',
          origin: samplePlaces.gamcheon,
          destination: samplePlaces.haeundae,
          title: '부산',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ]),
    );
    const courses = await new LocalCourseRepository().listByUser('me');
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: 'r1', theme: 'trip', travelMode: 'drive', title: '부산' });
    expect(courses[0].stops.map((s) => s.place.name)).toEqual(['감천문화마을', '해운대해수욕장']);
    expect(localStorage.getItem('goodroot:travel-routes:v1')).toBeNull();
    expect(await new LocalCourseRepository().listAll()).toHaveLength(1);
  });
});

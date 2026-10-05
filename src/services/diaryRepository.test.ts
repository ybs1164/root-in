import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { DiaryDraft } from '../types/diary';
import { LocalDiaryRepository } from './diaryRepository';

const draft = (overrides: Partial<DiaryDraft> = {}): DiaryDraft => ({
  date: '2026-09-28',
  title: '',
  travelMode: 'walk',
  stops: [
    { place: samplePlaces.onionSeongsu, time: '10:00' },
    { place: samplePlaces.seoulForest, time: '14:30', memo: '산책' },
  ],
  ...overrides,
});

describe('LocalDiaryRepository', () => {
  it('creates with a date-based default title and persists under a versioned key', async () => {
    const saved = await new LocalDiaryRepository().save('me', draft({ text: '  좋은 하루 ' }));
    expect(saved.title).toBe('9월 28일 (월)의 기록');
    expect(saved.text).toBe('좋은 하루');
    expect(await new LocalDiaryRepository().listByUser('me')).toEqual([saved]);
    expect(window.localStorage.getItem('goodroot:diaries:v1')).toContain(saved.id);
  });

  it('updates in place for the owner only', async () => {
    const repo = new LocalDiaryRepository();
    const mine = await repo.save('me', draft());
    const updated = await repo.save('me', { ...draft({ title: '수정' }), id: mine.id });
    expect(updated.id).toBe(mine.id);
    expect(updated.createdAt).toBe(mine.createdAt);
    await repo.save('you', { ...draft({ title: 'hijack' }), id: mine.id });
    expect((await repo.listByUser('me')).map((e) => e.title)).toEqual(['수정']);
  });

  it('survives corrupted storage', async () => {
    window.localStorage.setItem('goodroot:diaries:v1', '{not json');
    expect(await new LocalDiaryRepository().listByUser('me')).toEqual([]);
  });
});

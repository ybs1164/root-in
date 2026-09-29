import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { DiaryDraft } from '../types/diary';
import { LocalDiaryRepository, LocalWishlistRepository } from './diaryRepository';

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

describe('LocalWishlistRepository', () => {
  it('stores snapshots apart from the diary and does not duplicate a starred entry', async () => {
    const diary = await new LocalDiaryRepository().save('me', draft());
    const wishes = new LocalWishlistRepository();
    const first = await wishes.add('me', diary, diary.id);
    const again = await wishes.add('me', diary, diary.id);
    expect(again.id).toBe(first.id);
    expect(await wishes.listByUser('me')).toHaveLength(1);
    expect(first.stops).toEqual(diary.stops);

    // Deleting the diary page keeps the wish snapshot.
    await new LocalDiaryRepository().remove(diary.id, 'me');
    expect(await wishes.listByUser('me')).toHaveLength(1);
  });

  it('syncFromDiary refreshes the snapshot only for starred entries', async () => {
    const repo = new LocalDiaryRepository();
    const wishes = new LocalWishlistRepository();
    const starred = await repo.save('me', draft());
    const other = await repo.save('me', draft({ date: '2026-09-27' }));
    await wishes.add('me', starred, starred.id);

    const edited = await repo.save('me', { ...draft({ title: '성수 산책' }), id: starred.id });
    expect((await wishes.syncFromDiary('me', edited))?.title).toBe('성수 산책');
    expect(await wishes.syncFromDiary('me', other)).toBeNull();
  });

  it('keeps shared diaries with their sender and removes per owner', async () => {
    const wishes = new LocalWishlistRepository();
    const item = await wishes.add('me', { ...draft(), title: '지우의 하루', sharedBy: '지우' });
    expect(item.sharedBy).toBe('지우');
    expect(item.sourceDiaryId).toBeUndefined();
    await wishes.remove(item.id, 'you');
    expect(await wishes.listByUser('me')).toHaveLength(1);
    await wishes.remove(item.id, 'me');
    expect(await wishes.listByUser('me')).toEqual([]);
  });
});

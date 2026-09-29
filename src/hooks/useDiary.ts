import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortDiaries } from '../domain/diary';
import { getCurrentUserId } from '../lib/currentUser';
import {
  diaryRepository,
  wishlistRepository,
  type DiaryRepository,
  type WishlistRepository,
} from '../services/diaryRepository';
import type { DiaryDraft, DiaryEntry, DiarySnapshot, WishItem } from '../types/diary';

/** Diary entries and the wishlist, kept in sync (saving a starred day refreshes its wish snapshot). */
export function useDiary(diaries: DiaryRepository = diaryRepository, wishlist: WishlistRepository = wishlistRepository) {
  const userId = useMemo(getCurrentUserId, []);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [wishes, setWishes] = useState<WishItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([diaries.listByUser(userId), wishlist.listByUser(userId)]).then(([e, w]) => {
      if (cancelled) return;
      setEntries(e);
      setWishes(w);
    });
    return () => {
      cancelled = true;
    };
  }, [diaries, wishlist, userId]);

  const upsertWish = (item: WishItem) =>
    setWishes((prev) => (prev.some((w) => w.id === item.id) ? prev.map((w) => (w.id === item.id ? item : w)) : [...prev, item]));

  const saveEntry = useCallback(
    async (draft: DiaryDraft) => {
      const saved = await diaries.save(userId, draft);
      setEntries((prev) => (prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]));
      const synced = await wishlist.syncFromDiary(userId, saved);
      if (synced) upsertWish(synced);
      return saved;
    },
    [diaries, wishlist, userId],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await diaries.remove(id, userId);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      // The wish item is a snapshot and deliberately survives the diary page.
    },
    [diaries, userId],
  );

  const addWish = useCallback(
    async (snapshot: DiarySnapshot, sourceDiaryId?: string) => {
      const item = await wishlist.add(userId, snapshot, sourceDiaryId);
      upsertWish(item);
      return item;
    },
    [wishlist, userId],
  );

  const removeWish = useCallback(
    async (id: string) => {
      await wishlist.remove(id, userId);
      setWishes((prev) => prev.filter((w) => w.id !== id));
    },
    [wishlist, userId],
  );

  const sortedEntries = useMemo(() => sortDiaries(entries), [entries]);
  // Wishlist reads like favourites: most recently added first.
  const sortedWishes = useMemo(() => [...wishes].sort((a, b) => b.addedAt.localeCompare(a.addedAt)), [wishes]);
  const wishByDiaryId = useMemo(
    () => new Map(wishes.filter((w) => w.sourceDiaryId).map((w) => [w.sourceDiaryId as string, w])),
    [wishes],
  );

  return {
    entries: sortedEntries,
    wishes: sortedWishes,
    wishByDiaryId,
    saveEntry,
    removeEntry,
    addWish,
    removeWish,
  };
}

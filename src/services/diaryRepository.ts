import { defaultDiaryTitle, diarySnapshot } from '../domain/diary';
import type { DiaryDraft, DiaryEntry, DiarySnapshot, WishItem } from '../types/diary';

const DIARY_KEY = 'goodroot:diaries:v1';
const WISHLIST_KEY = 'goodroot:wishlist:v1';

/** Same seam as CourseRepository: a server-backed version can replace localStorage later. */
export interface DiaryRepository {
  listByUser(userId: string): Promise<DiaryEntry[]>;
  /** Creates an entry, or updates it when `draft.id` belongs to this user. */
  save(userId: string, draft: DiaryDraft): Promise<DiaryEntry>;
  remove(id: string, userId: string): Promise<void>;
}

/** The wishlist is stored apart from the diary: items are snapshots, not references. */
export interface WishlistRepository {
  listByUser(userId: string): Promise<WishItem[]>;
  add(userId: string, snapshot: DiarySnapshot, sourceDiaryId?: string): Promise<WishItem>;
  /** Refreshes the snapshot of an item made from this diary entry, if any. */
  syncFromDiary(userId: string, entry: DiaryEntry): Promise<WishItem | null>;
  remove(id: string, userId: string): Promise<void>;
}

const generateId = (prefix: string) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage full/disabled: in-memory state still shows the change until reload.
  }
}

export class LocalDiaryRepository implements DiaryRepository {
  async listByUser(userId: string): Promise<DiaryEntry[]> {
    return readList<DiaryEntry>(DIARY_KEY).filter((e) => e.userId === userId);
  }

  async save(userId: string, draft: DiaryDraft): Promise<DiaryEntry> {
    const entries = readList<DiaryEntry>(DIARY_KEY);
    const now = new Date().toISOString();
    const existing = draft.id ? entries.find((e) => e.id === draft.id && e.userId === userId) : undefined;
    const entry: DiaryEntry = {
      id: existing?.id ?? generateId('diary'),
      userId,
      date: draft.date,
      title: draft.title.trim() || defaultDiaryTitle(draft),
      mood: draft.mood,
      travelMode: draft.travelMode,
      stops: draft.stops,
      text: draft.text?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
    };
    writeList(DIARY_KEY, existing ? entries.map((e) => (e.id === entry.id ? entry : e)) : [...entries, entry]);
    return entry;
  }

  async remove(id: string, userId: string): Promise<void> {
    writeList(
      DIARY_KEY,
      readList<DiaryEntry>(DIARY_KEY).filter((e) => !(e.id === id && e.userId === userId)),
    );
  }
}

export class LocalWishlistRepository implements WishlistRepository {
  async listByUser(userId: string): Promise<WishItem[]> {
    return readList<WishItem>(WISHLIST_KEY).filter((w) => w.userId === userId);
  }

  async add(userId: string, snapshot: DiarySnapshot, sourceDiaryId?: string): Promise<WishItem> {
    const items = readList<WishItem>(WISHLIST_KEY);
    // Starring the same diary twice must not create duplicates.
    const existing = sourceDiaryId
      ? items.find((w) => w.userId === userId && w.sourceDiaryId === sourceDiaryId)
      : undefined;
    if (existing) return existing;
    const item: WishItem = {
      ...diarySnapshot(snapshot),
      id: generateId('wish'),
      userId,
      sourceDiaryId,
      addedAt: new Date().toISOString(),
    };
    writeList(WISHLIST_KEY, [...items, item]);
    return item;
  }

  async syncFromDiary(userId: string, entry: DiaryEntry): Promise<WishItem | null> {
    const items = readList<WishItem>(WISHLIST_KEY);
    const existing = items.find((w) => w.userId === userId && w.sourceDiaryId === entry.id);
    if (!existing) return null;
    const updated: WishItem = { ...existing, ...diarySnapshot(entry) };
    writeList(
      WISHLIST_KEY,
      items.map((w) => (w.id === existing.id ? updated : w)),
    );
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    writeList(
      WISHLIST_KEY,
      readList<WishItem>(WISHLIST_KEY).filter((w) => !(w.id === id && w.userId === userId)),
    );
  }
}

export const diaryRepository: DiaryRepository = new LocalDiaryRepository();
export const wishlistRepository: WishlistRepository = new LocalWishlistRepository();

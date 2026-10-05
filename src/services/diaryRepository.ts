import { defaultDiaryTitle } from '../domain/diary';
import type { DiaryDraft, DiaryEntry } from '../types/diary';

const DIARY_KEY = 'goodroot:diaries:v1';

/** Same seam as CourseRepository: a server-backed version can replace localStorage later. */
export interface DiaryRepository {
  listByUser(userId: string): Promise<DiaryEntry[]>;
  /** Creates an entry, or updates it when `draft.id` belongs to this user. */
  save(userId: string, draft: DiaryDraft): Promise<DiaryEntry>;
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
    if (draft.kind === 'plan') entry.kind = 'plan';
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

export const diaryRepository: DiaryRepository = new LocalDiaryRepository();

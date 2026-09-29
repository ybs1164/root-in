import { DEFAULT_CATEGORIES, isPinColor, isPinIcon } from '../domain/pin';
import type { Pin, PinCategory } from '../types/pin';

const PINS_KEY = 'goodroot:pins:v1';
const CATEGORIES_KEY = 'goodroot:pin-categories:v1';

/** Same seam as CourseRepository: a server-backed version can replace localStorage later. */
export interface PinRepository {
  listByUser(userId: string): Promise<Pin[]>;
  /** Replaces this user's pins (pins are edited as a list: upsert, re-file, undo). */
  saveAll(userId: string, pins: Pin[]): Promise<void>;
}

export interface PinCategoryRepository {
  /** Seeds the default categories on first use. */
  list(): Promise<PinCategory[]>;
  saveAll(categories: PinCategory[]): Promise<void>;
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/disabled: in-memory state still shows the change until reload.
  }
}

// Stored data can be hand-edited or left over from a buggy build; drop rows
// that would crash the map instead of failing the whole list.
const isPin = (value: unknown): value is Pin => {
  const p = value as Pin;
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.userId === 'string' &&
    typeof p.categoryId === 'string' &&
    typeof p.place?.name === 'string' &&
    Array.isArray(p.place?.center) &&
    p.place.center.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
};

const isCategory = (value: unknown): value is PinCategory => {
  const c = value as PinCategory;
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && isPinIcon(c.icon) && isPinColor(c.color);
};

export class LocalPinRepository implements PinRepository {
  async listByUser(userId: string): Promise<Pin[]> {
    const raw = readJson(PINS_KEY);
    return (Array.isArray(raw) ? raw : []).filter(isPin).filter((p) => p.userId === userId);
  }

  async saveAll(userId: string, pins: Pin[]): Promise<void> {
    const raw = readJson(PINS_KEY);
    const others = (Array.isArray(raw) ? raw : []).filter(isPin).filter((p) => p.userId !== userId);
    writeJson(PINS_KEY, [...others, ...pins.filter((p) => p.userId === userId)]);
  }
}

export class LocalPinCategoryRepository implements PinCategoryRepository {
  async list(): Promise<PinCategory[]> {
    const raw = readJson(CATEGORIES_KEY);
    if (!Array.isArray(raw)) {
      writeJson(CATEGORIES_KEY, DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return raw.filter(isCategory);
  }

  async saveAll(categories: PinCategory[]): Promise<void> {
    writeJson(CATEGORIES_KEY, categories);
  }
}

export const pinRepository: PinRepository = new LocalPinRepository();
export const pinCategoryRepository: PinCategoryRepository = new LocalPinCategoryRepository();

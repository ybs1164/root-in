const SETTINGS_KEY = 'goodroot:settings:v1';

export interface Settings {
  /** Pin categories used most recently, first = latest; ordering the quick-pin chips. */
  recentCategoryIds: string[];
}

export const DEFAULT_SETTINGS: Settings = { recentCategoryIds: [] };

const MAX_RECENT = 8;

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      recentCategoryIds: Array.isArray(parsed.recentCategoryIds)
        ? parsed.recentCategoryIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT)
        : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Not persisting settings is harmless; defaults come back on reload.
  }
}

export function withRecentCategory(settings: Settings, categoryId: string): Settings {
  const recent = [categoryId, ...settings.recentCategoryIds.filter((id) => id !== categoryId)].slice(0, MAX_RECENT);
  return { ...settings, recentCategoryIds: recent };
}

/** Removes every app key (settings → 데이터 초기화). */
export function clearAppData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('goodroot:')) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

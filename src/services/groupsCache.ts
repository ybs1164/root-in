import { dateKey } from '../domain/diary';
import type { Group } from '../domain/groups';

const CACHE_KEY = 'goodroot:groups-cache:v1';
/** Past this the copy isn't kept (it's only there to open on). */
const MAX_CHARS = 1_500_000;

interface Stored {
  userId: string;
  day: string;
  groups: readonly Group[];
}

/**
 * We Now's groups as last read, kept on this phone so the first screen opens
 * on them at once (the server is asked again straight after, and its answer
 * replaces them). The copy is for one account; a day's pings belong to that
 * day, so a copy from another day opens with no pings yet.
 */
export function loadGroupsCache(): { userId: string; groups: Group[] } | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null') as Partial<Stored> | null;
    if (!raw || typeof raw.userId !== 'string' || typeof raw.day !== 'string' || !Array.isArray(raw.groups)) return null;
    const groups = [...(raw.groups ?? [])].filter(
      (g): g is Group => !!g && typeof g === 'object' && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.members),
    );
    const today = raw.day === dateKey();
    return {
      userId: raw.userId,
      groups: today ? groups : groups.map((g) => ({ ...g, members: g.members.map((m) => ({ ...m, pings: [] })) })),
    };
  } catch {
    return null;
  }
}

export function saveGroupsCache(userId: string, groups: readonly Group[]): void {
  try {
    const text = JSON.stringify({ userId, day: dateKey(), groups } satisfies Stored);
    if (text.length > MAX_CHARS) return window.localStorage.removeItem(CACHE_KEY);
    window.localStorage.setItem(CACHE_KEY, text);
  } catch {
    // Full or blocked storage: the list just loads from the server next time.
  }
}

export function clearGroupsCache(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to clear.
  }
}

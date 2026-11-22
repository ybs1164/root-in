/**
 * The last answer each server read gave, kept so a screen opened again shows
 * it at once while it reads afresh (stale-while-revalidate): the gallery, a
 * group's 대화, a photo's comments, a past day of a group, a calendar month.
 * In memory only — the group list, the first screen, keeps its own copy on
 * the phone (`services/groupsCache.ts`). Dropped when the account changes.
 */

const memory = new Map<string, unknown>();
/** Bumped by `forgetReads`: a read that set out before it isn't kept. */
let generation = 0;

/** How many answers are kept; the oldest go first. */
const LIMIT = 80;

/** The answer last kept under `key`, if any. */
export function recall<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined;
}

/** Keeps `value` as `key`'s latest answer. */
export function remember<T>(key: string, value: T): void {
  memory.delete(key);
  memory.set(key, value);
  while (memory.size > LIMIT) memory.delete(memory.keys().next().value as string);
}

/** Changes the kept answer under `key` (an optimistic edit), if there is one. */
export function amend<T>(key: string, change: (value: T) => T): void {
  if (memory.has(key)) memory.set(key, change(memory.get(key) as T));
}

/** Everything kept goes (signed out, or another account). */
export function forgetReads(): void {
  generation += 1;
  memory.clear();
  inFlight.clear();
}

/**
 * Reads already on their way, by key: a screen that opens while its prefetch
 * is still out waits on that one instead of asking twice.
 */
const inFlight = new Map<string, Promise<unknown>>();

/** `read()` once per key at a time; the answer is kept when it isn't 'error'. */
export function readOnce<T>(key: string, read: () => Promise<T | 'error'>): Promise<T | 'error'> {
  const going = inFlight.get(key) as Promise<T | 'error'> | undefined;
  if (going) return going;
  const asked0 = generation;
  const asked = read()
    .then((answer) => {
      if (answer !== 'error' && asked0 === generation) remember(key, answer);
      return answer;
    })
    .catch(() => 'error' as const)
    .finally(() => inFlight.get(key) === asked && inFlight.delete(key));
  inFlight.set(key, asked);
  return asked;
}

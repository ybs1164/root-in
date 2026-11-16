/**
 * Lines of a group's 대화 deleted 나에게만 (for me only): hidden on this
 * phone, everyone else still sees them. Kept by the line's id (a message,
 * a comment or a photo's row), never synced.
 */
const HIDDEN_KEY = 'goodroot:chat-hidden:v1';

/** The oldest go first past this; a line that old has long left the 300 a 대화 reads. */
export const MAX_HIDDEN_LINES = 2000;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80;

export function loadHiddenLines(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(isId).slice(-MAX_HIDDEN_LINES) : [];
  } catch {
    return [];
  }
}

/** Hides one more line; every hidden line now. */
export function hideLine(id: string): string[] {
  const now = loadHiddenLines();
  if (!isId(id) || now.includes(id)) return now;
  const next = [...now, id].slice(-MAX_HIDDEN_LINES);
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  } catch {
    // Storage full: hidden for now, back next time.
  }
  return next;
}

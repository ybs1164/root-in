import { COMMENT_MAX } from '../domain/gallery';

/**
 * Comments on TODAY's photos (`ping:<id>`), which never leave the phone —
 * so their comments don't either. Every one is mine.
 */
const COMMENTS_KEY = 'goodroot:photo-comments:v1';
/** Oldest go first past this many in all. */
const MAX_COMMENTS = 1000;

export interface LocalComment {
  id: string;
  body: string;
  at: string;
}

function loadAll(): Record<string, LocalComment[]> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMMENTS_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, LocalComment[]> = {};
    for (const [path, list] of Object.entries(raw)) {
      if (path.length > 120 || !Array.isArray(list)) continue;
      const ok = list.filter(
        (c): c is LocalComment =>
          !!c &&
          typeof c.id === 'string' &&
          typeof c.body === 'string' &&
          c.body.trim().length > 0 &&
          c.body.length <= COMMENT_MAX &&
          typeof c.at === 'string' &&
          !Number.isNaN(Date.parse(c.at)),
      );
      if (ok.length) out[path] = ok;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadLocalComments(path: string): LocalComment[] {
  return loadAll()[path] ?? [];
}

/** Adds a comment under `path`; false when it's empty or couldn't be kept. */
export function addLocalComment(path: string, body: string, now = new Date()): boolean {
  const text = body.trim().slice(0, COMMENT_MAX);
  if (!text) return false;
  const all = loadAll();
  all[path] = [...(all[path] ?? []), { id: `c${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, body: text, at: now.toISOString() }];
  // Past the cap the oldest go, whichever photo they were on.
  const flat = Object.entries(all).flatMap(([p, list]) => list.map((c) => ({ p, c })));
  if (flat.length > MAX_COMMENTS) {
    flat.sort((a, b) => (a.c.at < b.c.at ? -1 : 1));
    for (const { p, c } of flat.slice(0, flat.length - MAX_COMMENTS)) all[p] = all[p].filter((x) => x !== c);
  }
  try {
    window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

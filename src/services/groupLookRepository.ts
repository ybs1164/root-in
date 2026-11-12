import { readGroupLooks, type GroupLooks } from '../domain/groups';

const LOOKS_KEY = 'goodroot:group-looks:v1';
const MAX_GROUPS = 60;

/** Group id → the shapes I gave my own pings and lines on that group's map. */
export type MyGroupLooks = Record<string, GroupLooks>;

/**
 * My pings' and lines' looks per group, this phone's copy. They're each
 * group's own (TODAY's looks are a day's, kept apart). The server copy
 * (group_ping_looks) is what the other members see; this one keeps mine
 * on my map even where the server can't take them yet.
 */
export function loadMyGroupLooks(): MyGroupLooks {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOOKS_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: MyGroupLooks = {};
    for (const [group, looks] of Object.entries(raw).slice(0, MAX_GROUPS)) {
      const read = group.length <= 64 ? readGroupLooks(looks) : undefined;
      if (read) out[group] = read;
    }
    return out;
  } catch {
    return {};
  }
}

/** `all` with `groupId`'s looks set to `looks`, saved. */
export function saveMyGroupLooks(all: MyGroupLooks, groupId: string, looks: GroupLooks): MyGroupLooks {
  const next = { ...all, [groupId]: looks };
  try {
    window.localStorage.setItem(LOOKS_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked storage: still shown until the app closes.
  }
  return next;
}

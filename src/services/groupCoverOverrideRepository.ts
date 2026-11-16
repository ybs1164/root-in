import { readGroupCoverOverride, type GroupCoverOverride } from '../domain/groups';

const KEY = 'goodroot:group-cover-override:v1';
const MAX_GROUPS = 60;

/** Group id → my own cover look for it (`Group.coverOverride`), this phone only. */
export type GroupCoverOverrides = Record<string, GroupCoverOverride>;

export function loadGroupCoverOverrides(): GroupCoverOverrides {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: GroupCoverOverrides = {};
    for (const [id, value] of Object.entries(raw).slice(0, MAX_GROUPS)) {
      const read = id.length <= 64 ? readGroupCoverOverride(value) : undefined;
      if (read) out[id] = read;
    }
    return out;
  } catch {
    return {};
  }
}

/** `all` with `groupId`'s override set to `override` (null takes it off — 초기화), saved. */
export function saveGroupCoverOverride(all: GroupCoverOverrides, groupId: string, override: GroupCoverOverride | null): GroupCoverOverrides {
  const next = { ...all };
  if (override) next[groupId] = override;
  else delete next[groupId];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Full or blocked storage: still shown until the app closes.
  }
  return next;
}

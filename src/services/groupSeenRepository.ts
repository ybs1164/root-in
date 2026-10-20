import { GROUP_LIMITS } from '../domain/groups';

const SEEN_KEY = 'goodroot:group-seen:v1';

/** Per group id: the keys of the pings on its map when I last opened it (`groupPingKeys`). */
export type GroupSeen = Record<string, string[]>;

// Room for every member's pings in a group; a group is at most this many people.
const MAX_KEYS = GROUP_LIMITS.members * GROUP_LIMITS.pingsPerMember;
const MAX_GROUPS = 60;

export function loadGroupSeen(): GroupSeen {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const seen: GroupSeen = {};
    for (const [id, keys] of Object.entries(raw).slice(0, MAX_GROUPS)) {
      if (id.length > 64 || !Array.isArray(keys)) continue;
      seen[id] = keys.filter((k): k is string => typeof k === 'string' && k.length <= 120).slice(0, MAX_KEYS);
    }
    return seen;
  } catch {
    return {};
  }
}

export function saveGroupSeen(seen: GroupSeen): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Full or blocked storage: the badge just comes back next time.
  }
}

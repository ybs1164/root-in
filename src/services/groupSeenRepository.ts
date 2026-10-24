import { GROUP_LIMITS } from '../domain/groups';

const SEEN_KEY = 'goodroot:group-seen:v1';
const MEMBER_SEEN_KEY = 'goodroot:member-seen:v1';

/** Per group id: the keys of the pings on its map when I last opened it (`groupPingKeys`). */
export type GroupSeen = Record<string, string[]>;

// Room for every member's pings in a group; a group is at most this many people.
const MAX_KEYS = GROUP_LIMITS.members * GROUP_LIMITS.pingsPerMember;
const MAX_GROUPS = 60;

/**
 * Per `memberSeenKey(group, member)`: the keys of that member's pings when I
 * last had them picked on the group's map — the face's badge counts the rest.
 */
export type MemberSeen = Record<string, string[]>;

export const memberSeenKey = (groupId: string, memberId: string): string => `${groupId}|${memberId}`;

function load(key: string, maxRows: number, maxKeys: number, maxId: number): Record<string, string[]> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const seen: Record<string, string[]> = {};
    for (const [id, keys] of Object.entries(raw).slice(0, maxRows)) {
      if (id.length > maxId || !Array.isArray(keys)) continue;
      seen[id] = keys.filter((k): k is string => typeof k === 'string' && k.length <= 120).slice(0, maxKeys);
    }
    return seen;
  } catch {
    return {};
  }
}

function save(key: string, seen: Record<string, string[]>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(seen));
  } catch {
    // Full or blocked storage: the badge just comes back next time.
  }
}

export const loadGroupSeen = (): GroupSeen => load(SEEN_KEY, MAX_GROUPS, MAX_KEYS, 64);
export const saveGroupSeen = (seen: GroupSeen): void => save(SEEN_KEY, seen);
export const loadMemberSeen = (): MemberSeen => load(MEMBER_SEEN_KEY, MAX_GROUPS * GROUP_LIMITS.members, GROUP_LIMITS.pingsPerMember, 130);
export const saveMemberSeen = (seen: MemberSeen): void => save(MEMBER_SEEN_KEY, seen);

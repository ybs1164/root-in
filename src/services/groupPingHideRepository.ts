const HIDES_KEY = 'goodroot:group-ping-hides:v1';
const MAX_GROUPS = 60;
const MAX_IDS = 500;

/** Group id → my TODAY ping ids taken off that group's map (핀 삭제 there). */
export type GroupPingHides = Record<string, string[]>;

/**
 * The TODAY pings I took off one group's map, this phone's copy — the server
 * keeps the real list (group_ping_hides, so the others don't see them); this
 * one is for my own row there, which is drawn from this phone's pings.
 */
export function loadGroupPingHides(): GroupPingHides {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HIDES_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: GroupPingHides = {};
    for (const [group, ids] of Object.entries(raw).slice(0, MAX_GROUPS)) {
      if (group.length > 64 || !Array.isArray(ids)) continue;
      const kept = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64))].slice(-MAX_IDS);
      if (kept.length) out[group] = kept;
    }
    return out;
  } catch {
    return {};
  }
}

/** `hides` with `ids` added to `groupId`'s, saved. */
export function hideGroupPings(hides: GroupPingHides, groupId: string, ids: readonly string[]): GroupPingHides {
  const next = { ...hides, [groupId]: [...new Set([...(hides[groupId] ?? []), ...ids])].slice(-MAX_IDS) };
  try {
    window.localStorage.setItem(HIDES_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked storage: the server still hides them from the others.
  }
  return next;
}

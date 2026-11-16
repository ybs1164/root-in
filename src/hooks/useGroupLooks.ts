import { useCallback, useState } from 'react';
import type { LineLook, PingLook } from '../domain/dayPings';
import { withGroupLook, type Group, type GroupLooks, type GroupMember } from '../domain/groups';
import { loadMyGroupLooks, saveMyGroupLooks } from '../services/groupLookRepository';
import { groupService } from '../services/groupService';

/**
 * My looks in each group (pressed pings and lines): each group's own, apart
 * from TODAY's, kept on this phone so they stay on my map whether or not the
 * server (what the other members see) took them.
 */
export function useGroupLooks(openGroup: Group | null, myId: string | null) {
  const [myLooks, setMyLooks] = useState(loadMyGroupLooks);
  const looksOf = useCallback(
    (m: GroupMember): GroupLooks | undefined => (m.userId === myId && openGroup ? (myLooks[openGroup.id] ?? m.looks) : m.looks),
    [myId, openGroup, myLooks],
  );
  const myGroupRow = openGroup && myId ? (openGroup.members.find((m) => m.userId === myId) ?? null) : null;
  const setGroupLook = (kind: 'ping' | 'edge', key: string, look: PingLook | LineLook | null) => {
    const group = openGroup;
    if (!group || !myGroupRow) return;
    const next = withGroupLook(looksOf(myGroupRow), kind, key, look);
    setMyLooks((all) => saveMyGroupLooks(all, group.id, next));
    // Best effort: a server without group_ping_looks yet just leaves it on this phone.
    void groupService.setLook(group.id, kind, key, look);
  };
  return { looksOf, myGroupRow, setGroupLook };
}

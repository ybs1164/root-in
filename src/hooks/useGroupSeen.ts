import { useEffect, useState } from 'react';
import { groupPingKey, groupPingKeys, type Group } from '../domain/groups';
import { loadGroupSeen, loadMemberSeen, memberSeenKey, saveGroupSeen, saveMemberSeen, type GroupSeen, type MemberSeen } from '../services/groupSeenRepository';

/**
 * What I've seen of my groups, for their 새 핑 badges (this phone only).
 * `openGroup` is the group whose map is up, `picked` the member picked on it,
 * `day` the day it shows when that isn't today.
 */
export function useGroupSeen(openGroup: Group | null, picked: string | null, day: string | null) {
  // A group's 새 핑 badge: pings that weren't on its map when I last had it
  // open. Whatever is on the open group's map counts as seen, new arrivals too.
  const [groupSeen, setGroupSeen] = useState<GroupSeen>(loadGroupSeen);
  const openGroupKeys = openGroup ? groupPingKeys(openGroup).join(',') : null;
  useEffect(() => {
    // Another day's pings aren't today's news, nor what today's badge counts against.
    if (!openGroup || day) return;
    setGroupSeen((seen) => {
      const next = { ...seen, [openGroup.id]: groupPingKeys(openGroup) };
      saveGroupSeen(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroup?.id, openGroupKeys, day]);
  // Each face's badge on a group's map: that member's pings since I last had
  // them picked. Picking someone sees all of theirs, and so do new ones while picked.
  const [memberSeen, setMemberSeen] = useState<MemberSeen>(loadMemberSeen);
  const pickedMember = openGroup && picked ? (openGroup.members.find((m) => m.userId === picked) ?? null) : null;
  const pickedKeys = pickedMember ? pickedMember.pings.map((p) => groupPingKey(pickedMember, p)).join(',') : null;
  useEffect(() => {
    if (!openGroup || !pickedMember || day) return;
    setMemberSeen((seen) => {
      const next = { ...seen, [memberSeenKey(openGroup.id, pickedMember.userId)]: pickedMember.pings.map((p) => groupPingKey(pickedMember, p)) };
      saveMemberSeen(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroup?.id, pickedMember?.userId, pickedKeys, day]);
  return { groupSeen, memberSeen };
}

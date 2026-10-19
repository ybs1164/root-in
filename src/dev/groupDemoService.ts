import type { Group, GroupMember } from '../domain/groups';
import { GROUP_LIMITS } from '../domain/groups';
import type { GroupService } from '../services/groupService';

const DEMO_IDS = ['dev-group-user-1', 'dev-group-user-2'];

/** Local development fixtures only; no accounts or memberships are written to Supabase. */
export function withGroupDemoMembers(groups: Group[], day: string): Group[] {
  const target = groups.find((g) => g.name.replace(/\s/g, '') === '마이그룹') ?? groups.find((g) => g.mine) ?? groups[0];
  if (!target) return groups;
  const members = target.members.filter((m) => !DEMO_IDS.includes(m.userId));
  const center = members.flatMap((m) => m.pings)[0]?.center ?? [126.978, 37.5665];
  const used = new Set(members.map((m) => m.slot));
  const demos: GroupMember[] = [];
  for (let i = 0; i < 2 && members.length + demos.length < GROUP_LIMITS.members; i++) {
    const slot = Array.from({ length: GROUP_LIMITS.members }, (_, n) => n).find((n) => !used.has(n));
    if (slot === undefined) break;
    used.add(slot);
    demos.push({
      userId: DEMO_IDS[i], slot, nickname: `더미 유저 ${i + 1}`, alias: null, photo: null,
      pings: [0, 1, 2].map((step) => ({
        at: new Date(`${day}T${['09:30', '11:00', '14:00'][step]}:00+09:00`).toISOString(),
        center: [center[0] + (i === 0 ? 1 : -1) * (0.002 + step * 0.003), center[1] + (i === 0 ? 1 : -1) * (0.001 + step * 0.002)],
      })),
    });
  }
  return groups.map((g) => g.id === target.id ? { ...g, members: [...members, ...demos] } : g);
}

export function createGroupDemoService(service: GroupService): GroupService {
  const hidden = new Set<string>();
  return {
    ...service,
    async list(day) {
      const result = await service.list(day);
      if (result === 'error') return result;
      return withGroupDemoMembers(result, day).map((g) => ({ ...g, members: g.members.filter((m) => !hidden.has(`${g.id}:${m.userId}`)) }));
    },
    async kick(id, userId) {
      if (!DEMO_IDS.includes(userId)) return service.kick(id, userId);
      hidden.add(`${id}:${userId}`);
      return true;
    },
  };
}

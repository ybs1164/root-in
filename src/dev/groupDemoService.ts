import type { Group, GroupMember } from '../domain/groups';
import { GROUP_LIMITS } from '../domain/groups';
import type { GroupService } from '../services/groupService';

const DEMO_IDS = ['dev-group-user-1', 'dev-group-user-2'];
const DEMO_PLACES = [['광화문', '서촌 카페', '통인시장'], ['명동성당', '남대문시장', '을지로 노가리골목']];

/**
 * A stand-in for a photo sent from the camera: a little drawn scene (sky,
 * sun, hills) as an SVG data URL, so the demo works offline. The first demo
 * member's last place has none (a place they didn't photograph); the
 * second's does, so a photo shows over a face too.
 */
function demoPhoto(member: number, step: number): string | undefined {
  if (member === 0 && step === 2) return undefined;
  const hue = [205, 25, 140, 330][(member * 2 + step) % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 78%)"/><stop offset="1" stop-color="hsl(${hue + 30} 80% 92%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#s)"/><circle cx="${40 + step * 30}" cy="42" r="14" fill="hsl(45 95% 70%)"/><path d="M0 92 Q30 64 60 88 T120 80 V120 H0Z" fill="hsl(${hue + 90} 35% 52%)"/><path d="M0 104 Q40 86 80 102 T120 98 V120 H0Z" fill="hsl(${hue + 90} 40% 38%)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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
        name: DEMO_PLACES[i][step],
        photo: demoPhoto(i, step),
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

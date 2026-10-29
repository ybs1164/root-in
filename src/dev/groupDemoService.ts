import { dateKey } from '../domain/diary';
import type { Group, GroupMember, GroupPing } from '../domain/groups';
import { GROUP_LIMITS, firstFreeColor } from '../domain/groups';
import type { GalleryPhoto } from '../domain/gallery';
import type { GroupService } from '../services/groupService';
import { COMMENT_MAX, type MetPair, type PhotoComment } from '../domain/gallery';
import { getDisplayName } from '../lib/currentUser';

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

const demoTarget = (groups: Group[]): Group | undefined =>
  groups.find((g) => g.name.replace(/\s/g, '') === '마이그룹') ?? groups.find((g) => g.mine) ?? groups[0];

/** YYYY-MM-DD `back` days before `day`. */
function daysBefore(day: string, back: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d - back);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/**
 * Whether demo member `i` walked on `day`: only the last ten days up to
 * `today`, and not every one of those (a group's calendar shows gaps).
 */
export function demoWalked(i: number, day: string, today: string): boolean {
  const back = dayNumber(today) - dayNumber(day);
  if (back < 0 || back >= 10) return false;
  return back === 0 || (dayNumber(day) + i * 2) % 3 !== 0;
}

/** Whole days since 1970 for a YYYY-MM-DD (local), to vary the demo by day. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The demo members' photos in the gallery: today's (as on the map) and a few from the days before. */
export function demoGalleryPhotos(groupId: string, day: string): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  [0, 1, 3].forEach((back, d) => {
    const on = daysBefore(day, back);
    for (let i = 0; i < 2; i++) {
      for (let step = 0; step < 3; step++) {
        if (back > 0 && (step + d + i) % 2) continue;
        const url = demoPhoto(i, (step + d) % 3) ?? demoPhoto(i, 0);
        if (!url) continue;
        photos.push({
          id: `demo-${back}-${i}-${step}`, groupId, userId: DEMO_IDS[i], day: on,
          at: new Date(`${on}T${['09:30', '11:00', '14:00'][step]}:00+09:00`).toISOString(),
          name: DEMO_PLACES[i][step], path: `demo/${back}-${i}-${step}`, url,
        });
      }
    }
  });
  return photos;
}

/** Local development fixtures only; no accounts or memberships are written to Supabase. */
export function withGroupDemoMembers(groups: Group[], day: string, today: string = day): Group[] {
  const target = demoTarget(groups);
  if (!target) return groups;
  const members = target.members.filter((m) => !DEMO_IDS.includes(m.userId));
  const center = members.flatMap((m) => m.pings)[0]?.center ?? [126.978, 37.5665];
  const used = new Set(members.map((m) => m.slot));
  const demos: GroupMember[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 2 && members.length + demos.length < GROUP_LIMITS.members; i++) {
    const slot = Array.from({ length: GROUP_LIMITS.members }, (_, n) => n).find((n) => !used.has(n));
    if (slot === undefined) break;
    used.add(slot);
    // Like joining: the first colour nobody has.
    const color = firstFreeColor([...members, ...colors.map((c) => ({ color: c }))]) ?? slot;
    colors.push(color);
    // Its colour stays its own on the days it's away.
    if (!demoWalked(i, day, today)) continue;
    // Each day its own: the walk drifts and shortens, so paging a group's days shows a change.
    const shift = dayNumber(day) % 4;
    const steps = [0, 1, 2].slice(0, 3 - ((shift + i) % 3));
    const pings: GroupPing[] = steps.map((step) => ({
        at: new Date(`${day}T${['09:30', '11:00', '14:00'][step]}:00+09:00`).toISOString(),
        center: [
          center[0] + (i === 0 ? 1 : -1) * (0.002 + step * 0.003) + shift * 0.003,
          center[1] + (i === 0 ? 1 : -1) * (0.001 + step * 0.002) - shift * 0.002,
        ],
        name: DEMO_PLACES[i][(step + shift) % 3],
        photo: demoPhoto(i, step),
      }));
    // The first one sends a second photo from their first place twenty
    // minutes on: the same place, so its photos stack on one ping.
    const first = pings[0];
    if (i === 0 && first?.photo) pings.splice(1, 0, { ...first, at: new Date(Date.parse(first.at) + 20 * 60_000).toISOString(), photo: demoPhoto(i, 3) });
    demos.push({ userId: DEMO_IDS[i], slot, color, nickname: `더미 유저 ${i + 1}`, alias: null, photo: null, pings });
  }
  return groups.map((g) => g.id === target.id ? { ...g, members: [...members, ...demos] } : g);
}

export function createGroupDemoService(service: GroupService): GroupService {
  const hidden = new Set<string>();
  // Hearts on the demo members' drawn photos stay here (the server has no such photos).
  const demoHearts = new Set<string>();
  // The demo photos' comments, in memory only.
  const demoComments = new Map<string, PhotoComment[]>();
  let target: { id: string; day: string } | null = null;
  return {
    ...service,
    async list(day) {
      const result = await service.list(day);
      if (result === 'error') return result;
      const g = demoTarget(result);
      // The target's day is today's, whatever day was asked (the gallery and calendar count back from it).
      if (g) target = { id: g.id, day: dateKey() };
      return withGroupDemoMembers(result, day, dateKey()).map((g) => ({ ...g, members: g.members.filter((m) => !hidden.has(`${g.id}:${m.userId}`)) }));
    },
    async photos(groupIds) {
      const result = await service.photos(groupIds);
      if (result === 'error' || !target || !groupIds.includes(target.id)) return result;
      const shown = demoGalleryPhotos(target.id, target.day).filter((p) => !hidden.has(`${p.groupId}:${p.userId}`));
      return [...result, ...shown].sort((a, b) => (a.at < b.at ? 1 : -1));
    },
    async pingDays(groupId, from, to) {
      const result = await service.pingDays(groupId, from, to);
      if (result === 'error' || !target || groupId !== target.id) return result;
      // The days the demo members walked (as withGroupDemoMembers draws them).
      const days = { ...result };
      for (let back = 0; back < 10; back++) {
        const day = daysBefore(target.day, back);
        if (day < from || day > to) continue;
        const ids = DEMO_IDS.filter((id, i) => demoWalked(i, day, target!.day) && !hidden.has(`${groupId}:${id}`) && !(days[day] ?? []).includes(id));
        if (ids.length) days[day] = [...(days[day] ?? []), ...ids];
      }
      return days;
    },
    async metDays(groupIds, days) {
      const result = await service.metDays(groupIds, days);
      if (result === 'error' || !target || !groupIds.includes(target.id)) return result;
      // Today the first one met me (the group's first real member); three days back the two of them met.
      const me = (await service.list(target.day));
      const real = me === 'error' ? null : demoTarget(me)?.members[0]?.userId;
      const demo = [
        real ? { groupId: target.id, day: target.day, users: [real, DEMO_IDS[0]] as [string, string] } : null,
        { groupId: target.id, day: daysBefore(target.day, 3), users: [DEMO_IDS[0], DEMO_IDS[1]] as [string, string] },
      ].filter((p): p is MetPair => !!p && days.includes(p.day) && p.users.every((u) => !hidden.has(`${target!.id}:${u}`)));
      return [...result, ...demo];
    },
    async heart(path, on) {
      if (!path.startsWith('demo/')) return service.heart(path, on);
      if (on) demoHearts.add(path);
      else demoHearts.delete(path);
      return true;
    },
    async hearted() {
      const result = await service.hearted();
      return result === 'error' ? [...demoHearts] : [...result, ...demoHearts];
    },
    async comments(path) {
      if (!path.startsWith('demo/')) return service.comments(path);
      return [...(demoComments.get(path) ?? [])];
    },
    async comment(path, body) {
      if (!path.startsWith('demo/')) return service.comment(path, body);
      const list = demoComments.get(path) ?? [];
      list.push({ id: `demo-c${list.length}`, nickname: getDisplayName(), body: body.trim().slice(0, COMMENT_MAX), at: new Date().toISOString(), mine: true });
      demoComments.set(path, list);
      return true;
    },
    async kick(id, userId) {
      if (!DEMO_IDS.includes(userId)) return service.kick(id, userId);
      hidden.add(`${id}:${userId}`);
      return true;
    },
  };
}

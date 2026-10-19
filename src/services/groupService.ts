import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanGroupName, GROUP_LIMITS, type Group, type GroupMember, type GroupPing } from '../domain/groups';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import { inKorea } from './pinShareService';
import { newSlug } from './shareLinkService';
import { createGroupDemoService } from '../dev/groupDemoService';

// We Now groups (supabase/migrations/20261016000000_groups.sql). Everything
// goes through the server's functions; what comes back is checked like any
// received data. Never rejects.

/**
 * Whether We Now needs a Kakao login. Off (the default, while testing): a
 * guest account is made for the device. VITE_GROUPS_NEED_LOGIN=true turns
 * the login back on — no code change needed.
 */
export const groupsNeedLogin = (): boolean => import.meta.env.VITE_GROUPS_NEED_LOGIN === 'true';

const INVITE_KEY = 'g';
const SLUG = /^[A-Za-z0-9_-]{6,16}$/;
const UUID = /^[0-9a-f-]{36}$/;
// Postgres unique_violation: the random invite slug was taken (rare); try another.
const UNIQUE_VIOLATION = '23505';

export interface GroupService {
  readonly available: boolean;
  /** My groups with every member's pings on `day` (YYYY-MM-DD); 'error' when the server couldn't be asked. */
  list(day: string): Promise<Group[] | 'error'>;
  /**
   * The new group's id and invite slug, or null. `inviteSlug` is the one the
   * dialog already shows; only if it was taken (rare) does another replace it.
   */
  create(name: string, cover: number, inviteSlug?: string): Promise<{ id: string; inviteSlug: string } | null>;
  /** The group's id once joined (or already in it); null: no such group, or it's full. */
  join(slug: string): Promise<string | null | 'error'>;
  rename(id: string, name: string): Promise<boolean>;
  leave(id: string): Promise<boolean>;
  /** 추방 (the group's maker only, never themselves). */
  kick(id: string, userId: string): Promise<boolean>;
  /** 내 별명 in this group; '' clears it. */
  setAlias(id: string, alias: string): Promise<boolean>;
  /** 그룹 삭제, for everyone (the group's maker only). */
  remove(id: string): Promise<boolean>;
}

export function inviteUrl(slug: string, base = `${window.location.origin}${window.location.pathname}`): string {
  return `${base}#${INVITE_KEY}=${slug}`;
}

/** The invite slug of a group link (#g=<slug>) in `url`, or null. */
export function readInviteSlug(url: string): string | null {
  try {
    const slug = new URLSearchParams(new URL(url).hash.replace(/^#/, '')).get(INVITE_KEY);
    return slug && SLUG.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

function readPing(raw: unknown): GroupPing | null {
  if (!raw || typeof raw !== 'object') return null;
  const { at, center, name } = raw as Record<string, unknown>;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (!Array.isArray(center) || center.length !== 2 || !center.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const c: [number, number] = [center[0] as number, center[1] as number];
  if (!inKorea(c)) return null;
  const ping: GroupPing = { at: new Date(at).toISOString(), center: c };
  if (typeof name === 'string' && name.trim()) ping.name = name.trim().slice(0, 80);
  return ping;
}

function readMember(raw: unknown, photoUrl: (path: string) => string | null): GroupMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.user_id !== 'string' || !UUID.test(r.user_id)) return null;
  if (typeof r.slot !== 'number' || !Number.isInteger(r.slot) || r.slot < 0 || r.slot >= GROUP_LIMITS.members) return null;
  const alias = typeof r.alias === 'string' && r.alias.trim() ? r.alias.trim().slice(0, GROUP_LIMITS.alias) : null;
  const nickname = alias ?? (typeof r.nickname === 'string' && r.nickname.trim() ? r.nickname.trim().slice(0, 20) : '익명');
  // Only a photo in the avatars bucket's own <uuid>/avatar.jpg shape.
  const path = typeof r.avatar_path === 'string' && /^[0-9a-f-]{36}\/avatar\.jpg$/.test(r.avatar_path) ? r.avatar_path : null;
  const pings = (Array.isArray(r.pings) ? r.pings : [])
    .map(readPing)
    .filter((p): p is GroupPing => !!p)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-GROUP_LIMITS.pingsPerMember);
  return { userId: r.user_id, slot: r.slot, nickname, alias, photo: path ? photoUrl(path) : null, pings };
}

/** What my_groups returned, checked; bad rows are dropped. */
export function readGroups(raw: unknown, photoUrl: (path: string) => string | null): Group[] {
  if (!Array.isArray(raw)) return [];
  const groups: Group[] = [];
  for (const g of raw.slice(0, 30)) {
    if (!g || typeof g !== 'object') continue;
    const r = g as Record<string, unknown>;
    if (typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.invite_slug !== 'string' || !SLUG.test(r.invite_slug)) continue;
    const name = typeof r.name === 'string' ? cleanGroupName(r.name) : '';
    const cover = typeof r.cover === 'number' && Number.isInteger(r.cover) && r.cover >= 0 && r.cover < GROUP_LIMITS.covers ? r.cover : 0;
    const seen = new Set<string>();
    const members = (Array.isArray(r.members) ? r.members : [])
      .slice(0, GROUP_LIMITS.members)
      .map((m) => readMember(m, photoUrl))
      .filter((m): m is GroupMember => !!m && !seen.has(m.userId) && !!seen.add(m.userId))
      .sort((a, b) => a.slot - b.slot);
    groups.push({ id: r.id, name: name || '이름 없는 그룹', cover, inviteSlug: r.invite_slug, mine: r.mine === true, members });
  }
  return groups;
}

export function createSupabaseGroupService(
  getClient: () => Promise<SupabaseClient | null> = getSupabase,
  available = supabaseConfigured(),
  slug: () => string = newSlug,
): GroupService {
  return {
    available,

    async list(day) {
      try {
        const client = await getClient();
        if (!client || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'error';
        const { data, error } = await client.rpc('my_groups', { on_day: day });
        if (error) return 'error';
        return readGroups(data, (path) => client.storage.from('avatars').getPublicUrl(path).data.publicUrl || null);
      } catch {
        return 'error';
      }
    },

    async create(name, cover, wanted) {
      try {
        const clean = cleanGroupName(name);
        const client = await getClient();
        if (!client || !clean) return null;
        const safeCover = Number.isInteger(cover) && cover >= 0 && cover < GROUP_LIMITS.covers ? cover : 0;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const inviteSlug = attempt === 0 && wanted && SLUG.test(wanted) ? wanted : slug();
          const { data, error } = await client.rpc('create_group', { group_name: clean, group_cover: safeCover, slug: inviteSlug });
          if (!error) return typeof data === 'string' && UUID.test(data) ? { id: data, inviteSlug } : null;
          if (error.code !== UNIQUE_VIOLATION) return null;
        }
        return null;
      } catch {
        return null;
      }
    },

    async join(invite) {
      try {
        if (!SLUG.test(invite)) return null;
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('join_group', { slug: invite });
        if (error) return 'error';
        return typeof data === 'string' && UUID.test(data) ? data : null;
      } catch {
        return 'error';
      }
    },

    async rename(id, name) {
      try {
        const clean = cleanGroupName(name);
        const client = await getClient();
        if (!client || !clean) return false;
        const { data, error } = await client.rpc('rename_group', { gid: id, group_name: clean });
        return !error && data === true;
      } catch {
        return false;
      }
    },

    async leave(id) {
      try {
        const client = await getClient();
        if (!client) return false;
        const { error } = await client.rpc('leave_group', { gid: id });
        return !error;
      } catch {
        return false;
      }
    },

    async kick(id, userId) {
      try {
        const client = await getClient();
        if (!client || !UUID.test(userId)) return false;
        const { data, error } = await client.rpc('kick_group_member', { gid: id, member: userId });
        return !error && data === true;
      } catch {
        return false;
      }
    },

    async setAlias(id, alias) {
      try {
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('set_group_alias', { gid: id, new_alias: alias.trim().slice(0, GROUP_LIMITS.alias) });
        return !error && data === true;
      } catch {
        return false;
      }
    },

    async remove(id) {
      try {
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('delete_group', { gid: id });
        return !error && data === true;
      } catch {
        return false;
      }
    },
  };
}

const liveGroupService = createSupabaseGroupService();
export const groupService: GroupService = import.meta.env.DEV ? createGroupDemoService(liveGroupService) : liveGroupService;

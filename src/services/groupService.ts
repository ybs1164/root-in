import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanGroupName, GROUP_LIMITS, readPingDays, type Group, type GroupMember, type GroupPing, type PingDays } from '../domain/groups';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import { inKorea } from './pinShareService';
import { dataUrlToBlob } from './remoteProfileService';
import { newSlug } from './shareLinkService';
import { createGroupDemoService } from '../dev/groupDemoService';
import { COMMENT_MAX, type FeedItem, type GalleryPhoto, type MetPair, type PhotoComment } from '../domain/gallery';
import { publicAppUrl } from '../lib/appUrl';

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
const DAY = /^\d{4}-\d{2}-\d{2}$/;
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
  /**
   * My profile in this group: 통합 (`own` false — the profile's photo and
   * name) or 개별 (`alias` and `photo` of its own). `photo`: a new square
   * JPEG data URL, null to take it off, undefined to keep it.
   */
  setProfile(id: string, own: boolean, alias: string, photo?: string | null): Promise<boolean>;
  /** My colour in this group (`MEMBER_COLORS` index); false when it's someone else's or the server said no. */
  setColor(id: string, color: number): Promise<boolean>;
  /** 그룹 삭제, for everyone (the group's maker only). */
  remove(id: string): Promise<boolean>;
  /**
   * A camera photo (square JPEG data URL) with a ping of where it was taken,
   * to each of `groupIds`: uploaded once, then a row per group. How many
   * groups got it (0: none, e.g. the upload failed).
   */
  sendPhoto(groupIds: string[], ping: PhotoPing, photo: string): Promise<number>;
  /** Every photo sent to `groupIds` (I'm a member of), newest first; 'error' when the server couldn't be asked. */
  photos(groupIds: string[]): Promise<GalleryPhoto[] | 'error'>;
  /**
   * The group's calendar: who of its members pinged (or sent it a photo) on
   * each day from `from` to `to` (YYYY-MM-DD, at most 62 days), day → user ids;
   * 'error' when the server couldn't be asked.
   */
  pingDays(groupId: string, from: string, to: string): Promise<PingDays | 'error'>;
  /**
   * The gallery's 만난 날: on each of `days`, every pair of members of
   * `groupIds` who were at the same place (a ping or a photo each, within
   * `SAME_PLACE_M`); 'error' when the server couldn't be asked.
   */
  metDays(groupIds: string[], days: string[]): Promise<MetPair[] | 'error'>;
  /** A heart on a photo (by its upload `path`), or taken back; tells its sender. False when the server said no. */
  heart(path: string, on: boolean): Promise<boolean>;
  /** The photos I hearted (their paths); 'error' when the server couldn't be asked. */
  hearted(): Promise<string[] | 'error'>;
  /** Hearts on my photos not yet shown, newest first ([] when it couldn't ask). */
  heartNews(): Promise<HeartNews[]>;
  /** Shown: the hearts up to `upto` (an `at`) stop coming back. */
  heartsSeen(upto: string): Promise<boolean>;
  /** A photo's comments (by its upload `path`), oldest first; 'error' when the server couldn't be asked. */
  comments(path: string): Promise<PhotoComment[] | 'error'>;
  /** A comment on a photo of a group of mine; false when the server said no. */
  comment(path: string, body: string): Promise<boolean>;
  /** A group's 대화 (its photos, their comments, its messages), oldest first; 'error' when the server couldn't be asked. */
  feed(groupId: string): Promise<FeedItem[] | 'error'>;
  /** A message in a group's 대화; false when the server said no. */
  sendMessage(groupId: string, body: string): Promise<boolean>;
}


/** Someone hearted one of my photos. */
export interface HeartNews {
  path: string;
  fromUser: string;
  /** Their name in a group we share, else their nickname. */
  nickname: string;
  /** Where the photo was taken, when known. */
  place: string | null;
  at: string;
}

/** How many photos a gallery reads at most (the newest). */
export const GALLERY_LIMIT = 600;

/** Where a camera photo was taken: the ping that goes with it. */
export interface PhotoPing {
  /** The phone's local date (YYYY-MM-DD), the day screen it belongs to. */
  day: string;
  at: string;
  center: [number, number];
  name: string;
}

const PHOTO_BUCKET = 'group-photos';
const AVATAR_BUCKET = 'avatars';
/** A group's own profile photo: <uuid>/g<random>.jpg in the avatars bucket. */
const GROUP_AVATAR = /^[0-9a-f-]{36}\/g[A-Za-z0-9_-]{6,40}\.jpg$/;
const AVATAR_PATH = /^[0-9a-f-]{36}\/(avatar|g[A-Za-z0-9_-]{6,40})\.jpg$/;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{6,40}\.jpg$/;

export function inviteUrl(slug: string, base = publicAppUrl()): string {
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

function readPing(raw: unknown, photoUrl: (path: string) => string | null): GroupPing | null {
  if (!raw || typeof raw !== 'object') return null;
  const { at, center, name, photo } = raw as Record<string, unknown>;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (!Array.isArray(center) || center.length !== 2 || !center.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const c: [number, number] = [center[0] as number, center[1] as number];
  if (!inKorea(c)) return null;
  const ping: GroupPing = { at: new Date(at).toISOString(), center: c };
  if (typeof name === 'string' && name.trim()) ping.name = name.trim().slice(0, 80);
  // Only a path in the group-photos bucket's own <uuid>/<id>.jpg shape.
  const url = typeof photo === 'string' && PHOTO_PATH.test(photo) ? photoUrl(photo) : null;
  if (url) ping.photo = url;
  return ping;
}

function readMember(raw: unknown, photoUrl: (path: string) => string | null, pingPhotoUrl: (path: string) => string | null): GroupMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.user_id !== 'string' || !UUID.test(r.user_id)) return null;
  if (typeof r.slot !== 'number' || !Number.isInteger(r.slot) || r.slot < 0 || r.slot >= GROUP_LIMITS.members) return null;
  const alias = typeof r.alias === 'string' && r.alias.trim() ? r.alias.trim().slice(0, GROUP_LIMITS.alias) : null;
  const nickname = alias ?? (typeof r.nickname === 'string' && r.nickname.trim() ? r.nickname.trim().slice(0, 20) : '익명');
  // Only a photo in the avatars bucket's own shapes: <uuid>/avatar.jpg, or a group's <uuid>/g<random>.jpg.
  const path = typeof r.avatar_path === 'string' && AVATAR_PATH.test(r.avatar_path) ? r.avatar_path : null;
  const pings = (Array.isArray(r.pings) ? r.pings : [])
    .map((p) => readPing(p, pingPhotoUrl))
    .filter((p): p is GroupPing => !!p)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-GROUP_LIMITS.pingsPerMember);
  // Before the colour had its own column it followed the slot.
  const color = typeof r.color === 'number' && Number.isInteger(r.color) && r.color >= 0 && r.color < GROUP_LIMITS.members ? r.color : r.slot;
  const member: GroupMember = { userId: r.user_id, slot: r.slot, color, nickname, alias, photo: path ? photoUrl(path) : null, pings };
  if (r.own_profile === true) member.ownProfile = true;
  // Sent for my own row alone.
  if ('group_alias' in r || 'group_photo' in r) {
    const stored = typeof r.group_alias === 'string' && r.group_alias.trim() ? r.group_alias.trim().slice(0, GROUP_LIMITS.alias) : null;
    const photo = typeof r.group_photo === 'string' && GROUP_AVATAR.test(r.group_photo) ? photoUrl(r.group_photo) : null;
    member.groupProfile = { alias: stored, photo };
  }
  return member;
}

/** heart_news' rows, checked; anything off is skipped. */
export function readHeartNews(data: unknown): HeartNews[] {
  if (!Array.isArray(data)) return [];
  const news: HeartNews[] = [];
  for (const row of data.slice(0, 50)) {
    const r = (row ?? {}) as Record<string, unknown>;
    if (typeof r.path !== 'string' || !PHOTO_PATH.test(r.path) || typeof r.from_user !== 'string' || !UUID.test(r.from_user)) continue;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) continue;
    const nickname = typeof r.nickname === 'string' && r.nickname.trim() ? r.nickname.trim().slice(0, 20) : '누군가';
    const place = typeof r.place === 'string' && r.place.trim() ? r.place.trim().slice(0, 80) : null;
    news.push({ path: r.path, fromUser: r.from_user, nickname, place, at: r.at });
  }
  return news;
}

/** photo_comments' rows, checked; anything off is skipped. */
export function readComments(data: unknown): PhotoComment[] {
  if (!Array.isArray(data)) return [];
  const comments: PhotoComment[] = [];
  for (const row of data.slice(0, 200)) {
    const r = (row ?? {}) as Record<string, unknown>;
    if (typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.body !== 'string' || !r.body.trim()) continue;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) continue;
    const nickname = typeof r.nickname === 'string' && r.nickname.trim() ? r.nickname.trim().slice(0, 20) : '누군가';
    comments.push({ id: r.id, nickname, body: r.body.trim().slice(0, COMMENT_MAX), at: r.at, mine: r.mine === true });
  }
  return comments;
}

/** group_feed's rows (newest first), checked and turned oldest first; anything off is skipped. */
export function readFeed(data: unknown, photoUrl: (path: string) => string | null): FeedItem[] {
  if (!Array.isArray(data)) return [];
  const items: FeedItem[] = [];
  for (const row of data.slice(0, 300)) {
    const r = (row ?? {}) as Record<string, unknown>;
    if (r.kind !== 'photo' && r.kind !== 'comment' && r.kind !== 'message') continue;
    if (typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.user_id !== 'string' || !UUID.test(r.user_id)) continue;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) continue;
    const item: FeedItem = { kind: r.kind, id: r.id, userId: r.user_id, at: new Date(r.at).toISOString(), mine: r.mine === true };
    if (r.kind !== 'photo') {
      if (typeof r.body !== 'string' || !r.body.trim()) continue;
      item.body = r.body.trim().slice(0, COMMENT_MAX);
    }
    if (r.kind !== 'message') {
      if (typeof r.path !== 'string' || !PHOTO_PATH.test(r.path)) continue;
      item.path = r.path;
      const url = photoUrl(r.path);
      if (url) item.photo = url;
      if (typeof r.place === 'string' && r.place.trim()) item.place = r.place.trim().slice(0, 80);
    }
    items.push(item);
  }
  return items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** group_met_days' rows, checked; anything off is skipped. */
export function readMetPairs(data: unknown): MetPair[] {
  if (!Array.isArray(data)) return [];
  const pairs: MetPair[] = [];
  for (const row of data.slice(0, 30 * 400 * 10)) {
    const r = (row ?? {}) as Record<string, unknown>;
    const ids = [r.group_id, r.user_a, r.user_b];
    if (!ids.every((id) => typeof id === 'string' && UUID.test(id)) || typeof r.day !== 'string' || !DAY.test(r.day)) continue;
    pairs.push({ groupId: r.group_id as string, day: r.day, users: [r.user_a as string, r.user_b as string] });
  }
  return pairs;
}

/** A group_photos row, checked; null when anything's off. */
export function readGalleryPhoto(raw: unknown, photoUrl: (path: string) => string | null): GalleryPhoto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.group_id !== 'string' || !UUID.test(r.group_id)) return null;
  if (typeof r.user_id !== 'string' || !UUID.test(r.user_id)) return null;
  if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return null;
  if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
  if (typeof r.path !== 'string' || !PHOTO_PATH.test(r.path)) return null;
  const url = photoUrl(r.path);
  if (!url) return null;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 80) : '이름 없는 곳';
  return { id: r.id, groupId: r.group_id, userId: r.user_id, day: r.day, at: new Date(r.at).toISOString(), name, path: r.path, url };
}

/**
 * What my_groups returned, checked; bad rows are dropped. `photoUrl` makes a
 * profile photo's address (avatars), `pingPhotoUrl` a sent photo's (group-photos).
 */
export function readGroups(raw: unknown, photoUrl: (path: string) => string | null, pingPhotoUrl: (path: string) => string | null = () => null): Group[] {
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
      .map((m) => readMember(m, photoUrl, pingPhotoUrl))
      .filter((m): m is GroupMember => !!m && !seen.has(m.userId) && !!seen.add(m.userId))
      .sort((a, b) => a.slot - b.slot);
    const group: Group = { id: r.id, name: name || '이름 없는 그룹', cover, inviteSlug: r.invite_slug, mine: r.mine === true, members };
    if (typeof r.created_at === 'string' && !Number.isNaN(Date.parse(r.created_at))) group.createdAt = new Date(r.created_at).toISOString();
    groups.push(group);
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
        return readGroups(
          data,
          (path) => client.storage.from('avatars').getPublicUrl(path).data.publicUrl || null,
          (path) => client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl || null,
        );
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

    async setProfile(id, own, alias, photo) {
      try {
        const name = alias.trim().slice(0, GROUP_LIMITS.alias);
        if (!UUID.test(id) || (own && !name)) return false;
        const client = await getClient();
        if (!client) return false;
        const bucket = client.storage.from(AVATAR_BUCKET);
        let path: string | null = null;
        if (photo) {
          const blob = dataUrlToBlob(photo);
          const { data: session } = await client.auth.getSession();
          const userId = session.session?.user.id;
          if (!blob || !userId) return false;
          // A new name each time, so no one's cached copy of the old one shows.
          path = `${userId}/g${slug()}${slug()}.jpg`;
          const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
          if (error) return false;
        }
        const { data, error } = await client.rpc('set_group_profile', {
          gid: id, own, new_alias: name, new_photo: photo === undefined ? null : (path ?? ''),
        });
        const ok = !error && !!data && (data as { ok?: unknown }).ok === true;
        if (!ok) {
          if (path) await bucket.remove([path]);
          return false;
        }
        const old = (data as { old_photo?: unknown }).old_photo;
        if (typeof old === 'string' && GROUP_AVATAR.test(old)) await bucket.remove([old]);
        return true;
      } catch {
        return false;
      }
    },

    async setColor(id, color) {
      try {
        const client = await getClient();
        if (!client || !Number.isInteger(color) || color < 0 || color >= GROUP_LIMITS.members) return false;
        const { data, error } = await client.rpc('set_group_color', { gid: id, new_color: color });
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

    async sendPhoto(groupIds, ping, photo) {
      try {
        const ids = [...new Set(groupIds)].filter((id) => UUID.test(id)).slice(0, 30);
        const name = ping.name.trim().slice(0, 80);
        if (!ids.length || !name || !inKorea(ping.center) || !/^\d{4}-\d{2}-\d{2}$/.test(ping.day)) return 0;
        const blob = dataUrlToBlob(photo);
        const client = await getClient();
        if (!blob || !client) return 0;
        const { data: session } = await client.auth.getSession();
        const userId = session.session?.user.id;
        if (!userId) return 0;
        const path = `${userId}/${slug()}${slug()}.jpg`;
        const { error: upload } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (upload) return 0;
        const { data, error } = await client.rpc('send_group_photo', {
          gids: ids, on_day: ping.day, at_time: ping.at, ping_center: ping.center, place_name: name, photo_path: path,
        });
        if (error || typeof data !== 'number' || data < 1) {
          // Nobody will ever see it: don't leave it in the bucket.
          await client.storage.from(PHOTO_BUCKET).remove([path]);
          return 0;
        }
        return data;
      } catch {
        return 0;
      }
    },

    async metDays(groupIds, days) {
      try {
        const gids = groupIds.filter((id) => UUID.test(id)).slice(0, 30);
        const asked = [...new Set(days.filter((d) => DAY.test(d)))].slice(0, 400);
        if (!gids.length || !asked.length) return [];
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('group_met_days', { gids, days: asked });
        if (error) return 'error';
        return readMetPairs(data);
      } catch {
        return 'error';
      }
    },

    async heart(path, on) {
      try {
        if (!PHOTO_PATH.test(path)) return false;
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('heart_photo', { photo_path: path, heart: on });
        return !error && data === true;
      } catch {
        return false;
      }
    },

    async hearted() {
      try {
        const client = await getClient();
        if (!client) return 'error';
        // Its policy only lets me read my own hearts.
        const { data, error } = await client.from('photo_hearts').select('path').limit(2000);
        if (error || !Array.isArray(data)) return 'error';
        return data.map((r) => (r as { path?: unknown }).path).filter((p): p is string => typeof p === 'string' && PHOTO_PATH.test(p));
      } catch {
        return 'error';
      }
    },

    async heartNews() {
      try {
        const client = await getClient();
        if (!client) return [];
        const { data, error } = await client.rpc('heart_news');
        return error ? [] : readHeartNews(data);
      } catch {
        return [];
      }
    },

    async heartsSeen(upto) {
      try {
        if (Number.isNaN(Date.parse(upto))) return false;
        const client = await getClient();
        if (!client) return false;
        const { error } = await client.rpc('hearts_seen', { upto });
        return !error;
      } catch {
        return false;
      }
    },

    async comments(path) {
      try {
        if (!PHOTO_PATH.test(path)) return 'error';
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('photo_comments', { photo_path: path });
        return error ? 'error' : readComments(data);
      } catch {
        return 'error';
      }
    },

    async comment(path, body) {
      try {
        const text = body.trim();
        if (!PHOTO_PATH.test(path) || !text || text.length > COMMENT_MAX) return false;
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('comment_photo', { photo_path: path, comment: text });
        return !error && typeof data === 'string';
      } catch {
        return false;
      }
    },

    async feed(groupId) {
      try {
        if (!UUID.test(groupId)) return 'error';
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('group_feed', { gid: groupId });
        if (error) return 'error';
        return readFeed(data, (path) => client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl || null);
      } catch {
        return 'error';
      }
    },

    async sendMessage(groupId, body) {
      try {
        const text = body.trim();
        if (!UUID.test(groupId) || !text || text.length > COMMENT_MAX) return false;
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('send_group_message', { gid: groupId, message: text });
        return !error && typeof data === 'string';
      } catch {
        return false;
      }
    },

    async pingDays(groupId, from, to) {
      try {
        if (!UUID.test(groupId) || !DAY.test(from) || !DAY.test(to)) return 'error';
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('group_ping_days', { gid: groupId, from_day: from, to_day: to });
        if (error) return 'error';
        return readPingDays(data);
      } catch {
        return 'error';
      }
    },

    async photos(groupIds) {
      try {
        const ids = [...new Set(groupIds)].filter((id) => UUID.test(id)).slice(0, 30);
        if (!ids.length) return [];
        const client = await getClient();
        if (!client) return 'error';
        // Read straight from the table: its policy lets members read their groups' rows.
        const { data, error } = await client
          .from('group_photos')
          .select('id, group_id, user_id, day, at, name, path')
          .in('group_id', ids)
          .order('at', { ascending: false })
          .limit(GALLERY_LIMIT);
        if (error || !Array.isArray(data)) return 'error';
        const url = (path: string) => client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl || null;
        return data.map((r) => readGalleryPhoto(r, url)).filter((p): p is GalleryPhoto => !!p);
      } catch {
        return 'error';
      }
    },
  };
}

const liveGroupService = createSupabaseGroupService();
export const groupService: GroupService = import.meta.env.DEV ? createGroupDemoService(liveGroupService) : liveGroupService;

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import type { SharedCourse } from '../types/course';
import { decodeSharedCourse, MAX_TOKEN_LENGTH } from './courseShareService';

// 짧은 공유 링크 (#s=<slug>) and how often each was opened. The server row
// holds the very token a long #share= link carries, so what comes back is
// decoded and checked like any received link. Never rejects.

const SLUG_KEY = 's';
const SLUG = /^[A-Za-z0-9_-]{6,16}$/;
const SLUG_LENGTH = 10;
const SLUG_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// Postgres unique_violation: the random slug was taken (rare); try another.
const UNIQUE_VIOLATION = '23505';

export interface ShareSender {
  nickname: string;
  handle: string | null;
  /** Public URL of their profile photo, or null. */
  photo: string | null;
}

export interface OpenedShare {
  course: SharedCourse;
  /** Times opened by others, this open included. */
  openCount: number;
  sender: ShareSender;
}

export interface ShareLinkService {
  readonly available: boolean;
  /** A short link to this route's snapshot (the same link again if nothing changed); null on failure. */
  create(userId: string, courseId: string, token: string): Promise<string | null>;
  /** null: no such link (or a broken one); 'error': couldn't ask. */
  open(slug: string, count: boolean): Promise<OpenedShare | null | 'error'>;
  /** Course id → times its links were opened, over all of this user's links. */
  counts(userId: string): Promise<Map<string, number> | 'error'>;
}

export function shortLinkUrl(slug: string, base = `${window.location.origin}${window.location.pathname}`): string {
  return `${base}#${SLUG_KEY}=${slug}`;
}

/** The slug of a short link in `url`, or null. */
export function readShortSlug(url: string): string | null {
  try {
    const slug = new URLSearchParams(new URL(url).hash.replace(/^#/, '')).get(SLUG_KEY);
    return slug && SLUG.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

export function newSlug(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(SLUG_LENGTH)].map((b) => SLUG_CHARS[b % SLUG_CHARS.length]).join('');
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, 1_000_000_000) : 0);

/** What open_share returned, checked: the snapshot like any received link. */
export function readOpened(raw: unknown, photoUrl: (path: string) => string | null): OpenedShare | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { snapshot?: { token?: unknown }; open_count?: unknown; owner?: Record<string, unknown> };
  const token = r.snapshot?.token;
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null;
  const course = decodeSharedCourse(token);
  if (!course) return null;
  const owner = r.owner ?? {};
  const nickname = typeof owner.nickname === 'string' ? owner.nickname.trim().slice(0, 20) : '';
  const handle = typeof owner.handle === 'string' && /^[a-z0-9._-]{3,20}$/.test(owner.handle) ? owner.handle : null;
  // Only a photo in the avatars bucket's own <uuid>/avatar.jpg shape.
  const path = typeof owner.avatar_path === 'string' && /^[0-9a-f-]{36}\/avatar\.jpg$/.test(owner.avatar_path) ? owner.avatar_path : null;
  return { course, openCount: count(r.open_count), sender: { nickname, handle, photo: path ? photoUrl(path) : null } };
}

export function createSupabaseShareLinkService(
  getClient: () => Promise<SupabaseClient | null> = getSupabase,
  available = supabaseConfigured(),
): ShareLinkService {
  return {
    available,

    async create(userId, courseId, token) {
      try {
        const client = await getClient();
        if (!client || token.length > MAX_TOKEN_LENGTH) return null;
        // The same route, unchanged, keeps its link (and the count stays on one row).
        const { data: existing } = await client
          .from('shares')
          .select('slug')
          .eq('owner_id', userId)
          .eq('course_id', courseId)
          .eq('snapshot->>token', token)
          .limit(1)
          .maybeSingle();
        if (existing && typeof existing.slug === 'string' && SLUG.test(existing.slug)) return shortLinkUrl(existing.slug);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const slug = newSlug();
          const { error } = await client.from('shares').insert({ slug, owner_id: userId, course_id: courseId, snapshot: { token } });
          if (!error) return shortLinkUrl(slug);
          if (error.code !== UNIQUE_VIOLATION) return null;
        }
        return null;
      } catch {
        return null;
      }
    },

    async open(slug, countOpen) {
      try {
        if (!SLUG.test(slug)) return null;
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('open_share', { share_slug: slug, count_open: countOpen });
        if (error) return 'error';
        return readOpened(data, (path) => client.storage.from('avatars').getPublicUrl(path).data.publicUrl || null);
      } catch {
        return 'error';
      }
    },

    async counts(userId) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.from('shares').select('course_id, open_count').eq('owner_id', userId);
        if (error || !Array.isArray(data)) return 'error';
        const totals = new Map<string, number>();
        for (const row of data as { course_id?: unknown; open_count?: unknown }[]) {
          if (typeof row.course_id !== 'string') continue;
          totals.set(row.course_id, (totals.get(row.course_id) ?? 0) + count(row.open_count));
        }
        return totals;
      } catch {
        return 'error';
      }
    },
  };
}

export const shareLinkService: ShareLinkService = createSupabaseShareLinkService();

// Links this browser has opened: opening one again doesn't count it again.
const OPENED_KEY = 'goodroot:opened-shares:v1';
const OPENED_MAX = 200;

export function hasOpened(slug: string): boolean {
  try {
    const list = JSON.parse(window.localStorage.getItem(OPENED_KEY) ?? '[]') as unknown;
    return Array.isArray(list) && list.includes(slug);
  } catch {
    return false;
  }
}

export function rememberOpened(slug: string): void {
  try {
    const raw = JSON.parse(window.localStorage.getItem(OPENED_KEY) ?? '[]') as unknown;
    const list = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s !== slug) : [];
    window.localStorage.setItem(OPENED_KEY, JSON.stringify([slug, ...list].slice(0, OPENED_MAX)));
  } catch {
    // Not remembered: opening it again just counts again.
  }
}

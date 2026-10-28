import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategorySnapshot, SharedPlace } from '../domain/categoryShare';
import { PIN_LIMITS } from '../domain/pin';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import { parseCategory, parseWirePlace, wirePlace, type WireCategory, type WirePin } from './pinShareService';
import { newSlug } from './shareLinkService';
import { publicAppUrl } from '../lib/appUrl';

// 카테고리 구독 links (#c=<slug>, supabase/migrations/20261023000000_category_shares.sql).
// The owner's phone writes the category's snapshot to its row whenever it
// changes; anyone with the link reads it through open_category_share. What
// comes back is checked like any received link. Never rejects.

const SLUG_KEY = 'c';
const SLUG = /^[A-Za-z0-9_-]{6,16}$/;
const UNIQUE_VIOLATION = '23505';
const SNAPSHOT_VERSION = 1;

interface WireSnapshot {
  v: 1;
  c: WireCategory;
  p: Omit<WirePin, 'k'>[];
}

export interface CategorySharer {
  nickname: string;
  /** Public URL of their profile photo, or null. */
  photo: string | null;
}

export interface OpenedCategory {
  snapshot: CategorySnapshot;
  owner: CategorySharer;
  /** The link is my own (opened on the owner's account). */
  mine: boolean;
}

export interface CategoryShareService {
  readonly available: boolean;
  /** My shared categories: category id → slug (links still live). */
  mine(userId: string): Promise<Map<string, string> | 'error'>;
  /** Writes the category's snapshot to its link, making the link the first time; the slug, or null on failure. */
  publish(userId: string, categoryId: string, snapshot: CategorySnapshot): Promise<string | null>;
  /** 공유 중지: the link stops working (followers keep what they have). */
  stop(userId: string, categoryId: string): Promise<boolean>;
  /** null: no such link, or sharing stopped; 'error': couldn't ask. */
  open(slug: string): Promise<OpenedCategory | null | 'error'>;
}

export function categoryLinkUrl(slug: string, base = publicAppUrl()): string {
  return `${base}#${SLUG_KEY}=${slug}`;
}

/** The slug of a category link in `url`, or null. */
export function readCategorySlug(url: string): string | null {
  try {
    const slug = new URLSearchParams(new URL(url).hash.replace(/^#/, '')).get(SLUG_KEY);
    return slug && SLUG.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

/** Removes the `#c=…` fragment without adding a history entry. */
export function clearCategoryFromLocation(): void {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete(SLUG_KEY);
  const rest = params.toString();
  window.history.replaceState(null, '', `${url.pathname}${url.search}${rest ? `#${rest}` : ''}`);
}

export function encodeCategorySnapshot(snapshot: CategorySnapshot): WireSnapshot {
  const { name, icon, color } = snapshot.category;
  return {
    v: SNAPSHOT_VERSION,
    c: { n: name, ic: icon, co: color },
    p: snapshot.places.slice(0, PIN_LIMITS.maxPins).map((p) => wirePlace(p.place, p.memo)),
  };
}

/** A snapshot from the server, checked field by field; null when it isn't one. */
export function decodeCategorySnapshot(raw: unknown): CategorySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const wire = raw as Partial<WireSnapshot>;
  if (wire.v !== SNAPSHOT_VERSION || !Array.isArray(wire.p) || wire.p.length > PIN_LIMITS.maxPins) return null;
  const category = parseCategory(wire.c);
  if (!category) return null;
  const places: SharedPlace[] = [];
  const seen = new Set<string>();
  // One bad place drops that place, not the whole category: the owner's list keeps coming.
  for (const item of wire.p) {
    const place = parseWirePlace(item);
    if (!place || seen.has(place.place.id)) continue;
    seen.add(place.place.id);
    places.push(place);
  }
  return { category, places };
}

/** What open_category_share returned, checked. */
export function readOpenedCategory(raw: unknown, photoUrl: (path: string) => string | null): OpenedCategory | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { snapshot?: unknown; mine?: unknown; owner?: Record<string, unknown> };
  const snapshot = decodeCategorySnapshot(r.snapshot);
  if (!snapshot) return null;
  const owner = r.owner ?? {};
  const nickname = typeof owner.nickname === 'string' ? owner.nickname.trim().slice(0, 20) : '';
  // Only a photo in the avatars bucket's own <uuid>/avatar.jpg shape.
  const path = typeof owner.avatar_path === 'string' && /^[0-9a-f-]{36}\/avatar\.jpg$/.test(owner.avatar_path) ? owner.avatar_path : null;
  return { snapshot, owner: { nickname, photo: path ? photoUrl(path) : null }, mine: r.mine === true };
}

export function createSupabaseCategoryShareService(
  getClient: () => Promise<SupabaseClient | null> = getSupabase,
  available = supabaseConfigured(),
): CategoryShareService {
  return {
    available,

    async mine(userId) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client
          .from('category_shares')
          .select('slug, category_id')
          .eq('owner_id', userId)
          .is('revoked_at', null);
        if (error || !Array.isArray(data)) return 'error';
        const links = new Map<string, string>();
        for (const row of data as { slug?: unknown; category_id?: unknown }[]) {
          if (typeof row.category_id === 'string' && typeof row.slug === 'string' && SLUG.test(row.slug)) links.set(row.category_id, row.slug);
        }
        return links;
      } catch {
        return 'error';
      }
    },

    async publish(userId, categoryId, snapshot) {
      try {
        const client = await getClient();
        if (!client) return null;
        const wire = encodeCategorySnapshot(snapshot);
        const { data: existing } = await client
          .from('category_shares')
          .select('slug')
          .eq('owner_id', userId)
          .eq('category_id', categoryId)
          .is('revoked_at', null)
          .limit(1)
          .maybeSingle();
        if (existing && typeof existing.slug === 'string' && SLUG.test(existing.slug)) {
          const { error } = await client.from('category_shares').update({ snapshot: wire }).eq('slug', existing.slug).eq('owner_id', userId);
          return error ? null : existing.slug;
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const slug = newSlug();
          const { error } = await client.from('category_shares').insert({ slug, owner_id: userId, category_id: categoryId, snapshot: wire });
          if (!error) return slug;
          if (error.code !== UNIQUE_VIOLATION) return null;
        }
        return null;
      } catch {
        return null;
      }
    },

    async stop(userId, categoryId) {
      try {
        const client = await getClient();
        if (!client) return false;
        const { error } = await client
          .from('category_shares')
          .update({ revoked_at: new Date().toISOString() })
          .eq('owner_id', userId)
          .eq('category_id', categoryId)
          .is('revoked_at', null);
        return !error;
      } catch {
        return false;
      }
    },

    async open(slug) {
      try {
        if (!SLUG.test(slug)) return null;
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.rpc('open_category_share', { share_slug: slug });
        if (error) return 'error';
        return readOpenedCategory(data, (path) => client.storage.from('avatars').getPublicUrl(path).data.publicUrl || null);
      } catch {
        return 'error';
      }
    },
  };
}

export const categoryShareService: CategoryShareService = createSupabaseCategoryShareService();

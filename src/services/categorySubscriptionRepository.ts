import type { CategorySubscription } from '../domain/categoryShare';
import { PIN_LIMITS } from '../domain/pin';
import { parseCategory } from './pinShareService';

// Categories I follow (카테고리 구독), on this device only: the category and
// its pins are ordinary ones (and sync like any), but which link keeps them
// in step is kept here.
const KEY = 'goodroot:category-subs:v1';
const SLUG = /^[A-Za-z0-9_-]{6,16}$/;

function readSubscription(raw: unknown): CategorySubscription | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const stored = (r.look ?? {}) as Record<string, unknown>;
  const look = parseCategory({ n: stored.name, ic: stored.icon, co: stored.color });
  if (typeof r.slug !== 'string' || !SLUG.test(r.slug) || typeof r.categoryId !== 'string' || !look) return null;
  const added = Array.isArray(r.added) ? r.added.filter((id): id is string => typeof id === 'string').slice(0, PIN_LIMITS.maxPins) : [];
  return { slug: r.slug, categoryId: r.categoryId, owner: typeof r.owner === 'string' ? r.owner.slice(0, 20) : '', look, added };
}

export function loadSubscriptions(): CategorySubscription[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const subs = raw.map(readSubscription).filter((s): s is CategorySubscription => s !== null);
    // One per link and one per category.
    return subs.filter((s, i) => subs.findIndex((o) => o.slug === s.slug || o.categoryId === s.categoryId) === i);
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs: CategorySubscription[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(subs));
  } catch {
    // Storage full/disabled: the subscription lasts until reload.
  }
}

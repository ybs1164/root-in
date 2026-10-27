import { useCallback, useEffect, useRef, useState } from 'react';
import {
  categorySnapshot,
  followCategory,
  subscribeCategory,
  type CategorySubscription,
  type PinState,
} from '../domain/categoryShare';
import type { ExcludedPlace } from '../domain/privacy';
import {
  categoryShareService,
  clearCategoryFromLocation,
  encodeCategorySnapshot,
  readCategorySlug,
  type CategoryShareService,
  type OpenedCategory,
} from '../services/categoryShareService';
import { loadSubscriptions, saveSubscriptions } from '../services/categorySubscriptionRepository';
import type { Pin, PinCategory } from '../types/pin';

/** Owner edits settle this long before the snapshot goes up (a run of edits is one write). */
const PUBLISH_DELAY_MS = 2000;
/** How often followed categories are read again while the app is in front. */
const REFRESH_MS = 5 * 60 * 1000;

type Transform = (
  fn: (state: PinState, make: { pin: () => Pick<Pin, 'id' | 'userId' | 'createdAt'>; categoryId: () => string }) => PinState | null,
) => boolean;

/**
 * My shared categories (카테고리 공유): which have a live link, and their
 * snapshots kept up to date — every change to one of them (its pins, its
 * look, the 제외 주소) is published a moment later, so followers get it.
 */
export function useSharedCategories(
  userId: string | null,
  pins: Pin[],
  categories: PinCategory[],
  excluded: ExcludedPlace[],
  service: CategoryShareService = categoryShareService,
) {
  // Category id → slug, for the signed-in account.
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  // What each link last got (its wire JSON), so an unchanged one isn't written again.
  const published = useRef(new Map<string, string>());

  useEffect(() => {
    setLinks(new Map());
    published.current = new Map();
    if (!userId || !service.available) return;
    let alive = true;
    void service.mine(userId).then((mine) => {
      if (alive && mine !== 'error') setLinks(mine);
    });
    return () => {
      alive = false;
    };
  }, [userId, service]);

  useEffect(() => {
    if (!userId || links.size === 0) return;
    const timer = window.setTimeout(() => {
      for (const categoryId of links.keys()) {
        // Not here (still loading, or deleted — the server revokes a deleted category's link itself): leave it.
        const category = categories.find((c) => c.id === categoryId);
        if (!category) continue;
        const { snapshot } = categorySnapshot(category, pins, excluded);
        const wire = JSON.stringify(encodeCategorySnapshot(snapshot));
        if (published.current.get(categoryId) === wire) continue;
        published.current.set(categoryId, wire);
        void service.publish(userId, categoryId, snapshot).then((slug) => {
          if (!slug) published.current.delete(categoryId); // tried again on the next change
        });
      }
    }, PUBLISH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userId, links, pins, categories, excluded, service]);

  /** Shares `category` (or re-reads its live link): the slug and how many 제외 주소 places were left out; null on failure. */
  const share = useCallback(
    async (owner: string, category: PinCategory): Promise<{ slug: string; removed: number } | null> => {
      const { snapshot, removed } = categorySnapshot(category, pins, excluded);
      const slug = await service.publish(owner, category.id, snapshot);
      if (!slug) return null;
      published.current.set(category.id, JSON.stringify(encodeCategorySnapshot(snapshot)));
      setLinks((was) => new Map(was).set(category.id, slug));
      return { slug, removed };
    },
    [pins, excluded, service],
  );

  const stop = useCallback(
    async (owner: string, categoryId: string): Promise<boolean> => {
      const ok = await service.stop(owner, categoryId);
      if (ok) {
        published.current.delete(categoryId);
        setLinks((was) => {
          const next = new Map(was);
          next.delete(categoryId);
          return next;
        });
      }
      return ok;
    },
    [service],
  );

  return { links, share, stop };
}

/**
 * Categories I follow (카테고리 구독): read again on start, when the app
 * comes back to the front and every few minutes, and my copy brought in step.
 * `onEnded`: the owner stopped sharing (or deleted it); what I got stays.
 */
export function useCategorySubscriptions(
  transform: Transform,
  onEnded: (categoryId: string) => void,
  service: CategoryShareService = categoryShareService,
) {
  const [subs, setSubs] = useState<CategorySubscription[]>(loadSubscriptions);
  const subsRef = useRef(subs);
  const commit = useCallback((next: CategorySubscription[]) => {
    subsRef.current = next;
    setSubs(next);
    saveSubscriptions(next);
  }, []);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  const replace = useCallback(
    (slug: string, next: CategorySubscription | null) =>
      commit(next ? subsRef.current.map((s) => (s.slug === slug ? next : s)) : subsRef.current.filter((s) => s.slug !== slug)),
    [commit],
  );

  /** One subscription in step with what its link holds now. */
  const apply = useCallback(
    (slug: string, opened: OpenedCategory) => {
      transform((state, make) => {
        const sub = subsRef.current.find((s) => s.slug === slug);
        if (!sub) return null;
        const result = followCategory(state, { ...sub, owner: opened.owner.nickname || sub.owner }, opened.snapshot, make.pin);
        if (result.gone) {
          replace(slug, null); // I deleted the category: nothing left to follow into
          return null;
        }
        if (result.sub !== sub) replace(slug, result.sub);
        return result.changed ? result.state : null;
      });
    },
    [transform, replace],
  );

  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (!service.available || busy.current) return;
    busy.current = true;
    try {
      for (const sub of subsRef.current) {
        const opened = await service.open(sub.slug);
        if (opened === 'error') continue;
        if (opened === null) {
          replace(sub.slug, null);
          endedRef.current(sub.categoryId);
          continue;
        }
        apply(sub.slug, opened);
      }
    } finally {
      busy.current = false;
    }
  }, [service, apply, replace]);

  useEffect(() => {
    // After the pins have loaded (usePins reads them in an effect too).
    const first = window.setTimeout(() => void refresh(), 1500);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /** 구독: 'added' with the new category's id, 'already' (then it's brought up to date), 'too-many', or 'not-ready' (pins still loading). */
  const subscribe = useCallback(
    (
      slug: string,
      opened: OpenedCategory,
    ): { result: 'added' | 'already'; categoryId: string; places: number } | { result: 'too-many' | 'not-ready' } => {
      const existing = subsRef.current.find((s) => s.slug === slug);
      if (existing) {
        apply(slug, opened);
        return { result: 'already', categoryId: existing.categoryId, places: opened.snapshot.places.length };
      }
      let made: { result: 'added'; categoryId: string; places: number } | { result: 'too-many' | 'not-ready' } = { result: 'too-many' };
      const ran = transform((state, make) => {
        const result = subscribeCategory(state, slug, opened.owner.nickname, opened.snapshot, make.categoryId, make.pin);
        if ('problem' in result) return null;
        commit([...subsRef.current, result.sub]);
        made = { result: 'added', categoryId: result.sub.categoryId, places: result.sub.added.length };
        return result.state;
      });
      return ran ? made : { result: 'not-ready' };
    },
    [transform, apply, commit],
  );

  /** 구독 취소: the category and its pins stay mine, they just stop following. */
  const unsubscribe = useCallback(
    (categoryId: string) => commit(subsRef.current.filter((s) => s.categoryId !== categoryId)),
    [commit],
  );

  return { subs, subscribe, unsubscribe };
}

export type IncomingCategory = { status: 'none' } | { status: 'invalid' } | { status: 'ready'; slug: string; opened: OpenedCategory };

/** What a category link (#c=<slug>) in `url` holds, asked of the server. */
export async function resolveIncomingCategory(url: string, service: CategoryShareService = categoryShareService): Promise<IncomingCategory> {
  const slug = readCategorySlug(url);
  if (!slug) return { status: 'none' };
  if (!service.available) return { status: 'invalid' };
  const opened = await service.open(slug);
  return opened && opened !== 'error' ? { status: 'ready', slug, opened } : { status: 'invalid' };
}

/** Watches the URL for a shared category link, on load and when one is pasted into an open tab. */
export function useIncomingCategory() {
  const [state, setState] = useState<IncomingCategory>({ status: 'none' });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await resolveIncomingCategory(window.location.href);
      if (!cancelled && next.status !== 'none') setState(next);
    };
    void check();
    window.addEventListener('hashchange', check);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', check);
    };
  }, []);
  const dismiss = useCallback(() => {
    clearCategoryFromLocation();
    setState({ status: 'none' });
  }, []);
  return { incoming: state, dismiss };
}

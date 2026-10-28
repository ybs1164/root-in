import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategorySnapshot } from '../domain/categoryShare';
import { resolveIncomingCategory } from '../hooks/useCategoryShares';
import {
  categoryLinkUrl,
  createSupabaseCategoryShareService,
  decodeCategorySnapshot,
  encodeCategorySnapshot,
  readCategorySlug,
  readOpenedCategory,
  type CategoryShareService,
} from './categoryShareService';
import { loadSubscriptions, saveSubscriptions } from './categorySubscriptionRepository';

const shot: CategorySnapshot = {
  category: { name: '성수 카페', icon: 'cafe', color: '#aa33cc' },
  places: [
    { place: { id: 'a', name: '카페 A', center: [127.0512345678, 37.54], address: '서울 성동구 성수이로 1' }, memo: '창가' },
    { place: { id: 'b', name: '카페 B', center: [127.04, 37.55] } },
  ],
};
const uid = '0f8fad5b-d9cb-469f-a165-70867728950e';

function fakeClient(opts: { existing?: string | null; insertErrors?: ({ code: string } | null)[]; rpc?: unknown; rpcError?: boolean; rows?: unknown[] } = {}) {
  const insert = vi.fn(async (_row: unknown) => ({ error: opts.insertErrors?.shift() ?? null }));
  const update = vi.fn((_row: unknown) => chain);
  const rpc = vi.fn(async () => ({ data: opts.rpc ?? null, error: opts.rpcError ? { message: 'x' } : null }));
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: opts.existing ? { slug: opts.existing } : null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: opts.rows ?? [], error: null }),
  };
  const client = {
    from: () => ({ ...chain, insert, update }),
    rpc,
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }) }) },
  } as unknown as SupabaseClient;
  return { client, insert, update, rpc };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('categoryShareService', () => {
  it('reads only well-formed category links', () => {
    expect(readCategorySlug('https://root.in/#c=AbC123_-xy')).toBe('AbC123_-xy');
    expect(readCategorySlug('https://root.in/#s=AbC123_-xy')).toBeNull();
    expect(readCategorySlug('https://root.in/#c=<script>')).toBeNull();
    expect(categoryLinkUrl('AbC123_-xy', 'https://root.in/')).toBe('https://root.in/#c=AbC123_-xy');
  });

  it('round-trips a snapshot', () => {
    const decoded = decodeCategorySnapshot(JSON.parse(JSON.stringify(encodeCategorySnapshot(shot))));
    expect(decoded?.category).toEqual(shot.category);
    expect(decoded?.places.map((p) => p.place.id)).toEqual(['a', 'b']);
    expect(decoded?.places[0]).toMatchObject({ memo: '창가', place: { center: [127.051235, 37.54], address: '서울 성동구 성수이로 1' } });
  });

  it('distrusts what comes back: bad places are dropped, a bad category or version is refused', () => {
    const wire = encodeCategorySnapshot(shot);
    const tampered = { ...wire, p: [...wire.p, { i: 'far', n: '해외', c: [2.35, 48.85] }, { i: 'a', n: '중복', c: [127, 37.5] }, 'junk'] };
    expect(decodeCategorySnapshot(tampered)?.places.map((p) => p.place.id)).toEqual(['a', 'b']);
    expect(decodeCategorySnapshot({ ...wire, c: { n: '', ic: 'cafe', co: 1 } })).toBeNull();
    expect(decodeCategorySnapshot({ ...wire, c: { n: 'x', ic: 'nope', co: 1 } })).toBeNull();
    expect(decodeCategorySnapshot({ ...wire, v: 2 })).toBeNull();
    expect(decodeCategorySnapshot({ ...wire, p: Array.from({ length: 501 }, () => wire.p[0]) })).toBeNull();
    expect(decodeCategorySnapshot(null)).toBeNull();
  });

  it('reads the opened link with the sharer, keeping only an avatars-bucket photo', () => {
    const opened = readOpenedCategory(
      { snapshot: encodeCategorySnapshot(shot), mine: false, owner: { nickname: '  루트인  ', avatar_path: `${uid}/avatar.jpg` } },
      (path) => `https://cdn.test/${path}`,
    );
    expect(opened).toMatchObject({ mine: false, owner: { nickname: '루트인', photo: `https://cdn.test/${uid}/avatar.jpg` } });
    expect(readOpenedCategory({ snapshot: encodeCategorySnapshot(shot), owner: { avatar_path: '../x.png' } }, () => 'x')?.owner.photo).toBeNull();
    expect(readOpenedCategory({ snapshot: { v: 1 } }, () => null)).toBeNull();
  });

  it('updates the live link of a category, else makes one (retrying a taken slug)', async () => {
    const live = fakeClient({ existing: 'Existing01' });
    expect(await createSupabaseCategoryShareService(async () => live.client, true).publish(uid, 'cat', shot)).toBe('Existing01');
    expect(live.update).toHaveBeenCalledWith({ snapshot: encodeCategorySnapshot(shot) });
    expect(live.insert).not.toHaveBeenCalled();

    const fresh = fakeClient({ insertErrors: [{ code: '23505' }, null] });
    const slug = await createSupabaseCategoryShareService(async () => fresh.client, true).publish(uid, 'cat', shot);
    expect(slug).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(fresh.insert).toHaveBeenCalledTimes(2);
    expect(fresh.insert.mock.calls[1][0]).toMatchObject({ owner_id: uid, category_id: 'cat', snapshot: encodeCategorySnapshot(shot) });
  });

  it('never rejects', async () => {
    const broken = createSupabaseCategoryShareService(async () => {
      throw new Error('offline');
    }, true);
    expect(await broken.publish(uid, 'cat', shot)).toBeNull();
    expect(await broken.mine(uid)).toBe('error');
    expect(await broken.stop(uid, 'cat')).toBe(false);
    expect(await broken.open('AbC123_-xy')).toBe('error');
    expect(await createSupabaseCategoryShareService(async () => fakeClient({ rpcError: true }).client, true).open('AbC123_-xy')).toBe('error');
  });

  it('lists my live links by category', async () => {
    const { client } = fakeClient({ rows: [{ slug: 'AbC123_-xy', category_id: 'cat' }, { slug: '<bad>', category_id: 'x' }] });
    expect(await createSupabaseCategoryShareService(async () => client, true).mine(uid)).toEqual(new Map([['cat', 'AbC123_-xy']]));
  });
});

describe('resolveIncomingCategory', () => {
  const service = (open: CategoryShareService['open'], available = true): CategoryShareService => ({
    available,
    open,
    mine: async () => new Map(),
    publish: async () => null,
    stop: async () => false,
  });

  it('opens a #c= link, and calls a stopped or keyless one invalid', async () => {
    const opened = { snapshot: shot, owner: { nickname: '루트인', photo: null }, mine: false };
    expect(await resolveIncomingCategory('https://root.in/#c=AbC123_-xy', service(async () => opened))).toEqual({
      status: 'ready',
      slug: 'AbC123_-xy',
      opened,
    });
    expect(await resolveIncomingCategory('https://root.in/#c=AbC123_-xy', service(async () => null))).toEqual({ status: 'invalid' });
    expect(await resolveIncomingCategory('https://root.in/#c=AbC123_-xy', service(async () => opened, false))).toEqual({ status: 'invalid' });
    expect(await resolveIncomingCategory('https://root.in/#share=abc', service(async () => opened))).toEqual({ status: 'none' });
  });
});

describe('categorySubscriptionRepository', () => {
  it('keeps valid subscriptions, one per link and per category', () => {
    const sub = { slug: 'AbC123_-xy', categoryId: 'sub', owner: '루트인', look: shot.category, added: ['a', 7] };
    window.localStorage.setItem(
      'goodroot:category-subs:v1',
      JSON.stringify([sub, { ...sub, categoryId: 'other' }, { ...sub, slug: 'bad slug' }, { ...sub, slug: 'Other12345', look: { name: '' } }]),
    );
    expect(loadSubscriptions()).toEqual([{ ...sub, added: ['a'] }]);
    saveSubscriptions([]);
    expect(loadSubscriptions()).toEqual([]);
  });
});

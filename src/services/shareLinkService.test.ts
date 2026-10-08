import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { resolveIncoming } from '../hooks/useIncomingCourse';
import { encodeSharedCourse } from './courseShareService';
import { createSupabaseShareLinkService, hasOpened, newSlug, readOpened, readShortSlug, rememberOpened, type ShareLinkService } from './shareLinkService';
import type { SharedCourse } from '../types/course';

const course: SharedCourse = {
  title: '성수 산책',
  theme: 'etc',
  travelMode: 'walk',
  stops: [
    { place: { id: 'a', name: '카페', center: [127.05, 37.54] } },
    { place: { id: 'b', name: '공원', center: [127.04, 37.55] } },
  ],
  sharedBy: '루트인',
  sharedAt: '2026-10-09T00:00:00.000Z',
};
const token = encodeSharedCourse(course).token;
const uid = '0f8fad5b-d9cb-469f-a165-70867728950e';
const photoUrl = (path: string) => `https://cdn.test/${path}`;

function fakeClient(opts: { existing?: string | null; insertErrors?: ({ code: string } | null)[]; rpc?: unknown; rpcError?: boolean; rows?: unknown[] } = {}) {
  const insert = vi.fn(async () => ({ error: opts.insertErrors?.shift() ?? null }));
  const rpc = vi.fn(async () => ({ data: opts.rpc ?? null, error: opts.rpcError ? { message: 'x' } : null }));
  const filters: unknown[][] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: (...args: unknown[]) => (filters.push(['is', ...args]), chain),
    limit: () => chain,
    maybeSingle: async () => ({ data: opts.existing ? { slug: opts.existing } : null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: opts.rows ?? [], error: null }),
  };
  const client = {
    from: () => ({ ...chain, insert }),
    rpc,
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: photoUrl(path) } }) }) },
  } as unknown as SupabaseClient;
  return { client, insert, rpc, filters };
}

describe('shareLinkService', () => {
  it('reads only well-formed short links', () => {
    expect(readShortSlug('https://root.in/#s=AbC123_-xy')).toBe('AbC123_-xy');
    expect(readShortSlug('https://root.in/#share=abc')).toBeNull();
    expect(readShortSlug('https://root.in/#s=no')).toBeNull();
    expect(readShortSlug('https://root.in/#s=<script>')).toBeNull();
  });

  it('makes 10-character URL-safe slugs', () => {
    expect(newSlug()).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(newSlug(() => new Uint8Array(10))).toBe('AAAAAAAAAA');
  });

  it('reuses the link of an unchanged route, else makes one (retrying a taken slug)', async () => {
    vi.stubGlobal('location', { origin: 'https://root.in', pathname: '/' });
    const same = fakeClient({ existing: 'Existing01' });
    expect(await createSupabaseShareLinkService(async () => same.client, true).create(uid, 'c1', token)).toBe('https://root.in/#s=Existing01');
    expect(same.insert).not.toHaveBeenCalled();
    expect(same.filters).toContainEqual(['is', 'revoked_at', null]); // a deleted route's dead link isn't handed out again
    const fresh = fakeClient({ insertErrors: [{ code: '23505' }, null] });
    expect(await createSupabaseShareLinkService(async () => fresh.client, true).create(uid, 'c1', token)).toMatch(/^https:\/\/root\.in\/#s=[A-Za-z0-9]{10}$/);
    expect(fresh.insert).toHaveBeenCalledTimes(2);
    expect(fresh.insert).toHaveBeenLastCalledWith(expect.objectContaining({ owner_id: uid, kind: 'route', course_id: 'c1', snapshot: { token } }));
    const broken = fakeClient({ insertErrors: [{ code: '42501' }] });
    expect(await createSupabaseShareLinkService(async () => broken.client, true).create(uid, 'c1', token)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('opens a link: the route checked like any link, the sender and the count', async () => {
    const fake = fakeClient({ rpc: { snapshot: { token }, open_count: 7, owner: { nickname: '보낸이', handle: 'rootin', avatar_path: `${uid}/avatar.jpg` } } });
    const opened = await createSupabaseShareLinkService(async () => fake.client, true).open('AbC123_-xy', false);
    expect(fake.rpc).toHaveBeenCalledWith('open_share', { share_slug: 'AbC123_-xy', count_open: false });
    expect(opened).toMatchObject({ openCount: 7, course: { title: '성수 산책' }, sender: { nickname: '보낸이', handle: 'rootin', photo: `https://cdn.test/${uid}/avatar.jpg` } });
    const failing = fakeClient({ rpcError: true });
    expect(await createSupabaseShareLinkService(async () => failing.client, true).open('AbC123_-xy', true)).toBe('error');
  });

  it("doesn't trust what open_share hands back", () => {
    expect(readOpened(null, photoUrl)).toBeNull();
    expect(readOpened({ snapshot: { token: 'garbage' } }, photoUrl)).toBeNull();
    const odd = readOpened({ snapshot: { token }, open_count: -3, owner: { nickname: 7, handle: 'Bad Handle', avatar_path: '../etc/passwd' } }, photoUrl);
    expect(odd).toMatchObject({ openCount: 0, sender: { nickname: '', handle: null, photo: null } });
  });

  it('adds up the opens of every link per route', async () => {
    const fake = fakeClient({ rows: [{ course_id: 'c1', open_count: 2 }, { course_id: 'c1', open_count: 3 }, { course_id: 'c2', open_count: 1 }, { course_id: null, open_count: 9 }] });
    const totals = await createSupabaseShareLinkService(async () => fake.client, true).counts(uid);
    expect(totals).toEqual(new Map([['c1', 5], ['c2', 1]]));
  });

  it('counts 루트 추가 on a short link, and never fails the add', async () => {
    const fake = fakeClient();
    const service = createSupabaseShareLinkService(async () => fake.client, true);
    await service.countAdd('AbC123_-xy');
    expect(fake.rpc).toHaveBeenCalledWith('count_share_add', { share_slug: 'AbC123_-xy' });
    await service.countAdd('<bad>');
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    await expect(createSupabaseShareLinkService(async () => { throw new Error('down'); }, true).countAdd('AbC123_-xy')).resolves.toBeUndefined();
  });

  it('remembers links opened in this browser', () => {
    expect(hasOpened('AbC123_-xy')).toBe(false);
    rememberOpened('AbC123_-xy');
    expect(hasOpened('AbC123_-xy')).toBe(true);
  });
});

describe('resolveIncoming', () => {
  const links = (opened: Awaited<ReturnType<ShareLinkService['open']>>, available = true): ShareLinkService => ({
    available,
    create: vi.fn(),
    open: vi.fn(async () => opened),
    counts: vi.fn(),
    countAdd: vi.fn(),
  });

  it('opens a short link, counting it only the first time here', async () => {
    const service = links({ course, openCount: 3, sender: { nickname: '보낸이', handle: null, photo: null } });
    expect(await resolveIncoming('https://root.in/#s=AbC123_-xy', service)).toMatchObject({ status: 'ready', meta: { slug: 'AbC123_-xy', openCount: 3 } });
    await resolveIncoming('https://root.in/#s=AbC123_-xy', service);
    expect(vi.mocked(service.open).mock.calls.map((c) => c[1])).toEqual([true, false]);
  });

  it('says a short link is broken when missing, unreachable, or the app has no server', async () => {
    expect(await resolveIncoming('https://root.in/#s=AbC123_-xy', links(null))).toEqual({ status: 'invalid' });
    expect(await resolveIncoming('https://root.in/#s=AbC123_-xy', links('error'))).toEqual({ status: 'invalid' });
    expect(await resolveIncoming('https://root.in/#s=AbC123_-xy', links(null, false))).toEqual({ status: 'invalid' });
  });

  it('still opens long #share= links, with no count', async () => {
    const state = await resolveIncoming(`https://root.in/#share=${token}`, links(null));
    expect(state).toMatchObject({ status: 'ready', course: { title: '성수 산책' } });
    expect(state).not.toHaveProperty('meta');
    expect(await resolveIncoming('https://root.in/', links(null))).toEqual({ status: 'none' });
  });
});

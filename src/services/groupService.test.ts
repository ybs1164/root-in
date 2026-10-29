import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseGroupService, inviteUrl, readGroups, readInviteSlug, readMetPairs, readHeartNews, readComments } from './groupService';

const G1 = '11111111-1111-1111-1111-111111111111';
const U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// A stand-in for the bits of supabase-js the service touches (no network in tests).
function fakeClient(answer: (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: { code?: string } | null }) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => ({ data: null, error: null, ...answer(fn, args) }));
  const client = {
    rpc,
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }) }) },
  } as unknown as SupabaseClient;
  return { client, rpc };
}

const row = {
  id: G1,
  name: '  대학 동기  ',
  cover: 2,
  invite_slug: 'abcDEF123_',
  mine: true,
  members: [
    {
      user_id: U2,
      slot: 1,
      nickname: '민수',
      avatar_path: `${U2}/avatar.jpg`,
      pings: [
        { at: '2026-10-16T05:00:00Z', center: [126.92, 37.55] },
        { at: '2026-10-16T01:00:00Z', center: [126.91, 37.56] },
        { at: '2026-10-16T02:00:00Z', center: [2.35, 48.85] }, // outside Korea
        { at: 'nope', center: [126.9, 37.5] },
      ],
    },
    { user_id: U1, slot: 0, nickname: '', avatar_path: 'someone/else.png', pings: [] },
    { user_id: U1, slot: 3, nickname: 'dup', pings: [] },
    { user_id: 'not-a-uuid', slot: 2, pings: [] },
  ],
};

describe('groupService', () => {
  it('reads my_groups like received data: shapes, Korea-only pings in time order, safe photo paths', () => {
    const [g] = readGroups([row, { id: 'bad' }], (p) => `https://cdn/${p}`);
    expect(g).toMatchObject({ id: G1, name: '대학 동기', cover: 2, inviteSlug: 'abcDEF123_', mine: true });
    expect(g.members.map((m) => m.userId)).toEqual([U1, U2]);
    expect(g.members[0]).toMatchObject({ nickname: '익명', photo: null });
    expect(g.members[1].photo).toBe(`https://cdn/${U2}/avatar.jpg`);
    expect(g.members[1].pings.map((p) => p.center)).toEqual([
      [126.91, 37.56],
      [126.92, 37.55],
    ]);
    expect(readGroups('nope', () => null)).toEqual([]);
  });

  it('lists through my_groups for the given day, and says error rather than rejecting', async () => {
    const fake = fakeClient(() => ({ data: [row] }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    const list = await service.list('2026-10-16');
    expect(fake.rpc).toHaveBeenCalledWith('my_groups', { on_day: '2026-10-16' });
    expect(list !== 'error' && list[0].id).toBe(G1);
    expect(await createSupabaseGroupService(async () => fakeClient(() => ({ error: {} })).client, true).list('2026-10-16')).toBe('error');
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('down')), true).list('2026-10-16')).toBe('error');
    expect(await createSupabaseGroupService(async () => null, true).list('2026-10-16')).toBe('error');
  });

  it('creates with a fresh invite slug, trying another when it was taken', async () => {
    let calls = 0;
    const fake = fakeClient(() => (++calls === 1 ? { error: { code: '23505' } } : { data: G1 }));
    const slugs = ['first0', 'second'];
    const service = createSupabaseGroupService(async () => fake.client, true, () => slugs.shift() ?? 'xxxxxx');
    expect(await service.create(' 러닝크루 ', 9)).toEqual({ id: G1, inviteSlug: 'second' });
    expect(fake.rpc).toHaveBeenLastCalledWith('create_group', { group_name: '러닝크루', group_cover: 0, slug: 'second' });
    expect(await service.create('   ', 0)).toBeNull();
  });

  it('joins by invite slug, and checks the slug before asking', async () => {
    const fake = fakeClient(() => ({ data: G1 }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.join('abcDEF123_')).toBe(G1);
    expect(await service.join('../x')).toBeNull();
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(await createSupabaseGroupService(async () => fakeClient(() => ({ data: null })).client, true).join('abcdefgh')).toBeNull();
  });

  it('renames and leaves without rejecting', async () => {
    const fake = fakeClient((fn) => (fn === 'rename_group' ? { data: true } : {}));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.rename(G1, '새 이름')).toBe(true);
    expect(await service.leave(G1)).toBe(true);
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).leave(G1)).toBe(false);
  });

  it('makes and reads invite links', () => {
    expect(inviteUrl('abcdefgh', 'https://root.in/')).toBe('https://root.in/#g=abcdefgh');
    expect(readInviteSlug('https://root.in/#g=abcdefgh')).toBe('abcdefgh');
    expect(readInviteSlug('https://root.in/#g=bad!')).toBeNull();
    expect(readInviteSlug('https://root.in/#share=x')).toBeNull();
  });

  it("uses the invite slug the dialog showed, and kicks through the maker-only function", async () => {
    const fake = fakeClient((fn) => (fn === 'create_group' ? { data: G1 } : fn === 'kick_group_member' ? { data: true } : {}));
    const service = createSupabaseGroupService(async () => fake.client, true, () => 'fallback');
    expect(await service.create('그룹', 0, 'shown123')).toEqual({ id: G1, inviteSlug: 'shown123' });
    expect(await service.kick(G1, U2)).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('kick_group_member', { gid: G1, member: U2 });
    expect(await service.kick(G1, 'not-a-uuid')).toBe(false);
  });

  it("shows a member's 별명 instead of their nickname, and sets / clears it", async () => {
    const [g] = readGroups([{ ...row, members: [{ user_id: U1, slot: 0, nickname: '민수', alias: '  막내  ', pings: [] }] }], () => null);
    // No colour from an older server: it followed the slot.
    expect(g.members[0].color).toBe(0);
    expect(readGroups([{ ...row, members: [{ user_id: U1, slot: 0, color: 13, pings: [] }] }], () => null)[0].members[0].color).toBe(13);
    expect(readGroups([{ ...row, members: [{ user_id: U1, slot: 2, color: 99, pings: [] }] }], () => null)[0].members[0].color).toBe(2);
    expect(g.members[0]).toMatchObject({ nickname: '막내', alias: '막내' });
    const fake = fakeClient((fn) => ({ data: fn === 'set_group_alias' || fn === 'delete_group' }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.setAlias(G1, ' 막내 ')).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('set_group_alias', { gid: G1, new_alias: '막내' });
    expect(await service.remove(G1)).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('delete_group', { gid: G1 });
    const colors = fakeClient((fn) => ({ data: fn === 'set_group_color' }));
    const colored = createSupabaseGroupService(async () => colors.client, true);
    expect(await colored.setColor(G1, 12)).toBe(true);
    expect(colors.rpc).toHaveBeenLastCalledWith('set_group_color', { gid: G1, new_color: 12 });
    // Out of the palette never reaches the server.
    expect(await colored.setColor(G1, 20)).toBe(false);
    expect(colors.rpc).toHaveBeenCalledTimes(1);
    expect(fake.rpc).toHaveBeenLastCalledWith('delete_group', { gid: G1 });
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).remove(G1)).toBe(false);
  });

  it("keeps each ping's place name (trimmed, capped), and does without one", () => {
    const [g] = readGroups(
      [{ ...row, members: [{ user_id: U1, slot: 0, nickname: 'a', pings: [{ at: '2026-10-18T01:00:00Z', center: [127, 37.5], name: `  ${'가'.repeat(100)} ` }, { at: '2026-10-18T02:00:00Z', center: [127, 37.6] }] }] }],
      () => null,
    );
    expect(g.members[0].pings[0].name).toHaveLength(80);
    expect(g.members[0].pings[1].name).toBeUndefined();
  });

  it('reads a sent photo only from a group-photos path, as its address', () => {
    const ping = (photo: unknown) => ({ at: '2026-10-27T01:00:00Z', center: [127, 37.5], name: '카페', photo });
    const [g] = readGroups(
      [{ ...row, members: [{ user_id: U1, slot: 0, nickname: 'a', pings: [ping(`${U1}/AbCdEf123456.jpg`), ping('../../etc/passwd'), ping(`${U1}/x.png`)] }] }],
      () => null,
      (p) => `https://photos/${p}`,
    );
    expect(g.members[0].pings.map((p) => p.photo)).toEqual([`https://photos/${U1}/AbCdEf123456.jpg`, undefined, undefined]);
  });

  describe('sendPhoto', () => {
    const photo = 'data:image/jpeg;base64,AQID';
    const ping = { day: '2026-10-27', at: '2026-10-27T03:00:00.000Z', center: [127, 37.5] as [number, number], name: ' 성수 카페 ' };
    function photoClient(answer: { data?: unknown; error?: unknown }, uploadError: unknown = null) {
      const upload = vi.fn(async () => ({ error: uploadError }));
      const remove = vi.fn(async () => ({ error: null }));
      const rpc = vi.fn(async () => ({ data: null, error: null, ...answer }));
      const client = {
        rpc,
        auth: { getSession: async () => ({ data: { session: { user: { id: U1 } } } }) },
        storage: { from: () => ({ upload, remove }) },
      } as unknown as SupabaseClient;
      return { client, rpc, upload, remove };
    }

    it('uploads once under my folder, then sends it to every picked group', async () => {
      const fake = photoClient({ data: 2 });
      const service = createSupabaseGroupService(async () => fake.client, true, () => 'Slug012345');
      const G2 = '22222222-2222-2222-2222-222222222222';
      expect(await service.sendPhoto([G1, G2, G1, 'bad'], ping, photo)).toBe(2);
      expect(fake.upload).toHaveBeenCalledTimes(1);
      const path = `${U1}/Slug012345Slug012345.jpg`;
      expect(fake.upload).toHaveBeenCalledWith(path, expect.any(Blob), expect.objectContaining({ contentType: 'image/jpeg' }));
      expect(fake.rpc).toHaveBeenCalledWith('send_group_photo', {
        gids: [G1, G2], on_day: '2026-10-27', at_time: ping.at, ping_center: [127, 37.5], place_name: '성수 카페', photo_path: path,
      });
    });

    it('sends nothing for a bad ping, and cleans up when no group took it; never rejects', async () => {
      const fake = photoClient({ data: 0 });
      const service = createSupabaseGroupService(async () => fake.client, true, () => 'Slug012345');
      expect(await service.sendPhoto([G1], { ...ping, center: [2.35, 48.85] }, photo)).toBe(0);
      expect(await service.sendPhoto([], ping, photo)).toBe(0);
      expect(fake.upload).not.toHaveBeenCalled();
      expect(await service.sendPhoto([G1], ping, photo)).toBe(0);
      expect(fake.remove).toHaveBeenCalledWith([`${U1}/Slug012345Slug012345.jpg`]);
      const failedUpload = photoClient({ data: 1 }, { message: 'x' });
      expect(await createSupabaseGroupService(async () => failedUpload.client, true).sendPhoto([G1], ping, photo)).toBe(0);
      expect(failedUpload.rpc).not.toHaveBeenCalled();
      expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).sendPhoto([G1], ping, photo)).toBe(0);
    });
  });

  describe('photos', () => {
    const P = `${U2}/Abc123Abc123.jpg`;
    function tableClient(answer: { data?: unknown; error?: unknown }) {
      const calls: unknown[][] = [];
      const query = {
        select: (...a: unknown[]) => (calls.push(['select', ...a]), query),
        in: (...a: unknown[]) => (calls.push(['in', ...a]), query),
        order: (...a: unknown[]) => (calls.push(['order', ...a]), query),
        limit: async (...a: unknown[]) => (calls.push(['limit', ...a]), { data: null, error: null, ...answer }),
      };
      const client = {
        from: (table: string) => (calls.push(['from', table]), query),
        storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }) }) },
      } as unknown as SupabaseClient;
      return { client, calls };
    }

    it("reads my groups' photo rows, newest first, dropping bad ones", async () => {
      const good = { id: G1, group_id: G1, user_id: U2, day: '2026-10-27', at: '2026-10-27T03:00:00Z', name: ' 성수 ', path: P };
      const fake = tableClient({ data: [good, { ...good, path: '../x.jpg' }, { ...good, day: 'yesterday' }, null] });
      const photos = await createSupabaseGroupService(async () => fake.client, true).photos([G1, G1, 'bad']);
      expect(photos).toEqual([{ id: G1, groupId: G1, userId: U2, day: '2026-10-27', at: '2026-10-27T03:00:00.000Z', name: '성수', path: P, url: `https://cdn/${P}` }]);
      expect(fake.calls).toContainEqual(['from', 'group_photos']);
      expect(fake.calls).toContainEqual(['in', 'group_id', [G1]]);
      expect(fake.calls).toContainEqual(['order', 'at', { ascending: false }]);
    });

    it('asks nothing for no groups; error when the server fails; never rejects', async () => {
      const fake = tableClient({ error: { message: 'x' } });
      const service = createSupabaseGroupService(async () => fake.client, true);
      expect(await service.photos([])).toEqual([]);
      expect(await service.photos([G1])).toBe('error');
      expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).photos([G1])).toBe('error');
    });
  });

  it("reads 만난 날's pairs, skipping anything off, and asks only for groups and days that make sense", async () => {
    const row = { group_id: G1, day: '2026-10-28', user_a: U1, user_b: U1.replace(/.$/, '9') };
    expect(readMetPairs([row, { ...row, day: 'soon' }, { ...row, user_a: 'x' }, null])).toEqual([{ groupId: G1, day: '2026-10-28', users: [row.user_a, row.user_b] }]);
    expect(readMetPairs('nope')).toEqual([]);
    const fake = fakeClient(() => ({ data: [row] }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.metDays([G1, 'bad'], ['2026-10-28', '2026-10-28', 'x'])).toHaveLength(1);
    expect(fake.rpc).toHaveBeenLastCalledWith('group_met_days', { gids: [G1], days: ['2026-10-28'] });
    expect(await service.metDays([], ['2026-10-28'])).toEqual([]);
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).metDays([G1], ['2026-10-28'])).toBe('error');
  });

  it('hearts a photo by its path, and reads the news on mine, checked', async () => {
    const path = `${U1}/AbCdEf123456.jpg`;
    const fake = fakeClient((fn) => ({ data: fn === 'heart_photo' ? true : fn === 'heart_news' ? [{ path, from_user: U1, nickname: ' 민수 ', place: '카페', at: '2026-11-02T01:00:00Z' }, { path: '../x', from_user: U1, at: 'x' }] : null }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.heart(path, true)).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('heart_photo', { photo_path: path, heart: true });
    expect(await service.heart('demo/x', true)).toBe(false);
    expect(await service.heartNews()).toEqual([{ path, fromUser: U1, nickname: '민수', place: '카페', at: '2026-11-02T01:00:00Z' }]);
    expect(await service.heartsSeen('2026-11-02T01:00:00Z')).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('hearts_seen', { upto: '2026-11-02T01:00:00Z' });
    expect(readHeartNews('nope')).toEqual([]);
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).heartNews()).toEqual([]);
  });

  it('reads and writes a photo\'s comments by its path, checked', async () => {
    const path = `${U1}/AbCdEf123456.jpg`;
    const C1 = '11111111-2222-4333-8444-555555555555';
    const fake = fakeClient((fn) => ({
      data: fn === 'comment_photo' ? C1 : fn === 'photo_comments'
        ? [{ id: C1, user_id: U1, nickname: ' 민수 ', body: ' 좋다 ', at: '2026-11-02T01:00:00Z', mine: false }, { id: 'x', body: 'no' }, { id: C1, body: '   ', at: '2026-11-02T01:00:00Z' }]
        : null,
    }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.comment(path, '  안녕  ')).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('comment_photo', { photo_path: path, comment: '안녕' });
    expect(await service.comment(path, '   ')).toBe(false);
    expect(await service.comment('demo/x', 'hi')).toBe(false);
    expect(await service.comments(path)).toEqual([{ id: C1, nickname: '민수', body: '좋다', at: '2026-11-02T01:00:00Z', mine: false }]);
    expect(await service.comments('ping:abc')).toBe('error');
    expect(readComments('nope')).toEqual([]);
  });

  it("reads a member's 개별 프로필, and my row's stored one", () => {
    const own = `${U1}/gAbCdEf123456.jpg`;
    const [g] = readGroups([{ ...row, members: [
      { user_id: U1, slot: 0, nickname: '민수', own_profile: true, alias: '막내', avatar_path: own, group_alias: '막내', group_photo: own, pings: [] },
      { user_id: U2, slot: 1, nickname: '지은', own_profile: false, alias: null, avatar_path: `${U2}/gnope.png`, pings: [] },
    ] }], (path) => `https://cdn/${path}`);
    expect(g.members[0]).toMatchObject({ nickname: '막내', ownProfile: true, photo: `https://cdn/${own}`, groupProfile: { alias: '막내', photo: `https://cdn/${own}` } });
    expect(g.members[1]).toMatchObject({ nickname: '지은', photo: null });
    expect(g.members[1].ownProfile).toBeUndefined();
    expect(g.members[1].groupProfile).toBeUndefined();
  });

  it('switches my profile in a group without a photo to upload', async () => {
    const fake = fakeClient((fn) => ({ data: fn === 'set_group_profile' ? { ok: true, old_photo: null } : null }));
    const service = createSupabaseGroupService(async () => fake.client, true);
    expect(await service.setProfile(G1, false, '민수')).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('set_group_profile', { gid: G1, own: false, new_alias: '민수', new_photo: null });
    expect(await service.setProfile(G1, true, ' 막내 ', null)).toBe(true);
    expect(fake.rpc).toHaveBeenLastCalledWith('set_group_profile', { gid: G1, own: true, new_alias: '막내', new_photo: '' });
    // 개별 needs a name.
    expect(await service.setProfile(G1, true, '  ')).toBe(false);
    expect(await createSupabaseGroupService(() => Promise.reject(new Error('x')), true).setProfile(G1, false, 'a')).toBe(false);
  });
});

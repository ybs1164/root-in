import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { defaultProfile } from './profileRepository';
import { createSupabaseProfileService, dataUrlToBlob } from './remoteProfileService';

// A stand-in for the bits of supabase-js the service touches (no network in tests).
function fakeClient(opts: { row?: unknown; selectError?: boolean; upsertError?: { code: string } | null; blob?: Blob | null }) {
  const upsert = vi.fn(async () => ({ error: opts.upsertError ?? null }));
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const download = vi.fn(async () => ({ data: opts.blob ?? null }));
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.row ?? null, error: opts.selectError ? { message: 'x' } : null }) }) }),
      upsert,
    }),
    storage: { from: () => ({ upload, remove, download }) },
  } as unknown as SupabaseClient;
  return { client, upsert, upload, remove, download };
}

const fallback = defaultProfile('userdevice');

describe('remoteProfileService', () => {
  it('reads the account row, photo downloaded as a data URL', async () => {
    const fake = fakeClient({
      row: { id: 'u1', handle: 'rootin', nickname: '루트인', avatar_path: 'u1/avatar.jpg', settings: { sound: false } },
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    });
    const read = await createSupabaseProfileService(async () => fake.client).fetch('u1', fallback);
    expect(read).toMatchObject({ nickname: '루트인', profile: { handle: 'rootin', sound: false, photo: 'data:image/jpeg;base64,AQID' } });
  });

  it("ignores an avatar path outside the user's own folder", async () => {
    const fake = fakeClient({ row: { handle: 'rootin', avatar_path: 'someone/avatar.jpg' } });
    const read = await createSupabaseProfileService(async () => fake.client).fetch('u1', fallback);
    expect(fake.download).not.toHaveBeenCalled();
    expect(read).toMatchObject({ profile: { photo: null } });
  });

  it('tells no row (first login) apart from a failure, without rejecting', async () => {
    expect(await createSupabaseProfileService(async () => fakeClient({}).client).fetch('u1', fallback)).toBeNull();
    expect(await createSupabaseProfileService(async () => fakeClient({ selectError: true }).client).fetch('u1', fallback)).toBe('error');
    expect(await createSupabaseProfileService(async () => null).fetch('u1', fallback)).toBe('error');
    expect(await createSupabaseProfileService(() => Promise.reject(new Error('down'))).fetch('u1', fallback)).toBe('error');
  });

  it('uploads the photo only when it changed, then saves the row', async () => {
    const fake = fakeClient({});
    const service = createSupabaseProfileService(async () => fake.client);
    const account = { profile: { ...fallback, photo: 'data:image/jpeg;base64,AQID' }, nickname: 'a' };
    expect(await service.push('u1', account, false)).toBe('ok');
    expect(fake.upload).not.toHaveBeenCalled();
    expect(await service.push('u1', account, true)).toBe('ok');
    expect(fake.upload).toHaveBeenCalledWith('u1/avatar.jpg', expect.any(Blob), expect.objectContaining({ upsert: true }));
    expect(fake.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'u1', avatar_path: 'u1/avatar.jpg' }));
    expect(await service.push('u1', { ...account, profile: fallback }, true)).toBe('ok');
    expect(fake.remove).toHaveBeenCalledWith(['u1/avatar.jpg']);
  });

  it('reports a taken @아이디', async () => {
    const fake = fakeClient({ upsertError: { code: '23505' } });
    expect(await createSupabaseProfileService(async () => fake.client).push('u1', { profile: fallback, nickname: '' }, false)).toBe('handle-taken');
    const other = fakeClient({ upsertError: { code: '42501' } });
    expect(await createSupabaseProfileService(async () => other.client).push('u1', { profile: fallback, nickname: '' }, false)).toBe('error');
  });

  it('turns a data URL into bytes', async () => {
    const blob = dataUrlToBlob('data:image/jpeg;base64,AQID');
    expect(blob?.type).toBe('image/jpeg');
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(dataUrlToBlob('not a data url')).toBeNull();
  });
});

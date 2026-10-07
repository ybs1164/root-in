import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_NOTES, createAccountSync } from './accountSync';
import { defaultProfile } from './profileRepository';
import type { AccountProfile, RemoteProfileService } from './remoteProfileService';

function setup(remote: Partial<RemoteProfileService>, local: AccountProfile = { profile: defaultProfile('device-id'), nickname: '기기' }) {
  const service: RemoteProfileService = { fetch: vi.fn(async () => null), push: vi.fn(async () => 'ok' as const), ...remote };
  const apply = vi.fn();
  const note = vi.fn();
  const sync = createAccountSync({ remote: service, local: () => local, apply, note });
  return { sync, service, apply, note, local };
}

describe('accountSync', () => {
  it("replaces this device's profile with the account's on sign-in", async () => {
    const theirs = { profile: { ...defaultProfile('account-id'), sound: false }, nickname: '계정' };
    const { sync, apply, service } = setup({ fetch: vi.fn(async () => theirs) });
    await sync.signedIn('u1');
    expect(apply).toHaveBeenCalledWith(theirs);
    expect(service.push).not.toHaveBeenCalled();
  });

  it("makes this device's profile the account's on the first sign-in, photo included", async () => {
    const local = { profile: { ...defaultProfile('device-id'), photo: 'data:image/jpeg;base64,AAAA' }, nickname: '기기' };
    const { sync, service, apply } = setup({}, local);
    await sync.signedIn('u1');
    expect(service.push).toHaveBeenCalledWith('u1', local, true);
    expect(apply).not.toHaveBeenCalled();
  });

  it('falls back to an id made from the account when the first @아이디 is taken', async () => {
    const push = vi.fn<RemoteProfileService['push']>().mockResolvedValueOnce('handle-taken').mockResolvedValueOnce('ok');
    const { sync, apply } = setup({ push });
    await sync.signedIn('ab12cd34-0000');
    expect(push.mock.calls[1][1].profile.handle).toBe('userab12cd');
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.objectContaining({ handle: 'userab12cd' }) }));
  });

  it('says so and keeps this device as is when the server is unreachable', async () => {
    const { sync, apply, note } = setup({ fetch: vi.fn(async () => 'error' as const) });
    await sync.signedIn('u1');
    expect(apply).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledWith(ACCOUNT_NOTES.offline);
  });

  it('sends changes only once synced, and only what changed', async () => {
    const { sync, service, local } = setup({});
    await sync.push({ ...local, nickname: '먼저' });
    expect(service.push).not.toHaveBeenCalled(); // not signed in yet
    await sync.signedIn('u1');
    vi.mocked(service.push).mockClear();
    await sync.push(local);
    expect(service.push).not.toHaveBeenCalled(); // nothing new
    await sync.push({ ...local, nickname: '새 이름' });
    expect(service.push).toHaveBeenCalledWith('u1', { ...local, nickname: '새 이름' }, false);
    await sync.push({ profile: { ...local.profile, photo: 'data:image/jpeg;base64,BBBB' }, nickname: '새 이름' });
    expect(vi.mocked(service.push).mock.calls[1][2]).toBe(true);
  });

  it('sends the newest of quick changes, one request at a time', async () => {
    const { sync, service, local } = setup({});
    await sync.signedIn('u1');
    vi.mocked(service.push).mockClear();
    const a = sync.push({ ...local, nickname: '1' });
    const b = sync.push({ ...local, nickname: '2' });
    await Promise.all([a, b]);
    expect(vi.mocked(service.push).mock.calls.map((c) => c[1].nickname)).toEqual(['2']);
  });

  it('puts back the @아이디 the server has when the new one is taken', async () => {
    const { sync, service, apply, note, local } = setup({});
    await sync.signedIn('u1');
    vi.mocked(service.push).mockResolvedValueOnce('handle-taken');
    await sync.push({ profile: { ...local.profile, handle: 'taken' }, nickname: local.nickname });
    expect(apply).toHaveBeenCalledWith(local);
    expect(note).toHaveBeenCalledWith(ACCOUNT_NOTES.handleTaken);
  });

  it('stops sending after sign-out', async () => {
    const { sync, service, local } = setup({});
    await sync.signedIn('u1');
    sync.signedOut();
    vi.mocked(service.push).mockClear();
    await sync.push({ ...local, nickname: '나중' });
    expect(service.push).not.toHaveBeenCalled();
  });
});

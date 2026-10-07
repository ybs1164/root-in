import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthService } from './authService';

function fakeClient(opts: { userId?: string; rpcError?: boolean; oauthError?: boolean; files?: { name: string }[] } = {}) {
  const session = opts.userId ? { user: { id: opts.userId } } : null;
  const listeners: ((event: string, session: unknown) => void)[] = [];
  const unsubscribe = vi.fn();
  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((listener: (event: string, session: unknown) => void) => {
      listeners.push(listener);
      return { data: { subscription: { unsubscribe } } };
    }),
    signInWithOAuth: vi.fn(async () => ({ error: opts.oauthError ? { message: 'x' } : null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const list = vi.fn(async () => ({ data: opts.files ?? [] }));
  const remove = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({ error: opts.rpcError ? { message: 'x' } : null }));
  const client = { auth, rpc, storage: { from: () => ({ list, remove }) } } as unknown as SupabaseClient;
  return { client, auth, rpc, list, remove, listeners, unsubscribe };
}

describe('authService', () => {
  it('is unavailable and harmless without a client (no Supabase keys)', async () => {
    const service = createSupabaseAuthService(async () => null, false);
    expect(service.available).toBe(false);
    expect(await service.current()).toBeNull();
    expect(await service.signInWithKakao()).toBe(false);
    expect(await service.deleteAccount()).toBe(false);
    await service.signOut();
  });

  it('reads the signed-in user and follows changes', async () => {
    const fake = fakeClient({ userId: 'u1' });
    const service = createSupabaseAuthService(async () => fake.client, true);
    expect(await service.current()).toEqual({ id: 'u1' });
    const seen: unknown[] = [];
    const stop = service.onChange((user) => seen.push(user));
    await vi.waitFor(() => expect(fake.listeners).toHaveLength(1));
    fake.listeners[0]('SIGNED_OUT', null);
    fake.listeners[0]('SIGNED_IN', { user: { id: 'u2' } });
    expect(seen).toEqual([null, { id: 'u2' }]);
    stop();
    expect(fake.unsubscribe).toHaveBeenCalled();
  });

  it('starts Kakao login back to this page, without the hash', async () => {
    const fake = fakeClient();
    vi.stubGlobal('location', { origin: 'https://root.in', pathname: '/app/', hash: '#share=abc' });
    expect(await createSupabaseAuthService(async () => fake.client, true).signInWithKakao()).toBe(true);
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'kakao', options: { redirectTo: 'https://root.in/app/' } });
    vi.unstubAllGlobals();
    expect(await createSupabaseAuthService(async () => fakeClient({ oauthError: true }).client, true).signInWithKakao()).toBe(false);
  });

  it('deletes the photo folder, then the account, then signs out', async () => {
    const fake = fakeClient({ userId: 'u1', files: [{ name: 'avatar.jpg' }] });
    expect(await createSupabaseAuthService(async () => fake.client, true).deleteAccount()).toBe(true);
    expect(fake.remove).toHaveBeenCalledWith(['u1/avatar.jpg']);
    expect(fake.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it('keeps the session when deleting fails', async () => {
    const fake = fakeClient({ userId: 'u1', rpcError: true });
    expect(await createSupabaseAuthService(async () => fake.client, true).deleteAccount()).toBe(false);
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    expect(await createSupabaseAuthService(async () => fakeClient().client, true).deleteAccount()).toBe(false);
  });
});

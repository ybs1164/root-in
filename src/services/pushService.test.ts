import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createPushTokenService, isPushToken } from './pushService';

const TOKEN = 'fcm-token-0123456789abcdef:APA91b';

function fakeClient(saved = true) {
  const rpc = vi.fn(async (fn: string) => ({ data: fn === 'save_push_token' ? saved : true, error: null }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('pushTokenService', () => {
  it("saves this phone's token and drops that same one on sign-out, once", async () => {
    const fake = fakeClient();
    const service = createPushTokenService(async () => fake.client, true);
    expect(await service.save(TOKEN, 'android')).toBe(true);
    expect(fake.rpc).toHaveBeenCalledWith('save_push_token', { push_token: TOKEN, push_platform: 'android' });
    await service.forget();
    expect(fake.rpc).toHaveBeenLastCalledWith('drop_push_token', { push_token: TOKEN });
    await service.forget();
    expect(fake.rpc).toHaveBeenCalledTimes(2);
  });

  it('sends nothing that is not a token, and never rejects', async () => {
    const fake = fakeClient();
    const service = createPushTokenService(async () => fake.client, true);
    expect(await service.save('short', 'ios')).toBe(false);
    expect(await service.save(`${TOKEN} x`, 'ios')).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(await createPushTokenService(async () => fake.client, false).save(TOKEN, 'ios')).toBe(false);
    expect(await createPushTokenService(() => Promise.reject(new Error('x')), true).save(TOKEN, 'ios')).toBe(false);
    // The server said no: nothing to drop later.
    const refused = fakeClient(false);
    const other = createPushTokenService(async () => refused.client, true);
    expect(await other.save(TOKEN, 'ios')).toBe(false);
    await other.forget();
    expect(refused.rpc).toHaveBeenCalledTimes(1);
    expect(isPushToken(TOKEN)).toBe(true);
    expect(isPushToken(42)).toBe(false);
  });
});

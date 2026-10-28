import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidBackend, checkAndroidBackend, checkAndroidBundle } from './android-config.mjs';

test('an ordinary APK requires a complete server configuration', () => {
  assert.throws(() => androidBackend({}), /서버 연결 설정/);
  assert.throws(() => androidBackend({ VITE_SUPABASE_URL: 'https://example.supabase.co' }), /서버 연결 설정/);
  assert.equal(androidBackend({}, true), null);
});

test('publishable and legacy anon keys are accepted; server keys are refused', () => {
  const env = { VITE_SUPABASE_URL: ' https://example.supabase.co/ ', VITE_SUPABASE_ANON_KEY: ' anon ' };
  assert.deepEqual(androidBackend(env), { url: 'https://example.supabase.co', key: 'anon' });
  assert.equal(androidBackend({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).key, 'sb_publishable_test');
  assert.throws(() => androidBackend({ ...env, VITE_SUPABASE_ANON_KEY: 'sb_secret_test' }), /관리자 키/);
  const secret = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => androidBackend({ ...env, VITE_SUPABASE_ANON_KEY: secret }), /관리자 키/);
});

test('the preflight checks auth without signing in or creating an account', async () => {
  const backend = { url: 'https://example.supabase.co', key: 'public' };
  await checkAndroidBackend(backend, async (url, options) => {
    assert.equal(url, 'https://example.supabase.co/auth/v1/settings');
    assert.equal(options.headers.apikey, 'public');
    assert.equal(options.method, undefined);
    return new Response('{}');
  });
  await assert.rejects(checkAndroidBackend(backend, async () => new Response('', { status: 401 })), /HTTP 401/);
});

test('an older bundle must be rebuilt after adding or changing server settings', () => {
  const backend = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
  assert.throws(() => checkAndroidBundle(backend, ['old app without a backend']), /android:sync/);
  assert.throws(() => checkAndroidBundle(backend, [backend.url + ' old key']), /android:sync/);
  assert.doesNotThrow(() => checkAndroidBundle(backend, [backend.url + ' ' + backend.key]));
});

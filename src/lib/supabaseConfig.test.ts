import { describe, expect, it } from 'vitest';
import { supabaseConfig } from './supabaseConfig';

describe('public backend configuration', () => {
  it('requires both the project URL and a public key', () => {
    expect(supabaseConfig({})).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_ANON_KEY: 'anon' })).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'bad url', VITE_SUPABASE_ANON_KEY: 'anon' })).toBeNull();
  });

  it('accepts a legacy public key and trims copied whitespace', () => {
    expect(supabaseConfig({ VITE_SUPABASE_URL: ' https://example.supabase.co/ ', VITE_SUPABASE_ANON_KEY: ' anon ' })).toEqual({ url: 'https://example.supabase.co', key: 'anon' });
  });

  it('supports publishable keys, including when an old anon key is also set', () => {
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'old', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' })?.key).toBe('sb_publishable_test');
  });

  it('rejects private keys and non-HTTP URLs', () => {
    const base = { VITE_SUPABASE_URL: 'https://example.supabase.co' };
    expect(supabaseConfig({ ...base, VITE_SUPABASE_ANON_KEY: 'sb_secret_test' })).toBeNull();
    const secret = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(supabaseConfig({ ...base, VITE_SUPABASE_ANON_KEY: secret })).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_ANON_KEY: 'anon' })).toBeNull();
  });
});

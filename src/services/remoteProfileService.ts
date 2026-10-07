import type { SupabaseClient } from '@supabase/supabase-js';
import { avatarPath, fromProfileRow, toProfileRow } from './profileSync';
import { getSupabase } from '../lib/supabase';
import type { Profile } from './profileRepository';

// The signed-in account's profile on the server (public.profiles + the
// avatars bucket). Never rejects: failures come back as 'error'.

export interface AccountProfile {
  profile: Profile;
  nickname: string;
}

export type PushResult = 'ok' | 'handle-taken' | 'error';

export interface RemoteProfileService {
  /** The account's profile, null before it has one (first login), 'error' if unreachable. */
  fetch(userId: string, fallback: Profile): Promise<AccountProfile | null | 'error'>;
  /** Creates or updates the row; uploads the photo only when `photoChanged`. */
  push(userId: string, account: AccountProfile, photoChanged: boolean): Promise<PushResult>;
}

// Postgres unique_violation: someone else already has this @아이디.
const UNIQUE_VIOLATION = '23505';

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    // In chunks: spreading a whole photo into one call can overflow the stack.
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export function createSupabaseProfileService(getClient: () => Promise<SupabaseClient | null> = getSupabase): RemoteProfileService {
  return {
    async fetch(userId, fallback) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) return 'error';
        if (!data) return null;
        let photo: string | null = null;
        if (typeof data.avatar_path === 'string' && data.avatar_path.startsWith(`${userId}/`)) {
          const { data: blob } = await client.storage.from('avatars').download(data.avatar_path);
          // Converted to the data URL the profile keeps on the device; one that
          // fails to come down just leaves the person icon.
          if (blob) photo = await blobToDataUrl(new Blob([blob], { type: 'image/jpeg' }));
        }
        return fromProfileRow(data, photo, fallback) ?? 'error';
      } catch {
        return 'error';
      }
    },

    async push(userId, { profile, nickname }, photoChanged) {
      try {
        const client = await getClient();
        if (!client) return 'error';
        if (photoChanged) {
          const bucket = client.storage.from('avatars');
          if (profile.photo) {
            const blob = dataUrlToBlob(profile.photo);
            if (!blob) return 'error';
            const { error } = await bucket.upload(avatarPath(userId), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' });
            if (error) return 'error';
          } else {
            await bucket.remove([avatarPath(userId)]);
          }
        }
        const row = { ...toProfileRow(userId, profile, nickname, !!profile.photo), updated_at: new Date().toISOString() };
        const { error } = await client.from('profiles').upsert(row);
        if (error) return error.code === UNIQUE_VIOLATION ? 'handle-taken' : 'error';
        return 'ok';
      } catch {
        return 'error';
      }
    },
  };
}

export const remoteProfileService: RemoteProfileService = createSupabaseProfileService();

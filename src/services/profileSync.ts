import { PROFILE_LIMITS } from '../domain/profile';
import { profileFromRecord, type Profile } from './profileRepository';

// The account's profile row on the server (supabase/migrations: public.profiles)
// and this device's Profile + nickname, mapped both ways. The photo travels
// separately (storage bucket `avatars`), so the row only names its path.

export interface ProfileRow {
  id: string;
  handle: string;
  nickname: string;
  avatar_path: string | null;
  settings: Pick<Profile, 'sound' | 'pingAlerts' | 'shareAlerts' | 'scheme'>;
  updated_at?: string;
}

export function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

export function toProfileRow(userId: string, profile: Profile, nickname: string, hasPhoto: boolean): ProfileRow {
  return {
    id: userId,
    handle: profile.handle,
    nickname: cleanNickname(nickname),
    avatar_path: hasPhoto ? avatarPath(userId) : null,
    settings: { sound: profile.sound, pingAlerts: profile.pingAlerts, shareAlerts: profile.shareAlerts, scheme: profile.scheme },
  };
}

export function cleanNickname(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, PROFILE_LIMITS.nickname) : '';
}

/**
 * What the server row says, checked like stored data: a bad field falls back
 * to `fallback`'s. `photo` is the avatar already downloaded as a data URL.
 */
export function fromProfileRow(row: unknown, photo: string | null, fallback: Profile): { profile: Profile; nickname: string } | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const settings = record.settings && typeof record.settings === 'object' ? (record.settings as Record<string, unknown>) : {};
  const profile = profileFromRecord({ ...settings, handle: record.handle, photo }, fallback);
  return { profile, nickname: cleanNickname(record.nickname) };
}

/** True when the two differ in anything the row holds (the photo compared as-is). */
export function profileChanged(a: { profile: Profile; nickname: string }, b: { profile: Profile; nickname: string }): boolean {
  return JSON.stringify(a.profile) !== JSON.stringify(b.profile) || a.nickname !== b.nickname;
}

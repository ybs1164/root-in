import { defaultHandle, isValidHandle, PING_ALERT_HOURS, PROFILE_LIMITS, sanitizeAlerts, SHARE_ALERT_COUNTS } from '../domain/profile';
import { getCurrentUserId } from '../lib/currentUser';

const PROFILE_KEY = 'goodroot:profile:v1';

// The nickname stays in currentUser's display name (the share sheets prefill it),
// so this holds only what's new with the profile popup.
export interface Profile {
  handle: string;
  /** Square JPEG data URL, already resized (lib/avatarImage). */
  photo: string | null;
  /** The popup's top-right switch: 소리 (false = 음소거). On until switched off. */
  sound: boolean;
  /** 알림 설정 → 투데이 알림: the hours switched on (PING_ALERT_HOURS), all until switched off. */
  pingAlerts: number[];
  /** 알림 설정 → 공유수 알림: the share counts switched on (SHARE_ALERT_COUNTS), all until switched off. */
  shareAlerts: number[];
  /** 디스플레이 및 언어 → 디스플레이: 기본 (light) or 다크. Null until picked: the phone's own setting decides. */
  scheme: ColorScheme | null;
}

export type ColorScheme = 'light' | 'dark';

export function isPhoto(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= PROFILE_LIMITS.photoChars;
}

export function defaultProfile(handle = defaultHandle(getCurrentUserId())): Profile {
  return { handle, photo: null, sound: true, pingAlerts: [...PING_ALERT_HOURS], shareAlerts: [...SHARE_ALERT_COUNTS], scheme: null };
}

/**
 * A profile from untrusted stored fields (this device's storage, or the
 * account's row on the server): anything failing the checks falls back.
 */
export function profileFromRecord(parsed: Record<string, unknown> | null | undefined, fallback: Profile): Profile {
  return {
    handle: isValidHandle(parsed?.handle) ? parsed.handle : fallback.handle,
    photo: isPhoto(parsed?.photo) ? parsed.photo : null,
    // Saved before the switches existed (or anything but false): on.
    sound: parsed?.sound !== false,
    // Before the hours existed there was one 알림 switch: off meant none of them.
    pingAlerts: sanitizeAlerts(parsed?.pingAlerts, PING_ALERT_HOURS) ?? (parsed?.alerts === false ? [] : [...PING_ALERT_HOURS]),
    shareAlerts: sanitizeAlerts(parsed?.shareAlerts, SHARE_ALERT_COUNTS) ?? [...SHARE_ALERT_COUNTS],
    scheme: parsed?.scheme === 'light' || parsed?.scheme === 'dark' ? parsed.scheme : null,
  };
}

export function loadProfile(): Profile {
  const fallback = defaultProfile();
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return profileFromRecord(parsed, fallback);
  } catch {
    return fallback;
  }
}

/** False when storage refused it (e.g. full), so the caller can say so. */
export function saveProfile(profile: Profile): boolean {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

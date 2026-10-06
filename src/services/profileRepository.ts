import { defaultHandle, isValidHandle, PING_ALERT_HOURS, PROFILE_LIMITS, sanitizePingAlerts } from '../domain/profile';
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
}

function isPhoto(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= PROFILE_LIMITS.photoChars;
}

export function loadProfile(): Profile {
  const fallback: Profile = { handle: defaultHandle(getCurrentUserId()), photo: null, sound: true, pingAlerts: [...PING_ALERT_HOURS] };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return {
      handle: isValidHandle(parsed?.handle) ? parsed.handle : fallback.handle,
      photo: isPhoto(parsed?.photo) ? parsed.photo : null,
      // Saved before the switches existed (or anything but false): on.
      sound: parsed?.sound !== false,
      // Before the hours existed there was one 알림 switch: off meant none of them.
      pingAlerts: sanitizePingAlerts(parsed?.pingAlerts) ?? (parsed?.alerts === false ? [] : [...PING_ALERT_HOURS]),
    };
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

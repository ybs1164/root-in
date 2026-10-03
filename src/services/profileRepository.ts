import { defaultHandle, isValidHandle, PROFILE_LIMITS } from '../domain/profile';
import { getCurrentUserId } from '../lib/currentUser';

const PROFILE_KEY = 'goodroot:profile:v1';

// The nickname stays in currentUser's display name (the share sheets prefill it),
// so this holds only what's new with the profile popup.
export interface Profile {
  handle: string;
  /** Square JPEG data URL, already resized (lib/avatarImage). */
  photo: string | null;
}

function isPhoto(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= PROFILE_LIMITS.photoChars;
}

export function loadProfile(): Profile {
  const fallback: Profile = { handle: defaultHandle(getCurrentUserId()), photo: null };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return {
      handle: isValidHandle(parsed?.handle) ? parsed.handle : fallback.handle,
      photo: isPhoto(parsed?.photo) ? parsed.photo : null,
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

const USER_ID_KEY = 'goodroot:anonymous-user-id';

// There's no auth/backend yet, so "the current user" is just a random id
// this browser generates once and remembers. Every travel-route feature
// reads the owner's id through this function instead of touching
// localStorage directly, so swapping this out for a real session/auth id
// later (e.g. from a login) is a one-file change.
export function getCurrentUserId(): string {
  if (typeof window === 'undefined') {
    return 'anonymous';
  }

  try {
    const existing = window.localStorage.getItem(USER_ID_KEY);
    if (existing) {
      return existing;
    }

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(USER_ID_KEY, generated);
    return generated;
  } catch {
    // localStorage can throw in some private-browsing modes.
    return 'anonymous';
  }
}

const DISPLAY_NAME_KEY = 'goodroot:share-display-name';

// Optional name shown to people who open a route this user shares. Kept
// alongside the user id so a real profile can replace both at once.
export function getDisplayName(): string {
  try {
    return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setDisplayName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) {
      window.localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    } else {
      window.localStorage.removeItem(DISPLAY_NAME_KEY);
    }
  } catch {
    // Not persisting the name is harmless; it just won't be prefilled next time.
  }
}

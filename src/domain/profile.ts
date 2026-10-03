// 프로필 @아이디: the user's unique word in share links, so it may only hold
// characters a URL path carries as-is (RFC 3986 unreserved, minus `~` and
// upper case so two ids can't differ by case alone).

export const PROFILE_LIMITS = {
  nickname: 20,
  handleMin: 3,
  handleMax: 20,
  /** A resized avatar data URL; anything bigger isn't one we made. */
  photoChars: 200_000,
};

const HANDLE_CHAR = /[a-z0-9._-]/;
const HANDLE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/** What typing leaves in the field: lower-cased, other characters dropped, cut to length. */
export function sanitizeHandleInput(text: string): string {
  return [...text.toLowerCase()]
    .filter((c) => HANDLE_CHAR.test(c))
    .join('')
    .slice(0, PROFILE_LIMITS.handleMax);
}

export type HandleProblem = 'too-short' | 'bad-edge';

/** Why a (sanitized) id can't be saved, or null. Starts and ends on a letter or digit. */
export function handleProblem(handle: string): HandleProblem | null {
  if (handle.length < PROFILE_LIMITS.handleMin) return 'too-short';
  if (!HANDLE.test(handle)) return 'bad-edge';
  return null;
}

export function isValidHandle(handle: unknown): handle is string {
  return typeof handle === 'string' && handle.length <= PROFILE_LIMITS.handleMax && handleProblem(handle) === null;
}

/** The id a new profile starts with, taken from the browser's random user id. */
export function defaultHandle(userId: string): string {
  const tail = userId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  return `user${tail || '000000'}`;
}

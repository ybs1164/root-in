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

// 알림 설정: each row is a set of steps switched on or off one by one, all on
// until switched off. 투데이 알림 — the hours of the day a ping reminder may
// come; 공유수 알림 — the share counts a shared route is told about at.
export const PING_ALERT_HOURS = [7, 9, 12, 16, 20, 23] as const;
export const SHARE_ALERT_COUNTS = [10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;

/** A 공유수 알림 step as its board cell reads: 10, 100, 1k, 10k, 100k, 1M. */
export function shareCountLabel(count: number): string {
  if (count >= 1_000_000) return `${count / 1_000_000}M`;
  if (count >= 1_000) return `${count / 1_000}k`;
  return String(count);
}

/** Stored steps, kept only if they're among `steps`, in that order, once each. */
export function sanitizeAlerts(value: unknown, steps: readonly number[]): number[] | null {
  if (!Array.isArray(value)) return null;
  return steps.filter((step) => value.includes(step));
}

/** The steps with `step` switched the other way. */
export function toggleAlert(on: readonly number[], step: number, steps: readonly number[]): number[] {
  return steps.filter((s) => (s === step ? !on.includes(s) : on.includes(s)));
}

/** 전체: every step on — or, when they already all are, every step off. */
export function toggleAllAlerts(on: readonly number[], steps: readonly number[]): number[] {
  return steps.every((s) => on.includes(s)) ? [] : [...steps];
}

/**
 * 랜덤: each step on or off by a coin toss. Tosses again (a few times) when
 * the board would come out as it already is, so the press always shows.
 */
export function randomAlerts(on: readonly number[], steps: readonly number[], random: () => number = Math.random): number[] {
  const same = (next: number[]) => next.length === on.length && next.every((s) => on.includes(s));
  let next: number[] = [];
  for (let tries = 0; tries < 8; tries += 1) {
    next = steps.filter(() => random() < 0.5);
    if (!same(next)) break;
  }
  return next;
}


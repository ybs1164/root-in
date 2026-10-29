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

// 알림 설정 → 투데이 알림: the hours of the day a ping reminder may come, each
// switched on or off one by one, all on until switched off.
export const PING_ALERT_HOURS = [7, 9, 12, 16, 20, 23] as const;

/** A share count as a route row reads it: 10, 100, 1k, 10k, 100k, 1M. */
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

/**
 * 알림 설정 → 그룹 알림: per group, four kinds of alert, each on its own
 * cell of the group's board —
 * - route (새로운 루트): another member pinged a new place (with a photo or not);
 * - heart (하트): someone hearted a photo of mine;
 * - comment (댓글): someone commented on a photo of mine;
 * - chat (채팅): in the group's 대화, someone else's message, or their
 *   comment on a photo that isn't mine. A photo posted there alerts only
 *   as a new route, a comment on mine only as 댓글.
 */
export const GROUP_ALERT_KINDS = ['route', 'heart', 'comment', 'chat'] as const;
export type GroupAlertKind = (typeof GROUP_ALERT_KINDS)[number];
export const GROUP_ALERT_LABELS: Record<GroupAlertKind, string> = { route: '새로운 루트', heart: '하트', comment: '댓글', chat: '채팅' };

/**
 * What's kept is what's switched *off* (so a group joined later starts with
 * everything on): `<group id>:<kind>`, once each. A bare group id — the one
 * switch a group had before the kinds — means all four off.
 */
export const GROUP_ALERTS_MAX = 30 * GROUP_ALERT_KINDS.length;
const offKey = (groupId: string, kind: GroupAlertKind) => `${groupId}:${kind}`;
export function sanitizeGroupIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const keys = value
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64)
    .flatMap((id) => {
      const at = id.lastIndexOf(':');
      const kind = id.slice(at + 1);
      if (at > 0 && (GROUP_ALERT_KINDS as readonly string[]).includes(kind)) return [id];
      return id.includes(':') ? [] : GROUP_ALERT_KINDS.map((k) => offKey(id, k));
    });
  return [...new Set(keys)].slice(0, GROUP_ALERTS_MAX);
}

/** Whether `kind` alerts are on for the group. */
export const groupAlertOn = (off: readonly string[], groupId: string, kind: GroupAlertKind): boolean => !off.includes(offKey(groupId, kind));

/** One cell of a group's board switched the other way. */
export function toggleGroupAlert(off: readonly string[], groupId: string, kind: GroupAlertKind): string[] {
  const key = offKey(groupId, kind);
  return off.includes(key) ? off.filter((k) => k !== key) : [...off, key];
}

/** 전체, for `groupIds` (one group's, or every group's): all their cells on — or, when they already all are, all off. */
export function toggleGroupAlertsAll(off: readonly string[], groupIds: readonly string[]): string[] {
  const keys = groupIds.flatMap((id) => GROUP_ALERT_KINDS.map((k) => offKey(id, k)));
  const allOn = keys.every((k) => !off.includes(k));
  return allOn ? [...new Set([...off, ...keys])] : off.filter((k) => !keys.includes(k));
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


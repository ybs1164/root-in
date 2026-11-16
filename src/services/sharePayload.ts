// What every share link's decoder needs: links come from anyone, so each
// field is checked rather than trusted (CLAUDE.md: 공유 링크로 들어온 데이터).

/** A string trimmed and cut to `max`; anything else (or nothing left) is undefined. */
export const clampText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
};

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const VISITED_KEY = 'goodroot:visited-pins:v1';
const MAX_IDS = 5000;

/**
 * The pings already looked at for pinning their place (domain/visitedPlaces),
 * this phone only: a 미분류 pin made from a visit and deleted later stays
 * deleted. Empty when nothing has been looked at yet.
 */
export function loadVisitedPings(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(VISITED_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((id): id is string => typeof id === 'string' && id.length <= 64).slice(-MAX_IDS));
  } catch {
    return new Set();
  }
}

export function saveVisitedPings(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(VISITED_KEY, JSON.stringify([...ids].slice(-MAX_IDS)));
  } catch {
    // Full or blocked storage: the next pass looks again, and finds the pins already made.
  }
}

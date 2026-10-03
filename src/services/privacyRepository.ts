import { HOME, HOME_ID, PRIVACY_LIMITS, type ExcludedPlace } from '../domain/privacy';

const PRIVACY_KEY = 'goodroot:privacy:v1';

export interface Privacy {
  /** Home is always first, even before it has an address. */
  excluded: ExcludedPlace[];
}

const inKorea = (c: unknown): c is [number, number] =>
  Array.isArray(c) &&
  c.length === 2 &&
  typeof c[0] === 'number' &&
  typeof c[1] === 'number' &&
  c[0] >= 120 &&
  c[0] <= 135 &&
  c[1] >= 30 &&
  c[1] <= 45;

function readPlace(raw: unknown): ExcludedPlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.address !== 'string') return null;
  const place: ExcludedPlace = {
    id: r.id.slice(0, 64),
    label: typeof r.label === 'string' ? r.label.slice(0, PRIVACY_LIMITS.label) : '',
    address: r.address.slice(0, PRIVACY_LIMITS.address),
  };
  if (inKorea(r.center)) place.center = r.center;
  return place;
}

/** Home first (made if missing), the rest in their order, capped. */
export function withHome(places: ExcludedPlace[]): ExcludedPlace[] {
  const home = places.find((p) => p.id === HOME_ID);
  const others = places.filter((p) => p.id !== HOME_ID);
  return [{ ...(home ?? HOME), label: HOME.label }, ...others].slice(0, PRIVACY_LIMITS.places);
}

export function loadPrivacy(): Privacy {
  try {
    const raw = window.localStorage.getItem(PRIVACY_KEY);
    const parsed = raw ? (JSON.parse(raw) as { excluded?: unknown }) : null;
    const list = Array.isArray(parsed?.excluded) ? parsed.excluded.map(readPlace).filter((p): p is ExcludedPlace => !!p) : [];
    return { excluded: withHome(list) };
  } catch {
    return { excluded: withHome([]) };
  }
}

export function savePrivacy(privacy: Privacy): void {
  try {
    window.localStorage.setItem(PRIVACY_KEY, JSON.stringify({ excluded: withHome(privacy.excluded) }));
  } catch {
    // Unsaved here means it's asked for again next time; sharing stays blocked without home.
  }
}

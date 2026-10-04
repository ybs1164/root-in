import { PRIVACY_LIMITS, withHome, type ExcludedPlace } from '../domain/privacy';
import { inKorea } from './pinShareService';

const PRIVACY_KEY = 'goodroot:privacy:v1';

export interface Privacy {
  /** 제외 주소: 집 first, always. */
  excluded: ExcludedPlace[];
}

const isCenter = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  inKorea(value as [number, number]);

// Hand-edited or stale storage: keep the rows that make sense, clamp the text.
function parsePlace(raw: unknown): ExcludedPlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, kind, address, name, center } = raw as Partial<ExcludedPlace>;
  if (typeof id !== 'string' || (kind !== 'home' && kind !== 'other') || typeof address !== 'string') return null;
  const place: ExcludedPlace = { id, kind, address: address.slice(0, PRIVACY_LIMITS.address) };
  const label = typeof name === 'string' ? name.trim().slice(0, PRIVACY_LIMITS.name) : '';
  if (kind === 'other' && label) place.name = label;
  if (isCenter(center)) place.center = center;
  return place;
}

export function loadPrivacy(): Privacy {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PRIVACY_KEY) ?? 'null') as { excluded?: unknown } | null;
    const rows = Array.isArray(raw?.excluded) ? raw.excluded.map(parsePlace).filter((p): p is ExcludedPlace => !!p) : [];
    // One 집; at most the limit.
    const home = rows.find((p) => p.kind === 'home');
    const others = rows.filter((p) => p.kind === 'other');
    return { excluded: withHome([...(home ? [home] : []), ...others]).slice(0, PRIVACY_LIMITS.maxPlaces) };
  } catch {
    return { excluded: withHome([]) };
  }
}

/** False when storage refused it. */
export function savePrivacy(privacy: Privacy): boolean {
  try {
    window.localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacy));
    return true;
  } catch {
    return false;
  }
}

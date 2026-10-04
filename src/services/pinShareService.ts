import { isPinColor, isPinIcon, PIN_LIMITS, PIN_SET_LIMITS } from '../domain/pin';
import { fromBase64Url, toBase64Url } from '../lib/base64url';
import type { PlaceRef } from '../types/course';
import type { PinColor, PinIcon, SharedPin, SharedPinCategory, SharedPinSet } from '../types/pin';
import { SHARE_LIMITS } from './routeShareService';

// Its own fragment key, next to `#share=` (course) and `#diary=` (day).
export const PINS_HASH_KEY = 'pins';
const PAYLOAD_VERSION = 1;
export const MAX_PINS_TOKEN_LENGTH = 6000;

// The service is domestic-only (Kakao Map); a pin outside this box is either
// a typo or a crafted link.
export const KOREA_BOUNDS = { minLat: 33, maxLat: 39, minLon: 124, maxLon: 132 } as const;

interface WireCategory {
  n: string;
  ic: PinIcon;
  co: PinColor;
  p?: number; // parent index — old links only (sub-categories are gone); ignored
}
interface WirePin {
  i: string;
  n: string;
  c: [number, number];
  k: number; // category index
  a?: string; // address
  m?: string; // memo
}
interface WirePayload {
  v: 1;
  t: string;
  c: WireCategory[];
  p: WirePin[];
  b?: string;
  s: string; // shared at
}

export interface PinShareService {
  createShareUrl(set: SharedPinSet): Promise<string>;
  resolveFromUrl(url: string): Promise<SharedPinSet | null>;
}

const clampText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const inKorea = ([lon, lat]: [number, number]): boolean =>
  Number.isFinite(lon) &&
  Number.isFinite(lat) &&
  lat >= KOREA_BOUNDS.minLat &&
  lat <= KOREA_BOUNDS.maxLat &&
  lon >= KOREA_BOUNDS.minLon &&
  lon <= KOREA_BOUNDS.maxLon;

export interface PinsEncodeResult {
  token: string;
  /** What had to be dropped to keep the link under the length limit. */
  trimmed: 'none' | 'memos' | 'memos-and-addresses';
  /** Pins left out because a set carries at most 30. */
  dropped: number;
}

export function encodeSharedPinSet(set: SharedPinSet): PinsEncodeResult {
  const pins = set.pins.slice(0, PIN_SET_LIMITS.maxPins);
  const build = (withMemo: boolean, withAddress: boolean) => {
    const payload: WirePayload = {
      v: PAYLOAD_VERSION,
      t: set.title.trim().slice(0, PIN_SET_LIMITS.title),
      c: set.categories.map((c) => ({ n: c.name, ic: c.icon, co: c.color })),
      p: pins.map((pin) => {
        const wire: WirePin = {
          i: pin.place.id,
          n: pin.place.name,
          c: [round6(pin.place.center[0]), round6(pin.place.center[1])],
          k: pin.category,
        };
        const address = withAddress ? clampText(pin.place.address, 80) : undefined;
        const memo = withMemo ? clampText(pin.memo, PIN_LIMITS.memo) : undefined;
        if (address) wire.a = address;
        if (memo) wire.m = memo;
        return wire;
      }),
      s: set.sharedAt,
    };
    const sharedBy = clampText(set.sharedBy, SHARE_LIMITS.sharedBy);
    if (sharedBy) payload.b = sharedBy;
    return toBase64Url(JSON.stringify(payload));
  };
  const dropped = set.pins.length - pins.length;
  const full = build(true, true);
  if (full.length <= MAX_PINS_TOKEN_LENGTH) return { token: full, trimmed: 'none', dropped };
  const noMemo = build(false, true);
  if (noMemo.length <= MAX_PINS_TOKEN_LENGTH) return { token: noMemo, trimmed: 'memos', dropped };
  return { token: build(false, false), trimmed: 'memos-and-addresses', dropped };
}

// Links come from anyone: validate every field, clamp every string, and
// accept icons/colors only from the fixed lists.
const parseCategory = (raw: unknown): SharedPinCategory | null => {
  if (!raw || typeof raw !== 'object') return null;
  // `p` (a parent, from links made while sub-categories existed) is ignored:
  // such a category simply arrives as a category of its own.
  const { n, ic, co } = raw as Partial<WireCategory>;
  const name = clampText(n, PIN_LIMITS.categoryName);
  if (!name || !isPinIcon(ic) || !isPinColor(co)) return null;
  return { name, icon: ic, color: co };
};

const parsePin = (raw: unknown, categoryCount: number): SharedPin | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { i, n, c, k, a, m } = raw as Partial<WirePin>;
  const id = clampText(i, 64);
  const name = clampText(n, 80);
  if (!id || !name || !Array.isArray(c) || c.length !== 2) return null;
  const [lon, lat] = c;
  if (typeof lon !== 'number' || typeof lat !== 'number' || !inKorea([lon, lat])) return null;
  if (!Number.isInteger(k) || (k as number) < 0 || (k as number) >= categoryCount) return null;
  const place: PlaceRef = { id, name, center: [lon, lat] };
  const address = clampText(a, 80);
  if (address) place.address = address;
  const pin: SharedPin = { place, category: k as number };
  const memo = clampText(m, PIN_LIMITS.memo);
  if (memo) pin.memo = memo;
  return pin;
};

export function decodeSharedPinSet(token: string): SharedPinSet | null {
  if (!token || token.length > MAX_PINS_TOKEN_LENGTH) return null;
  let raw: Partial<WirePayload>;
  try {
    raw = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (!raw || raw.v !== PAYLOAD_VERSION) return null;
  if (!Array.isArray(raw.c) || raw.c.length < 1 || raw.c.length > PIN_LIMITS.maxCategories + 1) return null;
  if (!Array.isArray(raw.p) || raw.p.length < 1 || raw.p.length > PIN_SET_LIMITS.maxPins) return null;
  const categories = raw.c.map(parseCategory);
  if (categories.some((c) => c === null)) return null;
  const pins = raw.p.map((p) => parsePin(p, categories.length));
  if (pins.some((p) => p === null)) return null;
  const set: SharedPinSet = {
    title: clampText(raw.t, PIN_SET_LIMITS.title) ?? '핀 모음',
    categories: categories as SharedPinCategory[],
    pins: pins as SharedPin[],
    sharedAt: typeof raw.s === 'string' && !Number.isNaN(Date.parse(raw.s)) ? raw.s : new Date().toISOString(),
  };
  const sharedBy = clampText(raw.b, SHARE_LIMITS.sharedBy);
  if (sharedBy) set.sharedBy = sharedBy;
  return set;
}

export const readPinsToken = (url: string): string | null => {
  const hash = new URL(url).hash.replace(/^#/, '');
  return new URLSearchParams(hash).get(PINS_HASH_KEY);
};

/** Removes the `#pins=…` fragment without adding a history entry. */
export function clearPinsFromLocation(): void {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete(PINS_HASH_KEY);
  const rest = params.toString();
  window.history.replaceState(null, '', `${url.pathname}${url.search}${rest ? `#${rest}` : ''}`);
}

export class LinkPinShareService implements PinShareService {
  constructor(private readonly baseUrl: () => string = () => `${window.location.origin}${window.location.pathname}`) {}

  async createShareUrl(set: SharedPinSet): Promise<string> {
    return `${this.baseUrl()}#${PINS_HASH_KEY}=${encodeSharedPinSet(set).token}`;
  }

  async resolveFromUrl(url: string): Promise<SharedPinSet | null> {
    const token = readPinsToken(url);
    return token ? decodeSharedPinSet(token) : null;
  }
}

export const pinShareService: PinShareService = new LinkPinShareService();

export function formatPinSetShareText(set: SharedPinSet, url: string): string {
  const lines = [`📍 ${set.title} (${set.pins.length}곳)`, set.pins.slice(0, 5).map((p) => p.place.name).join(' · ')];
  if (set.pins.length > 5) lines[1] += ` 외 ${set.pins.length - 5}곳`;
  if (set.sharedBy) lines.push(`— ${set.sharedBy}`);
  lines.push(url);
  return lines.join('\n');
}

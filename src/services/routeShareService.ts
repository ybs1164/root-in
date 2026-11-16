import type { PlaceRef } from '../types/course';
import { fromBase64Url, toBase64Url } from '../lib/base64url';
import { clampText, isFiniteNumber } from './sharePayload';

const SHARE_HASH_KEY = 'share';
const PAYLOAD_VERSION = 1;
const MAX_TOKEN_LENGTH = 4000;

export const SHARE_LIMITS = {
  title: 80,
  note: 280,
  sharedBy: 40,
} as const;

/**
 * The first share links (`#share=…`, payload v1): one origin → destination
 * route. Nothing makes these any more, but an old link must still open —
 * courseShareService reads one as a 2-stop course.
 */
export interface SharedRoute {
  origin: PlaceRef;
  destination: PlaceRef;
  title: string;
  note?: string;
  /** Display name the sharer chose; empty means anonymous. */
  sharedBy?: string;
  sharedAt: string; // ISO timestamp
}

// Compact wire format keeps links short.
interface WirePlace {
  i: string;
  n: string;
  c: [number, number];
}
interface WirePayload {
  v: number;
  o: WirePlace;
  d: WirePlace;
  t: string;
  m?: string;
  b?: string;
  a: string;
}

// Share links come from anyone, so every field is validated rather than
// trusted: wrong shapes are rejected, and strings are length-clamped.
const parsePlace = (raw: unknown): PlaceRef | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { i, n, c } = raw as Partial<WirePlace>;
  const id = clampText(i, 64);
  const name = clampText(n, 80);
  if (!id || !name || !Array.isArray(c) || c.length !== 2) return null;
  const [lon, lat] = c;
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return { id, name, center: [lon, lat] };
};

const toWirePlace = (place: PlaceRef): WirePlace => ({ i: place.id, n: place.name, c: place.center });

export function encodeSharedRoute(route: SharedRoute): string {
  const payload: WirePayload = {
    v: PAYLOAD_VERSION,
    o: toWirePlace(route.origin),
    d: toWirePlace(route.destination),
    t: route.title.trim().slice(0, SHARE_LIMITS.title),
    a: route.sharedAt,
  };
  const note = clampText(route.note, SHARE_LIMITS.note);
  const sharedBy = clampText(route.sharedBy, SHARE_LIMITS.sharedBy);
  if (note) payload.m = note;
  if (sharedBy) payload.b = sharedBy;
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedRoute(token: string): SharedRoute | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const raw = JSON.parse(fromBase64Url(token)) as Partial<WirePayload>;
    if (raw.v !== PAYLOAD_VERSION) return null;
    const origin = parsePlace(raw.o);
    const destination = parsePlace(raw.d);
    if (!origin || !destination || origin.id === destination.id) return null;
    const sharedAt = typeof raw.a === 'string' && !Number.isNaN(Date.parse(raw.a)) ? raw.a : new Date().toISOString();
    return {
      origin,
      destination,
      title: clampText(raw.t, SHARE_LIMITS.title) ?? `${origin.name} → ${destination.name}`,
      note: clampText(raw.m, SHARE_LIMITS.note),
      sharedBy: clampText(raw.b, SHARE_LIMITS.sharedBy),
      sharedAt,
    };
  } catch {
    return null;
  }
}

export const readShareToken = (url: string): string | null => {
  const hash = new URL(url).hash.replace(/^#/, '');
  return new URLSearchParams(hash).get(SHARE_HASH_KEY);
};

/** Removes the `#share=…` (or short `#s=…`) fragment without adding a history entry. */
export function clearShareFromLocation(): void {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete(SHARE_HASH_KEY);
  params.delete('s'); // a short link (#s=…, shareLinkService)
  const rest = params.toString();
  window.history.replaceState(null, '', `${url.pathname}${url.search}${rest ? `#${rest}` : ''}`);
}

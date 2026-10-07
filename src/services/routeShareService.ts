import type { PlaceRef, SharedRoute } from '../types/travelRoute';

const SHARE_HASH_KEY = 'share';
const PAYLOAD_VERSION = 1;
const MAX_TOKEN_LENGTH = 4000;

export const SHARE_LIMITS = {
  title: 80,
  note: 280,
  sharedBy: 40,
} as const;

/**
 * Turning a route into something another person can open, and back.
 *
 * `LinkRouteShareService` below needs no server: the whole route is encoded
 * into the URL fragment (`#share=…`), which browsers never send to a server,
 * so nothing is uploaded anywhere. Once there's a backend, a service that
 * stores the payload and returns a short id link can implement this same
 * interface — callers already treat both methods as async.
 */
export interface RouteShareService {
  createShareUrl(route: SharedRoute): Promise<string>;
  /** Reads a shared route from a URL; null when there is none or it's invalid. */
  resolveFromUrl(url: string): Promise<SharedRoute | null>;
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

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (token: string): string => {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const clampText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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

export class LinkRouteShareService implements RouteShareService {
  constructor(private readonly baseUrl: () => string = () => `${window.location.origin}${window.location.pathname}`) {}

  async createShareUrl(route: SharedRoute): Promise<string> {
    return `${this.baseUrl()}#${SHARE_HASH_KEY}=${encodeSharedRoute(route)}`;
  }

  async resolveFromUrl(url: string): Promise<SharedRoute | null> {
    const token = readShareToken(url);
    return token ? decodeSharedRoute(token) : null;
  }
}

export const routeShareService: RouteShareService = new LinkRouteShareService();

/** Plain-text version for chat apps that don't unfurl links nicely. */
export function formatShareText(route: SharedRoute, url: string): string {
  const lines = [`🗺️ ${route.title}`, `${route.origin.name} → ${route.destination.name}`];
  if (route.note) lines.push(`📝 ${route.note}`);
  if (route.sharedBy) lines.push(`— ${route.sharedBy}`);
  lines.push(url);
  return lines.join('\n');
}

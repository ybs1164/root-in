import { COURSE_LIMITS, COURSE_THEMES, TRAVEL_MODES } from '../domain/course';
import type { CourseStop, CourseTheme, PlaceRef, SharedCourse, TravelMode } from '../types/course';
import { decodeSharedRoute, readShareToken, SHARE_LIMITS } from './routeShareService';

const SHARE_HASH_KEY = 'share';
const PAYLOAD_VERSION = 2;
export const MAX_TOKEN_LENGTH = 4000;

export { clearShareFromLocation } from './routeShareService';

export interface CourseShareService {
  createShareUrl(course: SharedCourse): Promise<string>;
  /** Reads a shared course from a URL (v1 or v2 link); null when absent or invalid. */
  resolveFromUrl(url: string): Promise<SharedCourse | null>;
}

// Compact wire format keeps links short.
interface WireStop {
  i: string;
  n: string;
  c: [number, number];
  k?: string; // category
  m?: string; // memo
}
interface WirePayloadV2 {
  v: 2;
  t: string;
  h: CourseTheme;
  x: TravelMode;
  s: WireStop[];
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
  const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const clampText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// 6 decimals ≈ 10cm; more precision only makes links longer.
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const toWireStop = (stop: CourseStop, withMemo: boolean): WireStop => {
  const wire: WireStop = {
    i: stop.place.id,
    n: stop.place.name,
    c: [round6(stop.place.center[0]), round6(stop.place.center[1])],
  };
  if (stop.place.category) wire.k = stop.place.category;
  const memo = withMemo ? clampText(stop.memo, COURSE_LIMITS.memo) : undefined;
  if (memo) wire.m = memo;
  return wire;
};

// Share links come from anyone: every field is validated, strings clamped.
const parseStop = (raw: unknown): CourseStop | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { i, n, c, k, m } = raw as Partial<WireStop>;
  const id = clampText(i, 64);
  const name = clampText(n, 80);
  if (!id || !name || !Array.isArray(c) || c.length !== 2) return null;
  const [lon, lat] = c;
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  const place: PlaceRef = { id, name, center: [lon, lat] };
  const category = clampText(k, 40);
  if (category) place.category = category;
  const memo = clampText(m, COURSE_LIMITS.memo);
  return memo ? { place, memo } : { place };
};

export interface EncodeResult {
  token: string;
  /** True when memos had to be dropped to keep the link under the length limit. */
  memosTrimmed: boolean;
}

export function encodeSharedCourse(course: SharedCourse): EncodeResult {
  const build = (withMemo: boolean) => {
    const payload: WirePayloadV2 = {
      v: PAYLOAD_VERSION,
      t: course.title.trim().slice(0, COURSE_LIMITS.title),
      h: course.theme,
      x: course.travelMode,
      s: course.stops.slice(0, COURSE_LIMITS.maxStops).map((stop) => toWireStop(stop, withMemo)),
      a: course.sharedAt,
    };
    const note = clampText(course.note, SHARE_LIMITS.note);
    const sharedBy = clampText(course.sharedBy, SHARE_LIMITS.sharedBy);
    if (note) payload.m = note;
    if (sharedBy) payload.b = sharedBy;
    return toBase64Url(JSON.stringify(payload));
  };
  const full = build(true);
  if (full.length <= MAX_TOKEN_LENGTH) return { token: full, memosTrimmed: false };
  return { token: build(false), memosTrimmed: true };
}

const decodeV2 = (raw: Partial<WirePayloadV2>): SharedCourse | null => {
  if (!Array.isArray(raw.s) || raw.s.length < COURSE_LIMITS.minStops || raw.s.length > COURSE_LIMITS.maxStops) {
    return null;
  }
  const stops = raw.s.map(parseStop);
  if (stops.some((stop) => stop === null)) return null;
  const validStops = stops as CourseStop[];
  return {
    title: clampText(raw.t, COURSE_LIMITS.title) ?? `${validStops[0].place.name} 외 ${validStops.length - 1}곳`,
    theme: COURSE_THEMES.includes(raw.h as CourseTheme) ? (raw.h as CourseTheme) : 'etc',
    travelMode: TRAVEL_MODES.includes(raw.x as TravelMode) ? (raw.x as TravelMode) : 'walk',
    stops: validStops,
    note: clampText(raw.m, SHARE_LIMITS.note),
    sharedBy: clampText(raw.b, SHARE_LIMITS.sharedBy),
    sharedAt: typeof raw.a === 'string' && !Number.isNaN(Date.parse(raw.a)) ? raw.a : new Date().toISOString(),
  };
};

export function decodeSharedCourse(token: string): SharedCourse | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  let raw: { v?: unknown };
  try {
    raw = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (raw?.v === PAYLOAD_VERSION) return decodeV2(raw as Partial<WirePayloadV2>);
  if (raw?.v === 1) {
    // v1 links (origin → destination) must keep opening, as 2-stop courses.
    const route = decodeSharedRoute(token);
    if (!route) return null;
    return {
      title: route.title,
      theme: 'trip',
      travelMode: 'drive',
      stops: [{ place: route.origin }, { place: route.destination }],
      note: route.note,
      sharedBy: route.sharedBy,
      sharedAt: route.sharedAt,
    };
  }
  return null;
}

export class LinkCourseShareService implements CourseShareService {
  constructor(private readonly baseUrl: () => string = () => `${window.location.origin}${window.location.pathname}`) {}

  async createShareUrl(course: SharedCourse): Promise<string> {
    return `${this.baseUrl()}#${SHARE_HASH_KEY}=${encodeSharedCourse(course).token}`;
  }

  async resolveFromUrl(url: string): Promise<SharedCourse | null> {
    const token = readShareToken(url);
    return token ? decodeSharedCourse(token) : null;
  }
}

export const courseShareService: CourseShareService = new LinkCourseShareService();

/** Plain-text version for chat apps that don't unfurl links nicely. */
export function formatCourseShareText(course: SharedCourse, url: string): string {
  const lines = [`🗺️ ${course.title}`, course.stops.map((stop, i) => `${i + 1}. ${stop.place.name}`).join(' → ')];
  if (course.note) lines.push(`📝 ${course.note}`);
  if (course.sharedBy) lines.push(`— ${course.sharedBy}`);
  lines.push(url);
  return lines.join('\n');
}

import { diaryHeading, DIARY_LIMITS, DIARY_MOODS, formatDiaryDate, isDateKey, isTimeKey } from '../domain/diary';
import { TRAVEL_MODES } from '../domain/course';
import { fromBase64Url, toBase64Url } from '../lib/base64url';
import type { PlaceRef, TravelMode } from '../types/course';
import type { DiaryMood, DiaryStop, SharedDiary } from '../types/diary';
import { SHARE_LIMITS } from './routeShareService';

// A separate fragment key from course links (`#share=`), so each link type
// has its own decoder and adding one never breaks the other.
export const DIARY_HASH_KEY = 'diary';
const PAYLOAD_VERSION = 1;
export const MAX_DIARY_TOKEN_LENGTH = 6000;

export interface DiaryShareService {
  createShareUrl(diary: SharedDiary, options?: { includeText?: boolean }): Promise<string>;
  resolveFromUrl(url: string): Promise<SharedDiary | null>;
}

interface WireStop {
  i: string;
  n: string;
  c: [number, number];
  k?: string; // category
  m?: string; // memo
  t?: string; // time 'HH:MM'
}
interface WirePayload {
  v: 1;
  d: string; // date
  p?: 1; // a planned day (added after v1 shipped; older decoders ignore it)
  t: string; // title
  o?: DiaryMood;
  x: TravelMode;
  s: WireStop[];
  w?: string; // diary text
  b?: string; // shared by
  a: string; // shared at
}

const clampText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const toWireStop = (stop: DiaryStop, withMemo: boolean): WireStop => {
  const wire: WireStop = {
    i: stop.place.id,
    n: stop.place.name,
    c: [round6(stop.place.center[0]), round6(stop.place.center[1])],
  };
  if (stop.place.category) wire.k = stop.place.category;
  const memo = withMemo ? clampText(stop.memo, DIARY_LIMITS.memo) : undefined;
  if (memo) wire.m = memo;
  if (isTimeKey(stop.time)) wire.t = stop.time;
  return wire;
};

// Links come from anyone: validate every field, clamp every string.
const parseStop = (raw: unknown): DiaryStop | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { i, n, c, k, m, t } = raw as Partial<WireStop>;
  const id = clampText(i, 64);
  const name = clampText(n, 80);
  if (!id || !name || !Array.isArray(c) || c.length !== 2) return null;
  const [lon, lat] = c;
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  const place: PlaceRef = { id, name, center: [lon, lat] };
  const category = clampText(k, 40);
  if (category) place.category = category;
  const stop: DiaryStop = { place };
  const memo = clampText(m, DIARY_LIMITS.memo);
  if (memo) stop.memo = memo;
  if (isTimeKey(t)) stop.time = t;
  return stop;
};

export interface DiaryEncodeResult {
  token: string;
  /** What had to be dropped to keep the link under the length limit. */
  trimmed: 'none' | 'text' | 'text-and-memos';
}

export function encodeSharedDiary(diary: SharedDiary, { includeText = true } = {}): DiaryEncodeResult {
  const build = (withText: boolean, withMemo: boolean) => {
    const payload: WirePayload = {
      v: PAYLOAD_VERSION,
      d: diary.date,
      t: diary.title.trim().slice(0, DIARY_LIMITS.title),
      x: diary.travelMode,
      s: diary.stops.slice(0, DIARY_LIMITS.maxStops).map((stop) => toWireStop(stop, withMemo)),
      a: diary.sharedAt,
    };
    if (diary.mood) payload.o = diary.mood;
    if (diary.kind === 'plan') payload.p = 1;
    const text = withText ? clampText(diary.text, DIARY_LIMITS.text) : undefined;
    const sharedBy = clampText(diary.sharedBy, SHARE_LIMITS.sharedBy);
    if (text) payload.w = text;
    if (sharedBy) payload.b = sharedBy;
    return toBase64Url(JSON.stringify(payload));
  };
  const full = build(includeText, true);
  if (full.length <= MAX_DIARY_TOKEN_LENGTH) return { token: full, trimmed: 'none' };
  const noText = build(false, true);
  if (noText.length <= MAX_DIARY_TOKEN_LENGTH) return { token: noText, trimmed: 'text' };
  return { token: build(false, false), trimmed: 'text-and-memos' };
}

export function decodeSharedDiary(token: string): SharedDiary | null {
  if (!token || token.length > MAX_DIARY_TOKEN_LENGTH) return null;
  let raw: Partial<WirePayload>;
  try {
    raw = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (!raw || raw.v !== PAYLOAD_VERSION || !isDateKey(raw.d)) return null;
  if (!Array.isArray(raw.s) || raw.s.length < 1 || raw.s.length > DIARY_LIMITS.maxStops) return null;
  const stops = raw.s.map(parseStop);
  if (stops.some((stop) => stop === null)) return null;
  const diary: SharedDiary = {
    date: raw.d,
    title: clampText(raw.t, DIARY_LIMITS.title) ?? `${formatDiaryDate(raw.d)}의 기록`,
    travelMode: TRAVEL_MODES.includes(raw.x as TravelMode) ? (raw.x as TravelMode) : 'walk',
    stops: stops as DiaryStop[],
    sharedAt: typeof raw.a === 'string' && !Number.isNaN(Date.parse(raw.a)) ? raw.a : new Date().toISOString(),
  };
  if (raw.p === 1) diary.kind = 'plan';
  if (DIARY_MOODS.includes(raw.o as DiaryMood)) diary.mood = raw.o;
  const text = clampText(raw.w, DIARY_LIMITS.text);
  if (text) diary.text = text;
  const sharedBy = clampText(raw.b, SHARE_LIMITS.sharedBy);
  if (sharedBy) diary.sharedBy = sharedBy;
  return diary;
}

export const readDiaryToken = (url: string): string | null => {
  const hash = new URL(url).hash.replace(/^#/, '');
  return new URLSearchParams(hash).get(DIARY_HASH_KEY);
};

/** Removes the `#diary=…` fragment without adding a history entry. */
export function clearDiaryFromLocation(): void {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete(DIARY_HASH_KEY);
  const rest = params.toString();
  window.history.replaceState(null, '', `${url.pathname}${url.search}${rest ? `#${rest}` : ''}`);
}

export class LinkDiaryShareService implements DiaryShareService {
  constructor(private readonly baseUrl: () => string = () => `${window.location.origin}${window.location.pathname}`) {}

  async createShareUrl(diary: SharedDiary, options?: { includeText?: boolean }): Promise<string> {
    return `${this.baseUrl()}#${DIARY_HASH_KEY}=${encodeSharedDiary(diary, options).token}`;
  }

  async resolveFromUrl(url: string): Promise<SharedDiary | null> {
    const token = readDiaryToken(url);
    return token ? decodeSharedDiary(token) : null;
  }
}

export const diaryShareService: DiaryShareService = new LinkDiaryShareService();

/** Plain-text version for chat apps that don't unfurl links nicely. */
export function formatDiaryShareText(diary: SharedDiary, url: string): string {
  const lines = [
    `📔 ${diaryHeading(diary)}`,
    diary.stops.map((stop, i) => `${i + 1}. ${stop.time ? `${stop.time} ` : ''}${stop.place.name}`).join(' → '),
  ];
  if (diary.sharedBy) lines.push(`— ${diary.sharedBy}`);
  lines.push(url);
  return lines.join('\n');
}

import { dateKey, isDateKey } from '../domain/diary';
import { isExcluded, type ExcludedPlace } from '../domain/privacy';
import type { StoredPing } from '../domain/dayPings';
import type { PlaceRef } from '../types/course';
import { inKorea } from './pinShareService';
import { localWrote } from './syncBus';

/**
 * TODAY's pings: pins you were at, pinged by a photo taken on the day screen.
 * A record of places visited, so it stays apart from the pins (which can be
 * renamed, recategorized or deleted without touching the days).
 */
const PINGS_KEY = 'goodroot:pings:v1';

export const PING_LIMITS = { maxPings: 5000, name: 80, address: 120 } as const;

const isCenter = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  inKorea(value as [number, number]);

/** A stored or received ping, checked; null drops it. */
export function parsePing(raw: unknown): StoredPing | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, pinId, day, at, name, center, address, local } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !id || id.length > 64 || !isDateKey(day) || typeof at !== 'string') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time) || typeof name !== 'string' || !name.trim() || !isCenter(center)) return null;
  const ping: StoredPing = { id, day, at: new Date(time).toISOString(), name: name.trim().slice(0, PING_LIMITS.name), center: [center[0], center[1]] };
  if (typeof pinId === 'string' && pinId && pinId.length <= 64) ping.pinId = pinId;
  if (typeof address === 'string' && address.trim()) ping.address = address.trim().slice(0, PING_LIMITS.address);
  if (local === true) ping.local = true;
  return ping;
}

export function loadPings(): StoredPing[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PINGS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw
      .map(parsePing)
      .filter((p): p is StoredPing => !!p && !seen.has(p.id) && !!seen.add(p.id))
      .slice(-PING_LIMITS.maxPings);
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

/** Called whenever the stored pings change (here or from a pull). */
export function onPingsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function savePings(pings: StoredPing[]): void {
  try {
    window.localStorage.setItem(PINGS_KEY, JSON.stringify(pings.slice(-PING_LIMITS.maxPings)));
    localWrote('pings');
  } catch {
    // Storage full or off: the ping is lost, the pin is still saved.
  }
  listeners.forEach((listener) => listener());
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ping-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Adds a pin you're at to today. Once per pin a day. Returns the undo, or
 * null if nothing was added.
 */
export function recordPing(pin: { id: string; place: PlaceRef }, excluded: ExcludedPlace[], now = new Date()): (() => void) | null {
  const ping = addPing(pin.place, excluded, now, pin.id);
  return ping && (() => savePings(loadPings().filter((p) => p.id !== ping.id)));
}

/**
 * A ping of a spot that isn't one of your pins (a photo taken where there's
 * none). Returns its id, or null if nothing was added.
 */
export function recordPlacePing(place: PlaceRef, excluded: ExcludedPlace[], now = new Date()): string | null {
  return addPing(place, excluded, now)?.id ?? null;
}

/** Today's ping recorded from this pin, if any (a photo's pin was just added). */
export function todayPingOfPin(pinId: string, now = new Date()): string | null {
  const day = dateKey(now);
  return loadPings().find((p) => p.day === day && p.pinId === pinId)?.id ?? null;
}

function addPing(place: PlaceRef, excluded: ExcludedPlace[], now: Date, pinId?: string): StoredPing | null {
  const day = dateKey(now);
  const before = loadPings();
  if (pinId && before.some((p) => p.day === day && p.pinId === pinId)) return null;
  const ping = parsePing({
    id: newId(),
    pinId,
    day,
    at: now.toISOString(),
    name: place.name,
    center: place.center,
    address: place.address,
    // At a 제외 주소: on this phone's TODAY, never on the server.
    local: isExcluded(place, excluded),
  });
  if (!ping) return null;
  savePings([...before, ping]);
  return ping;
}

/**
 * A pin deleted on the map: every day's ping added from it goes too. (The
 * other way round doesn't hold: taking a ping out of a day leaves the pin.)
 */
export function removePingsOfPin(pinId: string): void {
  const before = loadPings();
  if (before.some((p) => p.pinId === pinId)) savePings(before.filter((p) => p.pinId !== pinId));
}

/** Takes a ping out of its day (its ✕ on the day screen). The pin itself stays. */
export function removePing(id: string): void {
  const before = loadPings();
  if (before.some((p) => p.id === id)) savePings(before.filter((p) => p.id !== id));
}

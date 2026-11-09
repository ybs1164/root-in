import type { MapViewport } from './districtMap';
import { haversineMeters } from './geo';
import { normalizePlaceName } from './placeMatch';
import type { PlaceRef } from '../types/course';
import type { Course } from '../types/course';
import type { Pin } from '../types/pin';
import type { StoredPing } from './dayPings';
import { APPROVED_POI_STICKERS } from './poiStickerKinds';
import { stickerBelow, stickerBounds } from './poiAppearance';

// Which map places (landmarks and shop stickers) one screen shows.
// Rule: one place per kind per screen — a kind's sticker never appears twice —
// and no sticker or label may touch another's. Places go in by a score made
// of renown, the user's own history (computed on this device only) and a
// stable hash for ties; one that would overlap a better one is left out.
// docs/plan-poi-priority.md.

/** What the user's own data says, on this device only; never uploaded or tracked. */
export interface PlaceProfile {
  /** 0..1 per kind: how much the user's pins, pings and routes lean to it. */
  kinds: Record<string, number>;
  /** Places the user saved or went to: point ×1e5 and normalised name. */
  spots: { x: number; y: number; name: string }[];
}

export const EMPTY_PROFILE: PlaceProfile = { kinds: {}, spots: [] };

export interface SceneCandidate {
  place: PlaceRef;
  /** 0..1, from the data alone (tier, OSM renown, brand recognition). */
  fame: number;
}

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 45;
/** Keeps a single pin from making one kind win every cell. */
const KIND_SHRINK = 2;
const SPOT_LIMIT = 600;
const SPOT_RADIUS_M = 40;
const WEIGHT = { pin: 3, ping: 2, stop: 2 } as const;

const decay = (iso: string | undefined, now: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 0.5;
  return 0.5 ** (Math.max(0, now - t) / DAY_MS / HALF_LIFE_DAYS);
};

export function buildPlaceProfile(
  { pins = [], pings = [], courses = [] }: { pins?: Pin[]; pings?: StoredPing[]; courses?: Course[] },
  now = Date.now(),
): PlaceProfile {
  const weights = new Map<string, number>();
  const add = (kind: string | undefined, weight: number) => {
    if (kind && weight > 0) weights.set(kind, (weights.get(kind) ?? 0) + weight);
  };
  const spots: { at: number; x: number; y: number; name: string }[] = [];
  const spot = (center: [number, number], name: string, at: string | undefined) => {
    const norm = normalizePlaceName(name);
    if (!norm || !center.every(Number.isFinite)) return;
    spots.push({ at: Date.parse(at ?? '') || 0, x: Math.round(center[0] * 1e5), y: Math.round(center[1] * 1e5), name: norm });
  };
  const pinById = new Map(pins.map((pin) => [pin.id, pin]));
  for (const pin of pins) {
    add(pin.place.kind, WEIGHT.pin * decay(pin.updatedAt ?? pin.createdAt, now));
    spot(pin.place.center, pin.place.name, pin.updatedAt ?? pin.createdAt);
  }
  for (const ping of pings) {
    if (ping.local) continue;
    add(ping.pinId ? pinById.get(ping.pinId)?.place.kind : undefined, WEIGHT.ping * decay(ping.at, now));
    spot(ping.center, ping.name, ping.at);
  }
  for (const course of courses) {
    const at = course.updatedAt ?? course.createdAt;
    for (const stop of course.stops) {
      add(stop.place.kind, WEIGHT.stop * decay(at, now));
      spot(stop.place.center, stop.place.name, at);
    }
  }
  const max = Math.max(0, ...weights.values());
  const kinds: Record<string, number> = {};
  for (const [kind, w] of weights) kinds[kind] = Math.round((w / (max + KIND_SHRINK)) * 1000) / 1000;
  const seen = new Set<string>();
  const kept = spots.sort((a, b) => b.at - a.at).filter((s) => {
    const key = `${Math.round(s.x / 10)}:${Math.round(s.y / 10)}:${s.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, SPOT_LIMIT).map(({ x, y, name }) => ({ x, y, name }));
  return { kinds, spots: kept };
}

/** Grid of spots by ~0.001° so scoring thousands of shops stays cheap. */
function spotIndex(profile: PlaceProfile) {
  const grid = new Map<string, PlaceProfile['spots']>();
  for (const s of profile.spots) {
    const key = `${Math.floor(s.x / 100)}:${Math.floor(s.y / 100)}`;
    const list = grid.get(key);
    if (list) list.push(s); else grid.set(key, [s]);
  }
  return (place: PlaceRef): boolean => {
    if (!grid.size) return false;
    const x = Math.round(place.center[0] * 1e5), y = Math.round(place.center[1] * 1e5);
    const name = normalizePlaceName(place.name);
    if (!name) return false;
    const gx = Math.floor(x / 100), gy = Math.floor(y / 100);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const s of grid.get(`${gx + dx}:${gy + dy}`) ?? []) {
        if (s.name !== name && !(name.length > 1 && s.name.length > 1 && (s.name.includes(name) || name.includes(s.name)))) continue;
        if (haversineMeters([s.x / 1e5, s.y / 1e5], place.center) <= SPOT_RADIUS_M) return true;
      }
    }
    return false;
  };
}

/** 0..1. Renown leads; the user's history decides between similar places. */
export function placeScore(fame: number, kindAffinity: number, familiar: boolean): number {
  return 0.6 * fame + 0.2 * kindAffinity + (familiar ? 0.2 : 0);
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
const scaleOf = (viewport: MapViewport) => viewport.worldDegreesPerPixel ??
  (viewport.bounds.east - viewport.bounds.west) / viewport.widthPx;

/**
 * Where a place lands on screen, in CSS px from the screen centre (y down).
 * A turned map's bounds are the box around the screen; the bearing turns
 * the offset into screen axes, while markers themselves stay upright.
 */
export function screenPoint(center: [number, number], viewport: MapViewport): { x: number; y: number } {
  const b = viewport.bounds;
  const scale = scaleOf(viewport);
  const cx = (b.west + b.east) / 2, cy = (mercatorY(b.south) + mercatorY(b.north)) / 2;
  const dx = (center[0] - cx) / scale, dy = (mercatorY(center[1]) - cy) / scale;
  const turn = ((viewport.screen?.bearing ?? 0) * Math.PI) / 180;
  return { x: dx * Math.cos(turn) - dy * Math.sin(turn), y: -(dx * Math.sin(turn) + dy * Math.cos(turn)) };
}

/** On the screen itself: a turned map's bounds are the box around it, corners included. */
export function inScene(center: [number, number], viewport: MapViewport): boolean {
  const b = viewport.bounds;
  const [lon, lat] = center;
  if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) return false;
  const screen = viewport.screen;
  if (!screen || !screen.bearing || !viewport.worldDegreesPerPixel) return true;
  const { x, y } = screenPoint(center, viewport);
  return Math.abs(x) <= screen.width / 2 && Math.abs(y) <= screen.height / 2;
}

export interface Box { left: number; top: number; right: number; bottom: number }

// Mirrors `.map-nearby-place` in styles.css: a column centred on the place —
// 3px padding, a 48px sticker square, a 3px gap, then a one-line name (10px,
// 70px at most; landmarks 11px, 110px; major landmarks add a 4px/1px pill).
// The sticker is scaled to a common visible area, so its real outline
// (stickerBounds) can reach past the square; the name moves down by
// stickerBelow to stay clear of it.
const PAD = 3, GAP = 3, ART = 48, LINE = 14;
const withSticker = new Set<string>(APPROVED_POI_STICKERS);

/** Name width in px, a little generous: Oswald/Do Hyeon are narrow but labels carry a halo. */
export function labelWidth(name: string, fontPx: number): number {
  let em = 0;
  for (const ch of name) {
    if (/\s/u.test(ch)) em += 0.3;
    // Hangul and CJK: one em (measured: 5 syllables at 10px = 50px).
    else if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) em += 1;
    else em += 0.6;
  }
  return em * fontPx;
}

/** The sticker and the name of a place drawn at screen point (x, y). */
export function placeBoxes(place: PlaceRef, x: number, y: number): Box[] {
  const landmark = place.id.startsWith('landmark:');
  const major = landmark && 'importance' in place && (place as { importance?: number }).importance === 0;
  const font = landmark ? 11 : 10;
  const pill = major ? { w: 8, h: 2 } : { w: 0, h: 0 };
  const art = place.kind && withSticker.has(place.kind);
  const nameW = Math.min(landmark ? 110 : 70, labelWidth(place.name, font) + pill.w);
  const nameH = LINE + pill.h;
  const below = art ? stickerBelow(place.kind) : 0;
  const height = PAD * 2 + (art ? ART + GAP + below : 0) + nameH;
  const top = y - height / 2 + PAD;
  const boxes: Box[] = [];
  if (art) {
    const [l, t, r, b] = stickerBounds(place.kind);
    const cy = top + ART / 2;
    boxes.push({ left: x + l, top: cy + t, right: x + r, bottom: cy + b });
  }
  const nameTop = top + (art ? ART + GAP + below : 0);
  boxes.push({ left: x - nameW / 2, top: nameTop, right: x + nameW / 2, bottom: nameTop + nameH });
  return boxes;
}

/** Overlap by any amount, with a 1px margin for the label halo. */
const touches = (a: Box, b: Box) =>
  a.left < b.right + 1 && b.left < a.right + 1 && a.top < b.bottom + 1 && b.top < a.bottom + 1;

/** A saved pin on the map: its 38px marker, centred on the place (styles.css `.map-marker--pin`). */
const PIN_HALF = 19;

/**
 * Keeps places in the given order, leaving out any whose sticker or name
 * would overlap one already kept, or that repeats a kept kind. `avoid` are
 * the user's pins shown on the map: they always win, so no place sticker or
 * name is drawn over them.
 */
export function declutter(ordered: PlaceRef[], viewport: MapViewport, avoid: readonly (readonly [number, number])[] = []): PlaceRef[] {
  const kinds = new Set<string>();
  const taken: Box[] = avoid.map((center) => {
    const { x, y } = screenPoint([center[0], center[1]], viewport);
    return { left: x - PIN_HALF, top: y - PIN_HALF, right: x + PIN_HALF, bottom: y + PIN_HALF };
  });
  const chosen: PlaceRef[] = [];
  for (const place of ordered) {
    const kind = place.kind ?? `id:${place.id}`;
    if (kinds.has(kind)) continue;
    const { x, y } = screenPoint(place.center, viewport);
    const boxes = placeBoxes(place, x, y);
    if (boxes.some((box) => taken.some((other) => touches(box, other)))) continue;
    kinds.add(kind);
    taken.push(...boxes);
    chosen.push(place);
  }
  return chosen;
}

const hash = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * The places one screen shows, best first. `keep` (what is on screen now,
 * when the map was only moved or zoomed in) goes first so panning never swaps
 * a visible place for a better one that just came into view.
 */
export function selectScene(
  candidates: SceneCandidate[], viewport: MapViewport, profile: PlaceProfile = EMPTY_PROFILE,
  keep: ReadonlySet<string> = new Set(), avoid: readonly (readonly [number, number])[] = [],
): PlaceRef[] {
  const familiar = spotIndex(profile);
  const seenIds = new Set<string>();
  const ranked = candidates.flatMap(({ place, fame }) => {
    if (seenIds.has(place.id) || !inScene(place.center, viewport)) return [];
    seenIds.add(place.id);
    const score = placeScore(fame, (place.kind && profile.kinds[place.kind]) || 0, familiar(place));
    return [{ place, score, kept: keep.has(place.id), tie: hash(place.id) }];
  }).sort((a, b) => Number(b.kept) - Number(a.kept) || b.score - a.score || a.tie - b.tie || a.place.id.localeCompare(b.place.id));
  return declutter(ranked.map((r) => r.place), viewport, avoid);
}

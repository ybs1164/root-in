import type { AreaLabel, AreaShapes } from '../domain/adminAreas';
import type { MapViewport } from '../domain/districtMap';
import type { PlaceRef } from '../types/course';
import { pinGlyphSvg } from '../lib/pinGlyphs';
import type { PinIcon, PinTint } from '../types/pin';
import { pinColorCss } from '../domain/pin';

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Everything the UI needs from a map. Components talk only to this, so the
 * Kakao SDK and the MapLibre fallback stay swappable (CLAUDE.md).
 */
export interface CourseMap {
  readonly provider: 'kakao' | 'maplibre';
  /** Numbered markers for the stops, joined by a dashed straight line. */
  setCourse(stops: PlaceRef[]): void;
  /** A distinct marker for a search result the user is looking at. */
  setPreview(place: PlaceRef | null): void;
  /** The phone's own position (a dot, not tappable); null hides it. */
  setMyLocation(center: [number, number] | null): void;
  /** Saved pins, colored/iconed by category. Drawn under the course markers. */
  setPins(pins: PinMarker[]): void;
  /** We Now: a group's pings (dots, each member's latest as their face); [] clears them. Not tappable. */
  setGroupPings(marks: GroupPingMark[]): void;
  /** A faint dashed line (e.g. "이 카테고리 잇기"); not a saved course. */
  setGuideLine(points: [number, number][] | null): void;
  /**
   * Administrative-area map of the visible area: hides the SDK's own tiles
   * under the background color and draws the squared-off sub-areas of the focus
   * above its whole neighbors, with their names. null restores the tiles.
   * Polygons are only redrawn when `parts` / `others` are new arrays, so a
   * labels-only update is cheap.
   */
  setAreaMap(shapes: AreaShapes | null): void;
  /** Repaints the areas from the colour tokens (after the 기본/다크 switch). */
  refreshColors(): void;
  /** Shows or fades out the faint tint over the 읍면동 in the middle (out while a route is on show, as its names are). */
  setAreaTint(shown: boolean): void;
  /**
   * Resolves once the map has finished moving there (never rejects).
   * `glideMs` overrides how long the glide takes (e.g. to keep pace with the
   * route title sliding over when stepping between routes).
   */
  fitCourse(padding: MapPadding, glideMs?: number): Promise<void>;
  /** Fits arbitrary points (pins, a guide line). Resolves once the move ends. */
  fitPoints(points: [number, number][], padding: MapPadding, glideMs?: number): Promise<void>;
  focus(center: [number, number], padding?: MapPadding): void;
  /** Pans so `center` sits in the middle of the map, leaving the zoom as it is. */
  centerOn(center: [number, number]): void;
  /** Turns one-finger / mouse dragging of the map on or off (off while a route is drawn over pins). */
  setPanEnabled(enabled: boolean): void;
  getCenter(): [number, number];
  /** Call after the container changes size (e.g. sheet resize, rotation). */
  resize(): void;
  destroy(): void;
}

export interface PinMarker {
  id: string;
  center: [number, number];
  icon: PinIcon;
  color: PinTint;
  name: string;
  selected?: boolean;
}

export interface GroupPingMark {
  /** Whose ping, and its place in their day (0 = first): the lines between them are drawn from these. */
  member: string;
  seq: number;
  center: [number, number];
  /** CSS colour of the member. */
  color: string;
  /** Their latest ping: drawn as their face (their profile photo, or the default one). */
  face?: { photo: string | null };
  /** Someone else is picked: this one steps back. */
  faded?: boolean;
  /** The place's name under it (the picked member's pings only). */
  label?: string;
  /** The photo sent from there, shown as the ping's head (a few per member at a time, App picks). */
  photo?: string;
  /** The ping tapped on (its place is in the panel under the group's title). */
  selected?: boolean;
}

export interface CourseMapOptions {
  center: [number, number];
  onStopClick?: (index: number) => void;
  onPinClick?: (id: string) => void;
  /** Long-press (touch) on the map itself. */
  onLongPress?: (center: [number, number]) => void;
  /** The visible area, once the map settles after a pan/zoom (and at start). */
  onViewportChange?: (viewport: MapViewport) => void;
  /** The map's centre while it moves (every step of a pan, zoom or glide), before it settles. */
  onMove?: (center: [number, number]) => void;
}

export const SEOUL_CENTER: [number, number] = [126.978, 37.5665];

/** Credit line for the boundary data (KOGL Type 1 requires it). */
export const ADMIN_ATTRIBUTION = '행정경계: 통계청 SGIS · admdongkor';

/** Shared marker DOM so both map providers look identical. */
export function createMarkerElement(label: string, variant: 'stop' | 'preview', onClick?: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `map-marker map-marker--${variant}`;
  // The place about to be pinned wears 미분류's plain pin (what it starts as).
  if (variant === 'preview') el.innerHTML = pinGlyphSvg('pin');
  else el.textContent = label;
  el.setAttribute('aria-label', variant === 'stop' ? `${label}번 장소` : '선택한 장소');
  // Its place in the route, for the lines the app draws between stops.
  if (variant === 'stop') el.dataset.stop = label;
  if (onClick) {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
  } else {
    el.tabIndex = -1;
  }
  return el;
}

/** Where you are: a dot with a soft ring. Taps go through to the map. */
export function createMyLocationElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'map-me';
  el.setAttribute('aria-label', '내 위치');
  el.setAttribute('role', 'img');
  return el;
}

/** An area's name on the map: not a button, taps go through to the map. */
export function createAreaLabelElement(label: AreaLabel): HTMLElement {
  const el = document.createElement('div');
  el.className = `map-area-label${label.part ? '' : ' map-area-label--other'}`;
  el.textContent = label.name;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Keeps one marker per label key: a label that only moved is moved, not
 * rebuilt, and markers for labels no longer shown are removed.
 */
export function syncAreaLabels<M>(
  current: Map<string, { label: AreaLabel; marker: M }>,
  labels: AreaLabel[],
  ops: { create(label: AreaLabel): M; move(marker: M, label: AreaLabel): void; remove(marker: M): void },
): void {
  const wanted = new Map(labels.map((l) => [`${l.part ? 'p' : 'o'}:${l.key}:${l.name}`, l]));
  for (const [id, entry] of current) {
    if (!wanted.has(id)) {
      ops.remove(entry.marker);
      current.delete(id);
    }
  }
  for (const [id, label] of wanted) {
    const entry = current.get(id);
    if (!entry) current.set(id, { label, marker: ops.create(label) });
    else if (entry.label.at[0] !== label.at[0] || entry.label.at[1] !== label.at[1]) {
      ops.move(entry.marker, label);
      entry.label = label;
    }
  }
}

/** The default profile picture (lucide's UserRound), as on the profile button. */
const DEFAULT_FACE_SVG =
  '<svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';

export function createGroupPingElement(mark: GroupPingMark): HTMLElement {
  const el = document.createElement('div');
  el.className = `group-ping${mark.face ? ' group-ping--face' : ' group-ping--pin'}${mark.faded ? ' is-faded' : ''}${mark.selected ? ' is-selected' : ''}${mark.photo ? ' has-photo' : ''}`;
  el.style.setProperty('--member', mark.color);
  el.dataset.member = mark.member;
  el.dataset.seq = String(mark.seq);
  el.setAttribute('aria-hidden', 'true');
  if (mark.face) {
    const face = document.createElement('span');
    face.className = 'group-ping__face';
    if (mark.face.photo) {
      const img = document.createElement('img');
      img.src = mark.face.photo;
      img.alt = '';
      face.append(img);
    } else face.innerHTML = DEFAULT_FACE_SVG;
    el.append(face);
  } else {
    // A ping, not a bare dot: the pin glyph in the member's colour, its tip on the spot.
    const pin = document.createElement('span');
    pin.className = 'group-ping__pin';
    pin.innerHTML = pinGlyphSvg('pin');
    el.append(pin);
  }
  if (mark.photo) {
    // The photo as the ping's head: a small rounded print in the member's colour, its tail on the spot (over the face, if it's their latest).
    const head = document.createElement('span');
    head.className = 'group-ping__photo';
    const img = document.createElement('img');
    img.src = mark.photo;
    img.alt = '';
    img.draggable = false;
    head.append(img);
    el.append(head);
  }
  if (mark.label) {
    const label = document.createElement('span');
    label.className = 'group-ping__label';
    label.textContent = mark.label;
    el.append(label);
  }
  return el;
}

export function createPinElement(pin: PinMarker, onClick?: (id: string) => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `map-marker map-marker--pin${pin.selected ? ' is-selected' : ''}`;
  el.style.setProperty('--pin', pinColorCss(pin.color));
  // The category's solid glyph in the pin colour, no disc behind it.
  el.innerHTML = pinGlyphSvg(pin.icon);
  el.setAttribute('aria-label', pin.name);
  // Lets a finger drawing a route over the map find the pin under it.
  el.dataset.pinId = pin.id;
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick?.(pin.id);
  });
  return el;
}

const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;

/**
 * Long-press on touch, reported as a container point. Neither map SDK has a
 * touch long-press event, so both providers share this. A right-click
 * (a trackpad's two-finger click) is not a press: it only keeps the
 * browser's own menu off the map. Returns a detach function.
 */
export function attachLongPress(container: HTMLElement, onPress: (x: number, y: number) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
  };
  const point = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const onTouchStart = (event: TouchEvent) => {
    cancel();
    // A second finger means pinch-zoom, not a press.
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    start = { x: touch.clientX, y: touch.clientY };
    timer = setTimeout(() => {
      if (!start) return;
      const p = point(start.x, start.y);
      cancel();
      onPress(p.x, p.y);
    }, LONG_PRESS_MS);
  };
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!start || !touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > LONG_PRESS_SLOP_PX) cancel();
  };
  const onContextMenu = (event: MouseEvent) => event.preventDefault();
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', cancel);
  container.addEventListener('touchcancel', cancel);
  container.addEventListener('contextmenu', onContextMenu);
  return () => {
    cancel();
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', cancel);
    container.removeEventListener('touchcancel', cancel);
    container.removeEventListener('contextmenu', onContextMenu);
  };
}

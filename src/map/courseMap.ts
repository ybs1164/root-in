import type { DistrictMap, MapViewport } from '../domain/districtMap';
import type { PlaceRef } from '../types/course';
import type { PinColor } from '../types/pin';

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
  /** Saved pins, colored/iconed by category. Drawn under the course markers. */
  setPins(pins: PinMarker[]): void;
  /** A faint dashed line (e.g. "이 카테고리 잇기"); not a saved course. */
  setGuideLine(points: [number, number][] | null): void;
  /**
   * Illustrated block map of the visible area: hides the basemap under the
   * road color and draws only the rounded blocks. null restores the basemap.
   */
  setDistrictMap(district: DistrictMap | null): void;
  fitCourse(padding: MapPadding): void;
  /** Fits arbitrary points (pins, a guide line). */
  fitPoints(points: [number, number][], padding: MapPadding): void;
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
  emoji: string;
  color: PinColor;
  name: string;
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
}

export const SEOUL_CENTER: [number, number] = [126.978, 37.5665];

/** Shared marker DOM so both map providers look identical. */
export function createMarkerElement(label: string, variant: 'stop' | 'preview', onClick?: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `map-marker map-marker--${variant}`;
  el.textContent = label;
  el.setAttribute('aria-label', variant === 'stop' ? `${label}번 장소` : '선택한 장소');
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

export function createPinElement(pin: PinMarker, onClick?: (id: string) => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `map-marker map-marker--pin${pin.selected ? ' is-selected' : ''}`;
  el.style.setProperty('--pin', `var(--pin-${pin.color})`);
  el.textContent = pin.emoji;
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

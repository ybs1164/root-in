import type { PlaceRef } from '../types/course';

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
  fitCourse(padding: MapPadding): void;
  focus(center: [number, number], padding?: MapPadding): void;
  getCenter(): [number, number];
  /** Call after the container changes size (e.g. sheet resize, rotation). */
  resize(): void;
  destroy(): void;
}

export interface CourseMapOptions {
  center: [number, number];
  onStopClick?: (index: number) => void;
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

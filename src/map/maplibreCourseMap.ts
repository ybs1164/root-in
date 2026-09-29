import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PlaceRef } from '../types/course';
import {
  attachLongPress,
  createMarkerElement,
  createPinElement,
  type CourseMap,
  type CourseMapOptions,
  type MapPadding,
  type PinMarker,
} from './courseMap';

// Keyless fallback basemap for development / when the Kakao SDK is unavailable.
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const LINE_SOURCE = 'course-line';
const GUIDE_SOURCE = 'guide-line';
const FOCUS_ZOOM = 15;

export class MapLibreCourseMap implements CourseMap {
  readonly provider = 'maplibre' as const;
  private readonly map: MapLibreMap;
  private stops: PlaceRef[] = [];
  private stopMarkers: Marker[] = [];
  private previewMarker: Marker | null = null;
  private pinMarkers: Marker[] = [];
  private guide: [number, number][] = [];
  private readonly detachLongPress: () => void;

  constructor(container: HTMLElement, private readonly options: CourseMapOptions) {
    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: options.center,
      zoom: 12,
      attributionControl: { compact: true },
    });
    this.detachLongPress = attachLongPress(container, (x, y) => {
      const at = this.map.unproject([x, y]);
      options.onLongPress?.([at.lng, at.lat]);
    });
    this.map.on('load', () => {
      const token = (name: string, fallback: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
      this.map.addSource(GUIDE_SOURCE, { type: 'geojson', data: this.guideData() });
      this.map.addLayer({
        id: GUIDE_SOURCE,
        type: 'line',
        source: GUIDE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': token('--muted', '#8b7d74'), 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [0.5, 2] },
      });
      this.map.addSource(LINE_SOURCE, { type: 'geojson', data: this.lineData() });
      this.map.addLayer({
        id: LINE_SOURCE,
        type: 'line',
        source: LINE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#e0664f',
          'line-width': 4,
          'line-opacity': 0.85,
          'line-dasharray': [1.5, 1.5],
        },
      });
    });
  }

  private lineData(): GeoJSON.Feature<GeoJSON.LineString> {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: this.stops.length >= 2 ? this.stops.map((s) => s.center) : [] },
    };
  }

  private guideData(): GeoJSON.Feature<GeoJSON.LineString> {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: this.guide.length >= 2 ? this.guide : [] },
    };
  }

  setPins(pins: PinMarker[]): void {
    this.pinMarkers.forEach((m) => m.remove());
    this.pinMarkers = pins.map((pin) =>
      new maplibregl.Marker({ element: createPinElement(pin, this.options.onPinClick) }).setLngLat(pin.center).addTo(this.map),
    );
  }

  setGuideLine(points: [number, number][] | null): void {
    this.guide = points ?? [];
    const source = this.map.getSource(GUIDE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(this.guideData());
  }

  fitPoints(points: [number, number][], padding: MapPadding): void {
    if (points.length === 0) return;
    if (points.length === 1) return this.focus(points[0], padding);
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((p) => bounds.extend(p));
    this.map.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 });
  }

  setCourse(stops: PlaceRef[]): void {
    this.stops = stops;
    this.stopMarkers.forEach((m) => m.remove());
    this.stopMarkers = stops.map((stop, index) =>
      new maplibregl.Marker({
        element: createMarkerElement(String(index + 1), 'stop', () => this.options.onStopClick?.(index)),
      })
        .setLngLat(stop.center)
        .addTo(this.map),
    );
    const source = this.map.getSource(LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(this.lineData());
  }

  setPreview(place: PlaceRef | null): void {
    this.previewMarker?.remove();
    this.previewMarker = place
      ? new maplibregl.Marker({ element: createMarkerElement('＋', 'preview') }).setLngLat(place.center).addTo(this.map)
      : null;
  }

  fitCourse(padding: MapPadding): void {
    this.fitPoints(
      this.stops.map((s) => s.center),
      padding,
    );
  }

  focus(center: [number, number], padding?: MapPadding): void {
    // `offset`, not `padding`: easeTo's padding sticks to the map and would
    // be added to the next fitBounds padding, making the course unfittable.
    const offset: [number, number] = padding
      ? [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2]
      : [0, 0];
    this.map.easeTo({ center, zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM), offset, duration: 500 });
  }

  getCenter(): [number, number] {
    const c = this.map.getCenter();
    return [c.lng, c.lat];
  }

  resize(): void {
    this.map.resize();
  }

  destroy(): void {
    this.detachLongPress();
    this.map.remove();
  }
}

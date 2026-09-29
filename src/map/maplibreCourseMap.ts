import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PlaceRef } from '../types/course';
import { createMarkerElement, type CourseMap, type CourseMapOptions, type MapPadding } from './courseMap';

// Keyless fallback basemap for development / when the Kakao SDK is unavailable.
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const LINE_SOURCE = 'course-line';
const FOCUS_ZOOM = 15;

export class MapLibreCourseMap implements CourseMap {
  readonly provider = 'maplibre' as const;
  private readonly map: MapLibreMap;
  private stops: PlaceRef[] = [];
  private stopMarkers: Marker[] = [];
  private previewMarker: Marker | null = null;

  constructor(container: HTMLElement, private readonly options: CourseMapOptions) {
    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: options.center,
      zoom: 12,
      attributionControl: { compact: true },
    });
    this.map.on('load', () => {
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
    if (this.stops.length === 0) return;
    if (this.stops.length === 1) return this.focus(this.stops[0].center, padding);
    const bounds = new maplibregl.LngLatBounds();
    this.stops.forEach((s) => bounds.extend(s.center));
    this.map.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 });
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
    this.map.remove();
  }
}

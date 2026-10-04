import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AreaShapes } from '../domain/adminAreas';
import type { PlaceRef } from '../types/course';
import {
  attachLongPress,
  createMarkerElement,
  createPinElement,
  type CourseMap,
  type CourseMapOptions,
  type MapPadding,
  type PinMarker,
  ADMIN_ATTRIBUTION,
} from './courseMap';

const LINE_SOURCE = 'course-line';
const GUIDE_SOURCE = 'guide-line';
const AREA_COVER = 'area-cover';
const AREA_OTHERS = 'area-others';
const AREA_PARTS = 'area-parts';
// The cover hides the background outside Korea too, like the Kakao cover.
const WORLD: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
};
const FOCUS_ZOOM = 15;
export class MapLibreCourseMap implements CourseMap {
  readonly provider = 'maplibre' as const;
  private readonly map: MapLibreMap;
  private stops: PlaceRef[] = [];
  private stopMarkers: Marker[] = [];
  private previewMarker: Marker | null = null;
  private pinMarkers: Marker[] = [];
  private guide: [number, number][] = [];
  private areas: AreaShapes | null = null;
  private readonly detachLongPress: () => void;

  constructor(container: HTMLElement, private readonly options: CourseMapOptions) {
    this.map = new maplibregl.Map({
      container,
      style: {
        version: 8, sources: {},
        layers: [{ id: 'background', type: 'background', paint: {
          'background-color': getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim() || '#f4ede2',
        } }],
      },
      center: options.center,
      zoom: 12,
      attributionControl: { compact: true },
    });
    this.detachLongPress = attachLongPress(container, (x, y) => {
      const at = this.map.unproject([x, y]);
      options.onLongPress?.([at.lng, at.lat]);
    });
    const emitViewport = () => {
      const b = this.map.getBounds();
      // Turned, the bounds are the box around the rotated screen; report the
      // pixel width of that box so meters per pixel (and with it the area
      // gaps, sized in pixels) stay true.
      const turn = (this.map.getBearing() * Math.PI) / 180;
      const widthPx = container.clientWidth * Math.abs(Math.cos(turn)) + container.clientHeight * Math.abs(Math.sin(turn));
      options.onViewportChange?.({
        bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        widthPx,
      });
    };
    this.map.on('load', emitViewport);
    this.map.on('moveend', emitViewport);
    this.map.on('load', () => {
      const token = (name: string, fallback: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
      // Added first so the guide/course lines draw above the areas.
      const fill = (id: string, color: string) => {
        this.map.addSource(id, {
          type: 'geojson', data: this.areaData(id),
          ...(id === AREA_PARTS ? { attribution: ADMIN_ATTRIBUTION } : {}),
        });
        this.map.addLayer({ id, type: 'fill', source: id, paint: { 'fill-color': color } });
      };
      fill(AREA_COVER, token('--map-bg', '#f4ede2'));
      fill(AREA_OTHERS, token('--map-area-other', '#d6dfdc'));
      fill(AREA_PARTS, token('--map-area', '#a9c1c1'));
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

  private areaData(id: string): GeoJSON.FeatureCollection {
    const areas = this.areas;
    const polygons = (list: AreaShapes['parts']): GeoJSON.Feature[] =>
      list.map((rings) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } }));
    let features: GeoJSON.Feature[] = [];
    if (areas && id === AREA_COVER) features = [{ type: 'Feature', properties: {}, geometry: WORLD }];
    if (areas && id === AREA_OTHERS) features = polygons(areas.others);
    if (areas && id === AREA_PARTS) features = polygons(areas.parts);
    return { type: 'FeatureCollection', features };
  }

  setAreaMap(shapes: AreaShapes | null): void {
    this.areas = shapes;
    for (const id of [AREA_COVER, AREA_OTHERS, AREA_PARTS]) {
      (this.map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(this.areaData(id));
    }
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

  setBearing(bearing: number): void {
    if (Math.abs(this.map.getBearing() - bearing) < 0.5) return;
    this.map.easeTo({ bearing, duration: 700 });
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

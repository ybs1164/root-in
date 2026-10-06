import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AreaLabel, AreaShapes } from '../domain/adminAreas';
import type { PlaceRef } from '../types/course';
import {
  attachLongPress,
  createAreaLabelElement,
  createMarkerElement,
  createPinElement,
  syncAreaLabels,
  type CourseMap,
  type CourseMapOptions,
  type MapPadding,
  type PinMarker,
  ADMIN_ATTRIBUTION,
} from './courseMap';

/** A route's glide into view (App waits for its end before playing the route in). */
const GLIDE_MS = 1000;
const FOCUS_MS = 500;

/** Slow at both ends, with no sudden push in the middle. */
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

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
  private areaLabels = new Map<string, { label: AreaLabel; marker: Marker }>();
  private readonly detachLongPress: () => void;
  /** Set once the style has loaded: the map renders from then on. */
  private ready = false;

  constructor(container: HTMLElement, private readonly options: CourseMapOptions) {
    this.map = new maplibregl.Map({
      container,
      style: {
        version: 8, sources: {},
        layers: [{ id: 'background', type: 'background', paint: {
          'background-color': getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim() || '#f7f9fc',
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
        screen: { width: container.clientWidth, height: container.clientHeight, bearing: this.map.getBearing() },
      });
    };
    this.map.on('load', emitViewport);
    this.map.on('load', () => {
      this.ready = true;
    });
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
      fill(AREA_COVER, token('--map-bg', '#f7f9fc'));
      fill(AREA_OTHERS, token('--map-area-other', '#e1e7f1'));
      fill(AREA_PARTS, token('--map-area', '#c9d7ee'));
      this.map.addSource(GUIDE_SOURCE, { type: 'geojson', data: this.guideData() });
      this.map.addLayer({
        id: GUIDE_SOURCE,
        type: 'line',
        source: GUIDE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': token('--muted', '#8a93a8'), 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [0.5, 2] },
      });
    });
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
    const before = this.areas;
    this.areas = shapes;
    // A labels-only update keeps the same polygon arrays: no re-upload.
    if (!before || !shapes || before.parts !== shapes.parts || before.others !== shapes.others) {
      for (const id of [AREA_COVER, AREA_OTHERS, AREA_PARTS]) {
        (this.map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(this.areaData(id));
      }
    }
    syncAreaLabels(this.areaLabels, shapes?.labels ?? [], {
      create: (label) => {
        const marker = new maplibregl.Marker({ element: createAreaLabelElement(label) }).setLngLat(label.at).addTo(this.map);
        // Markers stack in DOM order: right above the canvas keeps the names
        // under every pin and stop added before or after them.
        this.map.getCanvas().after(marker.getElement());
        return marker;
      },
      move: (marker, label) => marker.setLngLat(label.at),
      remove: (marker) => marker.remove(),
    });
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

  fitPoints(points: [number, number][], padding: MapPadding, glideMs = GLIDE_MS): Promise<void> {
    if (points.length === 0) return Promise.resolve();
    if (points.length === 1) {
      this.focus(points[0], padding);
      return this.moveSettled(this.duration(FOCUS_MS));
    }
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((p) => bounds.extend(p));
    // Slow enough to read as a glide, gently eased in and out. A plain ease, not the default fly's
    // zoom-out-and-back arc, which on a short hop reads as a lurch.
    this.map.fitBounds(bounds, { padding, maxZoom: 16, linear: true, easing: easeInOutSine, duration: this.duration(glideMs) });
    return this.moveSettled(this.duration(glideMs));
  }

  /**
   * The end of the move just started (`ms` long; 0 = a jump, already over).
   * Listened for after starting it: starting a move ends the one before,
   * whose moveend must not count. The eased tail of a glide is too slow to
   * see, so it counts as over a little early; a move that never starts
   * (already there) or never runs (no render) still resolves.
   */
  private moveSettled(ms: number): Promise<void> {
    if (ms === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        this.map.off('moveend', done);
        resolve();
      };
      const timer = window.setTimeout(done, ms * 0.9);
        this.map.on('moveend', done);
    });
  }

  // Only the numbered stops: the lines between them are StopLines' (drawn in
  // as the stops land), so the map draws none of its own ahead of them.
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
  }

  setPreview(place: PlaceRef | null): void {
    this.previewMarker?.remove();
    this.previewMarker = place
      ? new maplibregl.Marker({ element: createMarkerElement('', 'preview') }).setLngLat(place.center).addTo(this.map)
      : null;
  }

  fitCourse(padding: MapPadding, glideMs?: number): Promise<void> {
    return this.fitPoints(
      this.stops.map((s) => s.center),
      padding,
      glideMs,
    );
  }

  focus(center: [number, number], padding?: MapPadding): void {
    // `offset`, not `padding`: easeTo's padding sticks to the map and would
    // be added to the next fitBounds padding, making the course unfittable.
    const offset: [number, number] = padding
      ? [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2]
      : [0, 0];
    this.map.easeTo({ center, zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM), offset, duration: this.duration(FOCUS_MS) });
  }

  /**
   * Animated moves only run while the map renders, and it doesn't until its
   * style has loaded (a slow or blocked basemap): an ease then never gets
   * anywhere. Until then, moves jump straight there. (Not isStyleLoaded():
   * that is also false for a moment after any source's setData, as when a
   * route's stops are put on the map just before gliding to them.)
   */
  private duration(ms: number): number {
    return this.ready ? ms : 0;
  }

  setPanEnabled(enabled: boolean): void {
    if (enabled) this.map.dragPan.enable();
    else this.map.dragPan.disable();
  }

  centerOn(center: [number, number]): void {
    this.map.easeTo({ center, duration: this.duration(400) });
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

import type { AreaShapes } from '../domain/adminAreas';
import type { KakaoMapInstance, KakaoMapsNamespace } from '../lib/kakaoSdk';
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

type Overlay = { setMap(map: KakaoMapInstance | null): void };

const FOCUS_LEVEL = 4;

export class KakaoCourseMap implements CourseMap {
  readonly provider = 'kakao' as const;
  private readonly map: KakaoMapInstance;
  private stops: PlaceRef[] = [];
  private stopOverlays: Overlay[] = [];
  private preview: Overlay | null = null;
  private pinOverlays: Overlay[] = [];
  private guide: Overlay | null = null;
  private areaOverlays: Overlay[] = [];
  private readonly container: HTMLElement;
  private attribution: HTMLElement | null = null;
  private readonly detachLongPress: () => void;

  constructor(
    private readonly maps: KakaoMapsNamespace,
    container: HTMLElement,
    private readonly options: CourseMapOptions,
  ) {
    this.container = container;
    this.map = new maps.Map(container, { center: this.latLng(options.center), level: 6 });
    this.detachLongPress = attachLongPress(container, (x, y) => {
      const at = this.map.getProjection().coordsFromContainerPoint(new maps.Point(x, y));
      options.onLongPress?.([at.getLng(), at.getLat()]);
    });
    const emitViewport = () => {
      const b = this.map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      options.onViewportChange?.({
        bounds: { west: sw.getLng(), south: sw.getLat(), east: ne.getLng(), north: ne.getLat() },
        widthPx: container.clientWidth,
      });
    };
    maps.event.addListener(this.map, 'idle', emitViewport);
    // Not every SDK version fires idle for the first render.
    setTimeout(emitViewport, 0);
  }

  private routeColor(token: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
  }

  setAreaMap(shapes: AreaShapes | null): void {
    this.areaOverlays.forEach((o) => o.setMap(null));
    this.areaOverlays = [];
    this.attribution?.remove();
    this.attribution = null;
    if (!shapes) return;
    const polygon = (rings: [number, number][][], color: string, zIndex: number) =>
      new this.maps.Polygon({
        path: rings.map((ring) => ring.map((p) => this.latLng(p))),
        strokeWeight: 0,
        strokeOpacity: 0,
        fillColor: color,
        fillOpacity: 1,
        zIndex,
        map: this.map,
      });
    // Kakao tiles can't be restyled, so a Korea-sized polygon hides them;
    // the areas sit on top of it and the gaps between them show through.
    const cover = polygon([[[120, 30], [135, 30], [135, 45], [120, 45]]], this.routeColor('--map-bg', '#f7f9fc'), 0);
    const otherColor = this.routeColor('--map-area-other', '#e1e7f1');
    const partColor = this.routeColor('--map-area', '#c9d7ee');
    this.areaOverlays = [
      cover,
      ...shapes.others.map((rings) => polygon(rings, otherColor, 1)),
      ...shapes.parts.map((rings) => polygon(rings, partColor, 2)),
    ];
    // Boundaries come from Statistics Korea (KOGL Type 1: credit required).
    this.attribution = document.createElement('div');
    this.attribution.className = 'map-attribution';
    this.attribution.textContent = ADMIN_ATTRIBUTION;
    this.container.appendChild(this.attribution);
  }

  setPins(pins: PinMarker[]): void {
    this.pinOverlays.forEach((o) => o.setMap(null));
    this.pinOverlays = pins.map(
      (pin) =>
        new this.maps.CustomOverlay({
          position: this.latLng(pin.center),
          content: createPinElement(pin, this.options.onPinClick),
          yAnchor: 0.5,
          zIndex: pin.selected ? 4 : 1,
          map: this.map,
        }),
    );
  }

  setGuideLine(points: [number, number][] | null): void {
    this.guide?.setMap(null);
    this.guide =
      points && points.length >= 2
        ? new this.maps.Polyline({
            path: points.map((p) => this.latLng(p)),
            strokeWeight: 3,
            strokeColor: this.routeColor('--muted', '#8a93a8'),
            strokeOpacity: 0.8,
            strokeStyle: 'shortdot',
            map: this.map,
          })
        : null;
  }

  fitPoints(points: [number, number][], padding: MapPadding): Promise<void> {
    if (points.length === 0) return Promise.resolve();
    if (points.length === 1) {
      this.focus(points[0]);
      return Promise.resolve();
    }
    const bounds = new this.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(this.latLng(p)));
    // setBounds jumps: the map is there as soon as it returns.
    this.map.setBounds(bounds, padding.top, padding.right, padding.bottom, padding.left);
    return Promise.resolve();
  }

  private latLng([lon, lat]: [number, number]) {
    return new this.maps.LatLng(lat, lon);
  }

  // Only the numbered stops: the lines between them are StopLines' (drawn in
  // as the stops land), so the map draws none of its own ahead of them.
  setCourse(stops: PlaceRef[]): void {
    this.stops = stops;
    this.stopOverlays.forEach((o) => o.setMap(null));

    this.stopOverlays = stops.map(
      (stop, index) =>
        new this.maps.CustomOverlay({
          position: this.latLng(stop.center),
          content: createMarkerElement(String(index + 1), 'stop', () => this.options.onStopClick?.(index)),
          yAnchor: 0.5,
          zIndex: 2,
          map: this.map,
        }),
    );
  }

  setPreview(place: PlaceRef | null): void {
    this.preview?.setMap(null);
    this.preview = place
      ? new this.maps.CustomOverlay({
          position: this.latLng(place.center),
          content: createMarkerElement('', 'preview'),
          yAnchor: 0.5,
          zIndex: 3,
          map: this.map,
        })
      : null;
  }

  // setBounds jumps, so there's no glide to time (`glideMs` is moot here).
  fitCourse(padding: MapPadding, _glideMs?: number): Promise<void> {
    return this.fitPoints(
      this.stops.map((s) => s.center),
      padding,
    );
  }

  focus(center: [number, number]): void {
    if (this.map.getLevel() > FOCUS_LEVEL) this.map.setLevel(FOCUS_LEVEL);
    this.map.panTo(this.latLng(center));
  }

  setBearing(): void {
    // The Kakao JS SDK has no map rotation; the areas stay north-up.
  }

  setPanEnabled(enabled: boolean): void {
    this.map.setDraggable(enabled);
  }

  centerOn(center: [number, number]): void {
    this.map.panTo(this.latLng(center));
  }

  getCenter(): [number, number] {
    const c = this.map.getCenter();
    return [c.getLng(), c.getLat()];
  }

  resize(): void {
    this.map.relayout();
  }

  destroy(): void {
    this.detachLongPress();
    this.setAreaMap(null);
    this.pinOverlays.forEach((o) => o.setMap(null));
    this.guide?.setMap(null);
    this.stopOverlays.forEach((o) => o.setMap(null));
    this.preview?.setMap(null);
  }
}

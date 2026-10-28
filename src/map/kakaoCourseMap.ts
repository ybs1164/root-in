import type { AreaLabel, AreaShapes } from '../domain/adminAreas';
import type { KakaoMapInstance, KakaoMapsNamespace } from '../lib/kakaoSdk';
import type { PlaceRef } from '../types/course';
import { colourAlpha, colourToken } from '../lib/cssColour';
import {
  attachLongPress,
  createAreaLabelElement,
  createMarkerElement,
  createPreviewElement,
  createMyLocationElement,
  createPinElement,
  createNearbyPlaceElement,
  syncNearbyPlaces,
  syncAreaLabels,
  type CourseMap,
  type CourseMapOptions,
  type MapPadding,
  type PinMarker,
  ADMIN_ATTRIBUTION,
  createGroupPingElement,
  type GroupPingMark,
} from './courseMap';
import { MAP_LAYERS, SHADOW, TONE_TOKENS, WATER_TOKEN, pickKakaoLand, type MapLayerId } from './mapStyle';

type Overlay = { setMap(map: KakaoMapInstance | null): void };
type KakaoPolygon = InstanceType<KakaoMapsNamespace['Polygon']>;
type KakaoPolyline = InstanceType<KakaoMapsNamespace['Polyline']>;
type Fill = { fillColor: string; fillOpacity: number };

/**
 * Stacking of the map's own shapes (all under the overlays: names, pins,
 * stops), in the same order as MapLibre's layers (mapStyle.ts MAP_LAYERS).
 */
const Z = Object.fromEntries(MAP_LAYERS.map((layer, i) => [layer.id, i])) as Record<MapLayerId, number>;
/** A cover this big hides Kakao's tiles everywhere the app can go. */
const KOREA_BOX: [number, number][][] = [[[120, 30], [135, 30], [135, 45], [120, 45]]];
type KakaoOverlay = InstanceType<KakaoMapsNamespace['CustomOverlay']>;

const FOCUS_LEVEL = 4;

export class KakaoCourseMap implements CourseMap {
  readonly provider = 'kakao' as const;
  private readonly map: KakaoMapInstance;
  private stops: PlaceRef[] = [];
  private stopOverlays: Overlay[] = [];
  private preview: Overlay | null = null;
  private me: (Overlay & { setPosition(position: ReturnType<KakaoCourseMap['latLng']>): void }) | null = null;
  private pinOverlays: Overlay[] = [];
  private nearbyOverlays = new Map<string, KakaoOverlay>();
  private groupOverlays: Overlay[] = [];
  private guide: Overlay | null = null;
  private areas: AreaShapes | null = null;
  private areaCover: KakaoPolygon | null = null;
  private partPolygons: KakaoPolygon[] = [];
  private landPolygons: KakaoPolygon[] = [];
  private parkPolygons: KakaoPolygon[] = [];
  private roadLines: KakaoPolyline[] = [];
  private shadowPolygons: KakaoPolygon[] = [];
  private tintShown = true;
  private areaLabels = new Map<string, { label: AreaLabel; marker: KakaoOverlay }>();
  private readonly container: HTMLElement;
  private attribution: HTMLElement | null = null;
  private readonly detachLongPress: () => void;
  private readonly sizeWatch: ResizeObserver | null;

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
        screen: { width: container.clientWidth, height: container.clientHeight, bearing: 0 },
      });
    };
    maps.event.addListener(this.map, 'idle', emitViewport);
    maps.event.addListener(this.map, 'center_changed', () => {
      if (!options.onMove) return;
      const c = this.map.getCenter();
      options.onMove([c.getLng(), c.getLat()]);
    });
    // Not every SDK version fires idle for the first render.
    setTimeout(emitViewport, 0);
    // Unlike MapLibre, the Kakao map never re-measures its element. In the
    // iOS WebView the first layout can be shorter than the final screen, which
    // left the map's centre high up and its lower part dead to touches.
    this.sizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.sizeWatch?.observe(container);
  }

  private routeColor(token: string, fallback: string): string {
    return colourToken(token, fallback);
  }

  /** A layer's colour (mapStyle.ts), solid. */
  private layerColour(id: MapLayerId): string {
    const layer = MAP_LAYERS.find((l) => l.id === id)!;
    return this.routeColor(layer.token, layer.fallback);
  }

  /**
   * The cover over Kakao's tiles: water under the base map's land once it is
   * there, plain land until then (or where there are no tiles), so the screen
   * is never a blank sheet of water.
   */
  private coverFill(): Fill {
    return { fillColor: this.areas?.base ? this.routeColor(WATER_TOKEN.token, WATER_TOKEN.fallback) : this.layerColour('area-cover'), fillOpacity: 1 };
  }

  /**
   * The 동 tint of part `i`, in its tone (neighbours differ, M11):
   * see-through (Kakao takes the colour and its opacity apart), none while
   * a route is shown.
   */
  private tint(i: number): Fill {
    const tone = this.areas?.partTones?.[i] ?? 0;
    const { colour, alpha } = colourAlpha(TONE_TOKENS[tone] ?? '--map-tint', '#6c90d8', 0.12);
    return { fillColor: colour, fillOpacity: this.tintShown ? alpha : 0 };
  }

  /** The soft shadow outside the split 동 (cut to the outside in the worker). */
  private shadowFill(): Fill {
    return { fillColor: this.layerColour('area-shadow'), fillOpacity: this.tintShown ? SHADOW.opacity : 0 };
  }

  private recolourTints(): void {
    this.partPolygons.forEach((o, i) => o.setOptions(this.tint(i)));
    const shadow = this.shadowFill();
    this.shadowPolygons.forEach((o) => o.setOptions(shadow));
  }

  refreshColors(): void {
    this.areaCover?.setOptions(this.coverFill());
    this.landPolygons.forEach((o) => o.setOptions({ fillColor: this.layerColour('base-land') }));
    this.parkPolygons.forEach((o) => o.setOptions({ fillColor: this.layerColour('base-parks') }));
    this.roadLines.forEach((o) => o.setOptions({ strokeColor: this.layerColour('base-roads') }));
    this.recolourTints();
  }

  setAreaTint(shown: boolean): void {
    if (shown === this.tintShown) return;
    this.tintShown = shown;
    this.recolourTints();
  }

  setAreaMap(shapes: AreaShapes | null): void {
    const before = this.areas;
    this.areas = shapes;
    if (!shapes) {
      [this.areaCover, ...this.partPolygons, ...this.landPolygons, ...this.shadowPolygons, ...this.parkPolygons, ...this.roadLines].forEach((o) => o?.setMap(null));
      this.areaCover = null;
      this.partPolygons = [];
      this.landPolygons = [];
      this.shadowPolygons = [];
      this.parkPolygons = [];
      this.roadLines = [];
      this.attribution?.remove();
      this.attribution = null;
    } else {
      // Kakao tiles can't be restyled, so a Korea-sized polygon hides them;
      // the base map's land (water is where there is none) and the 동 tint
      // go on it, in MapLibre's order. Neighborhood parks and streets sit
      // above the tint, with nearby places below saved pins.
      if (!this.areaCover) this.areaCover = this.polygon(KOREA_BOX, this.coverFill(), Z['area-cover']);
      else if (!before?.base !== !shapes.base) this.areaCover.setOptions(this.coverFill());
      if (!before || before.base !== shapes.base) this.drawBase();
      // Existing polygons take the new outlines: building hundreds of SDK
      // objects per pan was much of the wait.
      if (!before || before.parts !== shapes.parts) {
        this.shadowPolygons = this.reshape(this.shadowPolygons, shapes.partsDrop ?? [], () => this.shadowFill(), Z['area-shadow']);
        this.partPolygons = this.reshape(this.partPolygons, shapes.parts, (i) => this.tint(i), Z['area-parts']);
      }
      if (!this.attribution) {
        // Boundaries come from Statistics Korea (KOGL Type 1: credit required).
        this.attribution = document.createElement('div');
        this.attribution.className = 'map-attribution';
        this.attribution.textContent = ADMIN_ATTRIBUTION;
        this.container.appendChild(this.attribution);
      }
    }
    syncAreaLabels(this.areaLabels, shapes?.labels ?? [], {
      create: (label) => new this.maps.CustomOverlay({
        position: this.latLng(label.at),
        content: createAreaLabelElement(label),
        // Under the pins (1) and stops.
        zIndex: 0,
        map: this.map,
      }),
      move: (overlay, label) => overlay.setPosition(this.latLng(label.at)),
      remove: (overlay) => overlay.setMap(null),
    });
  }

  /** The base map's land as SDK objects, capped (pickKakaoLand) and reused between updates. */
  private drawBase(): void {
    const land = pickKakaoLand(this.areas?.base);
    this.landPolygons = this.reshape(this.landPolygons, land, () => ({ fillColor: this.layerColour('base-land'), fillOpacity: 1 }), Z['base-land']);
    this.parkPolygons = this.reshape(this.parkPolygons, this.areas?.base?.parks ?? [], () => ({ fillColor: this.layerColour('base-parks'), fillOpacity: 1 }), Z['base-parks']);
    const roads = this.areas?.base?.roads ?? [];
    roads.forEach((road, i) => {
      const path = road.path.map((p) => this.latLng(p));
      const style = { strokeWeight: road.width, strokeColor: this.layerColour('base-roads') };
      if (this.roadLines[i]) {
        this.roadLines[i].setPath(path);
        this.roadLines[i].setOptions(style);
      } else this.roadLines.push(new this.maps.Polyline({ path, ...style, strokeOpacity: 1, strokeStyle: 'solid', zIndex: Z['base-roads'], map: this.map }));
    });
    this.roadLines.splice(roads.length).forEach((o) => o.setMap(null));
  }

  private polygon(rings: [number, number][][], fill: Fill, zIndex: number): KakaoPolygon {
    return new this.maps.Polygon({
      path: rings.map((ring) => ring.map((p) => this.latLng(p))),
      strokeWeight: 0,
      strokeOpacity: 0,
      ...fill,
      zIndex,
      map: this.map,
    });
  }
  /** Polygons for `list`, reusing those already on the map (new path, and the fill for that index — tones move). */
  private reshape(existing: KakaoPolygon[], list: [number, number][][][], fill: (i: number) => Fill, zIndex: number): KakaoPolygon[] {
    list.forEach((rings, i) => {
      existing[i]?.setPath(rings.map((ring) => ring.map((p) => this.latLng(p))));
      existing[i]?.setOptions(fill(i));
    });
    existing.slice(list.length).forEach((o) => o.setMap(null));
    return [...existing.slice(0, list.length), ...list.slice(existing.length).map((rings, k) => this.polygon(rings, fill(existing.length + k), zIndex))];
  }

  setNearbyPlaces(places: PlaceRef[]): void {
    syncNearbyPlaces(this.nearbyOverlays, places, {
      create: (place) => new this.maps.CustomOverlay({
        position: this.latLng(place.center), content: createNearbyPlaceElement(place, this.options.onNearbyPlaceClick),
        yAnchor: 0.5, zIndex: 0, map: this.map,
      }),
      remove: (overlay) => overlay.setMap(null),
    });
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

  setGroupPings(marks: GroupPingMark[]): void {
    this.groupOverlays.forEach((o) => o.setMap(null));
    this.groupOverlays = marks.map(
      (mark) =>
        new this.maps.CustomOverlay({
          position: this.latLng(mark.center),
          content: createGroupPingElement(mark),
          yAnchor: 0.5,
          // Faces over the dots, photos over those, the picked member's over everyone else's, the tapped one over all.
          zIndex: (mark.face ? 3 : 2) + (mark.photo ? 2 : 0) + (mark.faded ? 0 : 4) + (mark.selected ? 8 : 0),
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

  setMyLocation(center: [number, number] | null): void {
    if (!center) {
      this.me?.setMap(null);
      this.me = null;
      return;
    }
    // Moved, not rebuilt: the position updates every few seconds.
    if (this.me) return this.me.setPosition(this.latLng(center));
    this.me = new this.maps.CustomOverlay({ position: this.latLng(center), content: createMyLocationElement(), yAnchor: 0.5, zIndex: 0, map: this.map });
  }

  setPreview(place: PlaceRef | null): void {
    this.preview?.setMap(null);
    this.preview = place
      ? new this.maps.CustomOverlay({
          position: this.latLng(place.center),
          content: createPreviewElement(place),
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

  focus(center: [number, number], padding?: MapPadding): void {
    if (this.map.getLevel() > FOCUS_LEVEL) this.map.setLevel(FOCUS_LEVEL);
    if (!padding) return this.map.panTo(this.latLng(center));
    // As MapLibre's `offset`: `center` lands in the middle of the padded box.
    // The view only shifts, so the map centre to pan to is where `center` is now, less that offset.
    const projection = this.map.getProjection();
    const at = projection.containerPointFromCoords(this.latLng(center));
    const dx = (padding.left - padding.right) / 2;
    const dy = (padding.top - padding.bottom) / 2;
    this.map.panTo(projection.coordsFromContainerPoint(new this.maps.Point(at.x - dx, at.y - dy)));
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
    const center = this.map.getCenter();
    this.map.relayout();
    this.map.setCenter(center);
  }

  destroy(): void {
    this.detachLongPress();
    this.sizeWatch?.disconnect();
    this.setNearbyPlaces([]);
    this.setAreaMap(null);
    this.pinOverlays.forEach((o) => o.setMap(null));
    this.guide?.setMap(null);
    this.stopOverlays.forEach((o) => o.setMap(null));
    this.preview?.setMap(null);
    this.me?.setMap(null);
  }
}

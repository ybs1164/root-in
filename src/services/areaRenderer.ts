import { areaRenderWindow, renderAreaMap, type AreaLabel, type AreaShapes } from '../domain/adminAreas';
import { placeAreaLabels, sameLabels, type LabelCover } from '../domain/areaLabels';
import type { Bbox, LonLat, MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService, type AdminAreaService } from './adminAreaService';

/** What changed on the map: new shapes (with their labels), or only the labels. */
export type AreaUpdate = { shapes: AreaShapes } | { labels: AreaLabel[] };

/**
 * Shapes are redrawn once the zoom drifts this far (as a power of two) from
 * the one they were drawn for: gaps and corner radii are in screen pixels,
 * and within ±0.25 zoom they stay within about 20% of their size.
 */
const RESCALE_LOG2 = 0.25;

const inside = (inner: Bbox, outer: Bbox) =>
  inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;
const degPerPx = (viewport: MapViewport) => (viewport.bounds.east - viewport.bounds.west) / viewport.widthPx;

interface Drawn {
  focusCode: string;
  degPerPx: number;
  window: Bbox;
  shapes: AreaShapes;
  labels: AreaLabel[];
}

/**
 * Turns a screen into area shapes. Rounding the areas is the slow part (tens
 * to hundreds of ms per screen), so a pan that stays inside what the last
 * drawing covered, at about the same zoom and with the same focus, reuses it
 * and only moves the name labels that would leave the screen. Runs in the
 * area worker; on the main thread only where workers aren't available.
 */
export class AreaRenderer {
  private drawn: Drawn | null = null;

  constructor(private readonly service: AdminAreaService = new StaticAdminAreaService()) {}

  /**
   * null: nothing to change (no data, or a newer request took over).
   * `focusAt` picks the area to split; `cover` keeps labels clear of the
   * app's bars and buttons.
   */
  async render(
    viewport: MapViewport,
    at: { focusAt?: LonLat; cover?: LabelCover } = {},
    isCurrent: () => boolean = () => true,
  ): Promise<AreaUpdate | null> {
    const map = await this.service.fetchAreaMap(viewport, at.focusAt);
    if (!map || !isCurrent()) return null;
    const last = this.drawn;
    if (last && last.focusCode === map.focus.code && inside(viewport.bounds, last.window) &&
      Math.abs(Math.log2(degPerPx(viewport) / last.degPerPx)) <= RESCALE_LOG2) {
      const labels = placeAreaLabels(last.shapes, viewport, last.labels, at.cover);
      if (sameLabels(labels, last.labels)) return null;
      last.labels = labels;
      return { labels };
    }
    const shapes = renderAreaMap(map, viewport);
    const labels = placeAreaLabels(shapes, viewport, [], at.cover);
    this.drawn = { focusCode: map.focus.code, degPerPx: degPerPx(viewport), window: areaRenderWindow(viewport), shapes, labels };
    // The tags only serve label placement, which stays here.
    const { partTags: _p, otherTags: _o, ...drawnShapes } = shapes;
    return { shapes: { ...drawnShapes, labels } };
  }
}

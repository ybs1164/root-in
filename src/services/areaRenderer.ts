import { AreaShapeCache, areaFocusKey, areaRenderWindow, renderAreaDraft, renderAreaMap, type AreaLabel, type AreaMap, type AreaShapes } from '../domain/adminAreas';
import { placeAreaLabels, sameLabels, type LabelCover } from '../domain/areaLabels';
import type { Bbox, MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService, type AdminAreaService } from './adminAreaService';

/** What changed on the map: new shapes (with their labels), or only the labels. */
export type AreaUpdate = { shapes: AreaShapes } | { labels: AreaLabel[] };

/**
 * Shapes are redrawn once the zoom drifts this far (as a power of two) from
 * the one they were drawn for: gaps and corner radii are in screen pixels,
 * and within ±0.25 zoom they stay within about 20% of their size.
 */
const RESCALE_LOG2 = 0.25;
/**
 * A full drawing slower than this (ms) on this device is preceded by a quick
 * draft whenever the screen shows parts nothing was drawn for yet.
 */
const DRAFT_AFTER_MS = 120;

/** Lets a newer screen's message in before the slow part starts. */
const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
  private readonly cache = new AreaShapeCache();
  /**
   * How long the last full drawing took, per level (the focus code's length:
   * 시도, 시군구, 읍면동); unknown, so drafted, until then.
   */
  private drawMs = new Map<number, number>();

  constructor(private readonly service: AdminAreaService = new StaticAdminAreaService()) {}

  /**
   * null: nothing to change (no data, or a newer request took over).
   * `focusRange` picks the area to split; `cover` keeps labels clear of the
   * app's bars and buttons. `onDraft` gets a quick stand-in first when the
   * full drawing is likely to keep part of the screen empty for a while.
   */
  async render(
    viewport: MapViewport,
    at: { focusRange?: Bbox; cover?: LabelCover } = {},
    isCurrent: () => boolean = () => true,
    onDraft?: (update: AreaUpdate) => void,
  ): Promise<AreaUpdate | null> {
    const map = await this.service.fetchAreaMap(viewport, at.focusRange);
    if (!map || !isCurrent()) return null;
    const last = this.drawn;
    if (last && last.focusCode === areaFocusKey(map) && inside(viewport.bounds, last.window) &&
      Math.abs(Math.log2(degPerPx(viewport) / last.degPerPx)) <= RESCALE_LOG2) {
      const labels = placeAreaLabels(last.shapes, viewport, last.labels, at.cover);
      if (sameLabels(labels, last.labels)) return null;
      last.labels = labels;
      return { labels };
    }
    // Zooming in or a new focus keeps the old shapes up meanwhile; only a
    // screen reaching past them (first load, zooming out, a long pan) shows
    // empty map, and gets the draft.
    let draftLabels: AreaLabel[] = [];
    if (onDraft && (!last || !inside(viewport.bounds, last.window)) && (this.drawMs.get(map.focus.code.length) ?? Infinity) > DRAFT_AFTER_MS) {
      const draft = renderAreaDraft(map, viewport, this.cache);
      draftLabels = placeAreaLabels(draft, viewport, [], at.cover);
      onDraft(this.update(draft, draftLabels));
      // The map now shows the draft, not the last drawing.
      this.drawn = null;
    }
    await yieldToMessages();
    if (!isCurrent()) return null;
    return this.draw(map, viewport, at.cover, draftLabels);
  }

  private draw(map: AreaMap, viewport: MapViewport, cover: LabelCover | undefined, previous: AreaLabel[]): AreaUpdate {
    const started = performance.now();
    const shapes = renderAreaMap(map, viewport, this.cache);
    this.drawMs.set(map.focus.code.length, performance.now() - started);
    // Names stay where the draft put them if they still fit.
    const labels = placeAreaLabels(shapes, viewport, previous, cover);
    this.drawn = { focusCode: areaFocusKey(map), degPerPx: degPerPx(viewport), window: areaRenderWindow(viewport), shapes, labels };
    return this.update(shapes, labels);
  }

  private update(shapes: AreaShapes, labels: AreaLabel[]): AreaUpdate {
    // The tags only serve label placement, which stays here.
    const { partTags: _p, otherTags: _o, ...drawnShapes } = shapes;
    return { shapes: { ...drawnShapes, labels } };
  }
}

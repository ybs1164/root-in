import type { LonLat, Ring } from './districtMap';

/**
 * Road tiers, widest first (see scripts/korea-data/build_base.py):
 * 1 motorway·trunk (drawn darker), 2 primary·secondary and highway ramps, 3 tertiary,
 * 4 residential·service streets, 5 footpaths·cycleways.
 */
export type RoadTier = 1 | 2 | 3 | 4 | 5;
export const ROAD_TIERS: RoadTier[] = [1, 2, 3, 4, 5];

export interface BaseRoad {
  tier: RoadTier;
  path: LonLat[];
}

/** A polygon as [outer, ...holes]. */
export type PolygonRings = Ring[];

/** The styled base map: water is wherever no land polygon is drawn. */
export interface BaseMap {
  land: PolygonRings[];
  parks: PolygonRings[];
  roads: BaseRoad[];
}

interface TierWidth {
  /** Real-world width the line follows once zoomed in. */
  meters: number;
  /** Floor so a road stays visible zoomed out. */
  minPx: number;
  /** Cap so zooming far in doesn't turn streets into plazas. */
  maxPx: number;
  /** Zoomed out past this scale (m/px) the tier is omitted. */
  hideAboveMpp: number;
}

// Widths roughly follow the reference style: an avenue about two and a half
// times an alley, with the step between neighbouring tiers clearly visible.
// Highways are mapped as one way per direction, a median apart; each line is
// wide enough that the pair overlaps into one dark band.
// Cutoffs drop a tier once its lines would only be 1px noise packed together:
// footpaths past a few blocks, streets past a neighborhood (the detail tiles
// end at 6 m/px), tertiary roads past a district, avenues past a province.
const TIER_WIDTHS: Record<RoadTier, TierWidth> = {
  1: { meters: 24, minPx: 1.5, maxPx: 34, hideAboveMpp: Infinity },
  2: { meters: 28, minPx: 2, maxPx: 40, hideAboveMpp: 400 },
  3: { meters: 19, minPx: 1.5, maxPx: 28, hideAboveMpp: 30 },
  4: { meters: 11, minPx: 1, maxPx: 16, hideAboveMpp: 6 },
  5: { meters: 4, minPx: 1, maxPx: 6, hideAboveMpp: 2.5 },
};

/** Whether a tier is drawn at this scale (meters per CSS pixel). */
export function roadTierVisible(tier: RoadTier, mpp: number): boolean {
  return mpp <= TIER_WIDTHS[tier].hideAboveMpp;
}

/** Line width in CSS pixels for a tier at the given meters per pixel. */
export function roadWidthPx(tier: RoadTier, mpp: number): number {
  const w = TIER_WIDTHS[tier];
  if (!roadTierVisible(tier, mpp)) return 0;
  return Math.min(Math.max(w.meters / Math.max(mpp, 1e-6), w.minPx), w.maxPx);
}

/** Web-mercator meters per CSS pixel at a zoom level (512px tiles). */
export function metersPerPixelAtZoom(zoom: number, lat: number): number {
  return (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

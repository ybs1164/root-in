import * as clipperNs from 'clipper-lib';
import { type DistrictMap, type MapViewport, type Ring } from './districtMap';
const ClipperLib = ((clipperNs as unknown as { default?: typeof clipperNs }).default ?? clipperNs) as typeof clipperNs;
type Point = { X: number; Y: number };
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
export function screenProjection(viewport: MapViewport) {
  const origin = viewport.bounds.west;
  const y0 = mercator((viewport.bounds.south + viewport.bounds.north) / 2);
  const factor = viewport.widthPx / (viewport.bounds.east - origin);
  return {
    project: ([x, y]: [number, number]): Point => ({ X: Math.round((x - origin) * factor * 100), Y: Math.round((mercator(y) - y0) * factor * 100) }),
    unproject: ({ X, Y }: Point): [number, number] => [origin + X / 100 / factor,
      (2 * Math.atan(Math.exp((y0 + Y / 100 / factor) * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI],
  };
}
/** The selected source roads define districts. Union only removes storage
 * partitions; it must never introduce boundaries, insets or new road gaps.
 * Preserve concave outlines and interior water instead of forcing convex cells.
 */
export function renderDistrictMap(map: DistrictMap, viewport: MapViewport): DistrictMap {
  if (map.sourceRoadWidthM === undefined || !map.blocks.length) return map;
  if (!(viewport.widthPx > 0 && viewport.bounds.east > viewport.bounds.west &&
    viewport.bounds.north > viewport.bounds.south)) return map;
  const projection = screenProjection(viewport);
  const source = map.blocks.flatMap((block) => [block.outer, ...block.holes].map((ring, i) => {
    const path = ring.slice(0, -1).map(projection.project);
    if (ClipperLib.Clipper.Orientation(path) !== (i === 0)) path.reverse();
    return path;
  }));
  const union = new ClipperLib.Clipper();
  union.AddPaths(source, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  union.Execute(ClipperLib.ClipType.ctUnion, tree,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const toRing = (path: Point[]): Ring => {
    const ring = path.map(projection.unproject);
    ring.push(ring[0]);
    return ring;
  };
  const blocks: DistrictMap['blocks'] = [];
  const visit = (node: clipperNs.PolyNode) => {
    if (!node.IsHole() && node.Contour().length >= 3) {
      blocks.push({ outer: toRing(node.Contour()),
        holes: node.Childs().filter((child) => child.IsHole()).map((child) => toRing(child.Contour())) });
    }
    node.Childs().forEach(visit);
  };
  tree.Childs().forEach(visit);
  return { ...map, blocks };
}

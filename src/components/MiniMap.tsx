import { useId, useMemo } from 'react';
import { miniMapLayers, terrainParts, type MapDistance, type MapFill, type MapPoint, type MapPart, type MiniMapId, type TerrainShapes } from '../domain/miniMap';
import type { LonLat } from '../domain/districtMap';

/** A fill as CSS: its role's theme token. */
export const fillCss = ({ role }: MapFill): string => `var(--mini-${role})`;

/** The signed area of a ring (its winding: which way round it goes). */
const winding = (ring: MapPoint[]) => ring.reduce((sum, p, i) => sum + (ring[(i + 1) % ring.length].x - p.x) * (ring[(i + 1) % ring.length].y + p.y), 0);

/**
 * A path of rings. Rings that overlap and go the opposite ways round would
 * cancel under the nonzero rule (a hole where a disc meets a bar), so unless
 * the rings are meant to cut holes (even-odd) they are all turned the same way.
 */
const pathOf = (polys: MapPoint[][], sameWay = false) =>
  polys
    .map((ring) => (sameWay && winding(ring) < 0 ? [...ring].reverse() : ring))
    .map((ring) => `M${ring.map((p) => `${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join('L')}Z`)
    .join('');

/**
 * 미니맵 behind a day's pings: the same parts the share image draws, in the
 * unit square the pings are laid out in, painted in order in solid colours
 * (the theme's map tokens). A fill with an alpha (the shadow) is one group
 * faded as a whole, so overlaps stay even, and may be blurred and moved down.
 * 상세 is the real map: `terrain` is what was fetched for the stops (the
 * window alone until it arrives).
 */
export default function MiniMap({ points, centers, style, distance, terrain }: { points: MapPoint[]; centers: LonLat[]; style: MiniMapId; distance: MapDistance; terrain: TerrainShapes | null }) {
  const id = useId().replace(/:/g, '');
  const key = points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ');
  const parts: MapPart[] = useMemo(
    () => (style === 'detail' ? terrainParts(terrain, centers, distance) : miniMapLayers(points, style, centers)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, style, distance, terrain],
  );
  if (!parts.length) return null;
  return (
    <svg className="pings__map" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        {parts.map(
          (part, i) =>
            part.gaps && (
              <mask key={`m${i}`} id={`${id}-g${i}`} maskUnits="userSpaceOnUse" x="-0.5" y="-0.5" width="2" height="2">
                <rect x="-0.5" y="-0.5" width="2" height="2" style={{ fill: 'var(--mask-show)' }} />
                <path d={pathOf(part.polys)} fillRule="evenodd" strokeWidth={part.gaps} strokeLinejoin="round" style={{ fill: 'none', stroke: 'var(--mask-hide)' }} />
              </mask>
            ),
        )}
        {parts.map(
          (part, i) =>
            part.blur && (
              <filter key={i} id={`${id}-b${i}`} filterUnits="userSpaceOnUse" x="-0.5" y="-0.5" width="2" height="2">
                <feGaussianBlur stdDeviation={part.blur} />
              </filter>
            ),
        )}
      </defs>
      {parts.map((part, i) => {
        const colour = fillCss(part.fill);
        return (
          <g key={i} opacity={part.fill.alpha} filter={part.blur ? `url(#${id}-b${i})` : undefined} mask={part.gaps ? `url(#${id}-g${i})` : undefined}>
            {/* Moved down inside the masked group: the gaps stay where the borders are, whatever lies below. */}
            <g transform={part.dy ? `translate(0 ${part.dy})` : undefined}>
              {part.polys.length > 0 && <path d={pathOf(part.polys, !part.evenodd)} fillRule={part.evenodd ? 'evenodd' : 'nonzero'} style={{ fill: colour }} />}
              {part.lines.map(({ a, b, w }, j) => (
                <line key={`l${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={w} strokeLinecap="round" style={{ stroke: colour }} />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

import { useId } from 'react';
import type { MapFill, MapPoint, MapPart } from '../domain/miniMap';

/** A fill as CSS: its role's theme token. */
export const fillCss = ({ role }: MapFill): string => `var(--mini-${role})`;

/** The signed area of a ring (its winding: which way round it goes). */
const winding = (ring: MapPoint[]) => ring.reduce((sum, p, i) => sum + (ring[(i + 1) % ring.length].x - p.x) * (ring[(i + 1) % ring.length].y + p.y), 0);

/**
 * A path of rings. Rings that overlap and go the opposite ways round would
 * cancel under the nonzero rule, so unless the rings are meant to cut holes
 * (even-odd) they are all turned the same way.
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
 */
export default function MiniMap({ parts }: { parts: MapPart[] }) {
  const id = useId().replace(/:/g, '');
  if (!parts.length) return null;
  const colourOf = (part: MapPart) => fillCss(part.fill);
  return (
    <svg className="pings__map" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        {parts.map(
          (part, i) =>
            part.clip && (
              <clipPath key={`c${i}`} id={`${id}-c${i}`}>
                <path d={pathOf(part.clip)} clipRule="evenodd" />
              </clipPath>
            ),
        )}
        {parts.map((part, i) => {
          if (!part.haze) return null;
          const ys = part.polys.flat().map((p) => p.y);
          return (
            <linearGradient key={`h${i}`} id={`${id}-h${i}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={Math.min(...ys)} y2={Math.max(...ys)}>
              <stop offset="0" stopOpacity={part.haze} style={{ stopColor: colourOf(part) }} />
              <stop offset="1" stopOpacity="0" style={{ stopColor: colourOf(part) }} />
            </linearGradient>
          );
        })}
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
        // Haze is its colour fading out top to bottom.
        const colour = part.haze ? `url(#${id}-h${i})` : fillCss(part.fill);
        // Polylines of one width go in one path: a real map has hundreds of roads.
        const widths = [...new Set((part.ways ?? []).map((way) => way.w))];
        return (
          <g key={i} opacity={part.fill.alpha} filter={part.blur ? `url(#${id}-b${i})` : undefined} clipPath={part.clip ? `url(#${id}-c${i})` : undefined}>
            <g transform={part.dy ? `translate(0 ${part.dy})` : undefined}>
              {part.polys.length > 0 && (
                <path
                  d={pathOf(part.polys, !part.evenodd)}
                  fillRule={part.evenodd ? 'evenodd' : 'nonzero'}
                  strokeWidth={part.seal}
                  strokeLinejoin="round"
                  style={{ fill: colour, stroke: part.seal && !part.haze ? colour : 'none' }}
                />
              )}
              {widths.map((w) => (
                <path
                  key={`w${w}`}
                  d={part.ways!.filter((way) => way.w === w).map((way) => `M${way.path.map((p) => `${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join('L')}`).join('')}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ fill: 'none', stroke: colour }}
                />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

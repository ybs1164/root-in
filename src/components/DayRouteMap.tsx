import { useMemo } from 'react';
import { dayMap } from '../domain/miniMap';
import { useTerrain } from '../hooks/useTerrain';
import MiniMap from './MiniMap';

/** One line on the map: its places in order, in its own colour. */
export interface DayRouteTrack {
  id: string;
  /** Any CSS colour (a member's, or the day's ping colour). */
  color: string;
  centers: readonly (readonly [number, number])[];
}

interface DayRouteMapProps {
  tracks: readonly DayRouteTrack[];
  /** One track alone (the others faded), or null for all. */
  only?: string | null;
}

/**
 * A day as calendar H's card draws it: the real map under every place, laid
 * out together, and each track's places joined by a plain line in its colour
 * (small dots, the last one bigger and filled) — no pins, names or photos.
 * Only a picture: no presses. Used by MY's card and a group's.
 */
export default function DayRouteMap({ tracks, only = null }: DayRouteMapProps) {
  const centers = useMemo(() => tracks.flatMap((t) => t.centers.map((c) => [c[0], c[1]] as [number, number])), [tracks]);
  const { shapes: terrain, ready } = useTerrain(centers, true);
  const key = centers.map((c) => c.join(',')).join(' ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => dayMap(terrain, centers), [key, terrain]);
  if (!ready || !day.points.length) return <div className="group-day-map" aria-hidden />;
  let at = 0;
  const drawn = tracks.map((track) => ({ track, points: track.centers.map(() => day.points[at++]) }));
  // The one picked is drawn last, over the others.
  drawn.sort((a, b) => Number(a.track.id === only) - Number(b.track.id === only));
  return (
    <div className="group-day-map" aria-hidden>
      <MiniMap parts={day.parts} />
      <svg className="group-day-map__marks" viewBox="0 0 1 1" preserveAspectRatio="none">
        {drawn.map(({ track, points }) => {
          const faded = only !== null && track.id !== only;
          return (
            <g key={track.id} className={faded ? 'is-faded' : undefined} style={{ color: track.color }}>
              {points.length > 1 && <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 0.034 : 0.022} className={i === points.length - 1 ? 'is-last' : undefined} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

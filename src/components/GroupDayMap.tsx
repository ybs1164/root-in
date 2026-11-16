import { useMemo } from 'react';
import { dayMap } from '../domain/miniMap';
import { memberColor, type GroupMember, type GroupPing } from '../domain/groups';
import { useTerrain } from '../hooks/useTerrain';
import MiniMap from './MiniMap';

interface GroupDayMapProps {
  /** Each member's places that day, in order. */
  lanes: readonly { member: GroupMember; places: readonly GroupPing[] }[];
  /** One member alone (the others faded), or null for all. */
  only: string | null;
}

/**
 * A group's day as TODAY draws one (calendar H's card): the real map under
 * every member's places, laid out together, and each member's places joined
 * in their own colour — the last one bigger. Only a picture: no presses.
 */
export default function GroupDayMap({ lanes, only }: GroupDayMapProps) {
  const centers = useMemo(() => lanes.flatMap((l) => l.places.map((p) => p.center)), [lanes]);
  const { shapes: terrain, ready } = useTerrain(centers, true);
  const key = centers.map((c) => c.join(',')).join(' ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => dayMap(terrain, centers), [key, terrain]);
  if (!ready || !day.points.length) return <div className="group-day-map" aria-hidden />;
  let at = 0;
  const tracks = lanes.map((lane) => {
    const points = lane.places.map(() => day.points[at++]);
    return { lane, points };
  });
  // The one picked is drawn last, over the others.
  tracks.sort((a, b) => Number(a.lane.member.userId === only) - Number(b.lane.member.userId === only));
  return (
    <div className="group-day-map" aria-hidden>
      <MiniMap parts={day.parts} />
      <svg className="group-day-map__marks" viewBox="0 0 1 1" preserveAspectRatio="none">
        {tracks.map(({ lane, points }) => {
          const color = memberColor(lane.member.color);
          const faded = only !== null && lane.member.userId !== only;
          return (
            <g key={lane.member.userId} className={faded ? 'is-faded' : undefined} style={{ color }}>
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

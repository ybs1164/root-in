import { useMemo } from 'react';
import { memberColor, type GroupMember, type GroupPing } from '../domain/groups';
import DayRouteMap from './DayRouteMap';

interface GroupDayMapProps {
  /** Each member's places that day, in order. */
  lanes: readonly { member: GroupMember; places: readonly GroupPing[] }[];
  /** One member alone (the others faded), or null for all. */
  only: string | null;
}

/** A group's day on its calendar card: each member's places joined in their own colour. */
export default function GroupDayMap({ lanes, only }: GroupDayMapProps) {
  const tracks = useMemo(
    () => lanes.map((lane) => ({ id: lane.member.userId, color: memberColor(lane.member.color), centers: lane.places.map((p) => p.center) })),
    [lanes],
  );
  return <DayRouteMap tracks={tracks} only={only} />;
}

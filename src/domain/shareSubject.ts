import type { Course } from '../types/course';
import type { DayDecor, PatternId, ThemeId } from './decor';
import type { DayPing, EdgeStyle, PingShape } from './dayPings';
import { withoutExcluded, type ExcludedPlace } from './privacy';

/** How a stop is drawn on the card: a ping shape, or a route's plain numbered marker. */
export type StopMark = PingShape | 'number';

/**
 * What the 꾸미기 screen makes a polaroid of: a calendar day's pings or a
 * saved route's stops, already cut down to what may be shared (stops on a
 * 제외 주소 are gone), with how each stop and line is drawn.
 */
export interface ShareSubject {
  /** Where its decorations are kept: `day:<date>` or `route:<course id>`. */
  key: string;
  /** Handwritten on the strip under the photo. */
  title: string;
  /** The saved image's name, without the extension. */
  fileName: string;
  pings: DayPing[];
  marks: StopMark[];
  /** `edges[i]` joins `pings[i]` and `pings[i + 1]`. */
  edges: EdgeStyle[];
  /** Stops left out for sitting on a 제외 주소. */
  removed: number;
  /**
   * A day's own 꾸미기 from its day screen (stickers, strokes, text boxes, in
   * its drawing box): drawn into the photo, under the card's own pieces.
   */
  photo?: DayDecor;
  /** The day's theme and pattern, which the card takes on each time it's opened from the day. */
  look?: { theme?: ThemeId; pattern?: PatternId };
}

export const dayDecorKey = (date: string) => `day:${date}`;
export const routeDecorKey = (courseId: string) => `route:${courseId}`;

/** Keys the 꾸미기 store accepts (anything else read back from storage is dropped). */
export const isDecorKey = (key: string): boolean => /^(day:\d{4}-\d{2}-\d{2}|route:[\w-]{1,80})$/.test(key);

/** A day's card title, like a date written on a print: 10.03. */
export const dayCardTitle = (date: string): string => `${date.slice(5, 7)}.${date.slice(8, 10)}`;

/**
 * Joins what was kept back into lines: two stops that were next to each
 * other keep their line's style; stops that only meet because the ones
 * between them were cut get a plain line.
 */
function keptEdges(kept: number[], edgeAt: (index: number) => EdgeStyle): EdgeStyle[] {
  return kept.slice(1).map((to, i) => (to === kept[i] + 1 ? edgeAt(kept[i]) : 'solid'));
}

export function daySubject(
  date: string,
  pings: DayPing[],
  shapeOf: (ping: DayPing) => PingShape,
  edgeStyleOf: (from: DayPing, to: DayPing) => EdgeStyle,
  excluded: ExcludedPlace[],
  decor?: DayDecor,
): ShareSubject {
  const cut = withoutExcluded(pings.map((ping, index) => ({ ping, index })), (k) => k.ping, excluded);
  const kept = cut.kept.map((k) => k.index);
  return {
    key: dayDecorKey(date),
    title: dayCardTitle(date),
    fileName: `root-in-${date}`,
    pings: cut.kept.map((k) => k.ping),
    marks: cut.kept.map((k) => shapeOf(k.ping)),
    edges: keptEdges(kept, (i) => edgeStyleOf(pings[i], pings[i + 1])),
    removed: cut.removed,
    ...(decor
      ? {
          photo: { stickers: decor.stickers, strokes: decor.strokes, ...(decor.texts ? { texts: decor.texts } : {}) },
          look: { theme: decor.theme, pattern: decor.pattern },
        }
      : {}),
  };
}

export function routeSubject(course: Course, excluded: ExcludedPlace[]): ShareSubject {
  const cut = withoutExcluded(course.stops.map((stop, index) => ({ stop, index })), (k) => k.stop.place, excluded);
  const kept = cut.kept.map((k) => k.index);
  return {
    key: routeDecorKey(course.id),
    title: course.title,
    fileName: `root-in-${course.title}`,
    // Routes have no visiting times; the card only names the stops.
    pings: cut.kept.map((k) => ({ name: k.stop.place.name, time: '', center: k.stop.place.center })),
    marks: kept.map((i) => course.stopShapes?.[i] ?? 'number'),
    edges: keptEdges(kept, (i) => course.edgeStyles?.[i] ?? 'solid'),
    removed: cut.removed,
  };
}

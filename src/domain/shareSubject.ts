import type { RouteEdgeStyle, RouteStopShape } from './routeStyle';
import type { PinIcon } from '../types/pin';
import type { Course } from '../types/course';
import type { DayDecor } from './decor';
import type { PolaroidLayout } from './polaroid';
import { addressArea, addressRoute } from './addressRoute';
import type { DayPing, EdgeStyle, PingShape } from './dayPings';
import { withoutExcluded, type ExcludedPlace } from './privacy';

/** How a stop is drawn on the card: a ping shape, or a route's plain numbered marker. */
export type StopMark = RouteStopShape | 'number';

/**
 * What the 꾸미기 screen makes a polaroid of: a calendar day's pings or a
 * saved route's stops, already cut down to what may be shared (stops on a
 * 제외 주소 are gone), with how each stop and line is drawn.
 */
export interface ShareSubject {
  /** Handwritten on the strip under the photo. */
  title: string;
  /** The saved image's name, without the extension. */
  fileName: string;
  pings: DayPing[];
  marks: StopMark[];
  /** `edges[i]` joins `pings[i]` and `pings[i + 1]`. */
  edges: RouteEdgeStyle[];
  icons?: PinIcon[];
  /** Stops left out for sitting on a 제외 주소. */
  removed: number;
  /**
   * A day's own 꾸미기 from its day screen (pieces in its drawing box, its
   * theme and pattern): the photo shows the day just as it looks there,
   * apart from the card's own theme, pattern and pieces.
   */
  photo?: DayDecor;
  /** What the boarding pass and the notebook's handwriting say. */
  stamp: CardStamp;
}

/** The 탑승권 and 노트 layouts' words: when, how many stops, and where (a route's first stop). */
export interface CardStamp {
  /** YYYY-MM-DD */
  date: string;
  stops: number;
  /** The pass's FROM → TO, in English (addressRoute). */
  from?: string;
  to?: string;
  /** The neighbourhood in Korean, for the notebook. */
  area?: string;
}

/**
 * The card laid out another way. 없음 (no card) on a day's card takes on the
 * day's own ground too, its theme and pattern, so the whole screen becomes
 * the day as it was decorated before sharing (both can still be changed after).
 */
export function withLayout(decor: DayDecor, layout: PolaroidLayout, photo?: DayDecor): DayDecor {
  if (layout !== 'bare' || !photo) return { ...decor, layout };
  const { theme: _t, pattern: _p, ...rest } = decor;
  return { ...rest, layout, ...(photo.theme ? { theme: photo.theme } : {}), ...(photo.pattern ? { pattern: photo.pattern } : {}) };
}

/** A local YYYY-MM-DD for a saved time. */
const localDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};


/** A day's card title, like a date written on a print: 10.03. */
export const dayCardTitle = (date: string): string => `${date.slice(5, 7)}.${date.slice(8, 10)}`;

/**
 * Joins what was kept back into lines: two stops that were next to each
 * other keep their line's style; stops that only meet because the ones
 * between them were cut get a plain line.
 */
function keptEdges(kept: number[], edgeAt: (index: number) => RouteEdgeStyle): RouteEdgeStyle[] {
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
    title: dayCardTitle(date),
    fileName: `root-in-${date}`,
    pings: cut.kept.map((k) => k.ping),
    marks: cut.kept.map((k) => shapeOf(k.ping)),
    edges: keptEdges(kept, (i) => edgeStyleOf(pings[i], pings[i + 1])),
    removed: cut.removed,
    stamp: { date, stops: cut.kept.length },
    ...(decor ? { photo: decor } : {}),
  };
}

export function routeSubject(course: Course, excluded: ExcludedPlace[], icons?: PinIcon[]): ShareSubject {
  const cut = withoutExcluded(course.stops.map((stop, index) => ({ stop, index })), (k) => k.stop.place, excluded);
  const kept = cut.kept.map((k) => k.index);
  return {
    ...(icons ? { icons: kept.map((i) => icons[i] ?? 'pin') } : {}),
    title: course.title,
    fileName: `root-in-${course.title}`,
    // Routes have no visiting times; the card only names the stops.
    pings: cut.kept.map((k) => ({ name: k.stop.place.name, time: '', center: k.stop.place.center })),
    marks: kept.map((i) => course.stopShapes?.[i] ?? 'number'),
    edges: keptEdges(kept, (i) => course.edgeStyles?.[i] ?? 'solid'),
    removed: cut.removed,
    stamp: routeStamp(course, cut.kept.map((k) => k.stop.place.address)),
  };
}

function routeStamp(course: Course, addresses: (string | undefined)[]): CardStamp {
  const address = addresses.find(Boolean);
  const route = addressRoute(address);
  const area = addressArea(address);
  return {
    date: localDate(course.createdAt),
    stops: addresses.length,
    ...(route ? { from: route.from, ...(route.to ? { to: route.to } : {}) } : {}),
    ...(area ? { area } : {}),
  };
}

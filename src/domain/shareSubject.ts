import type { RouteEdgeStyle, RouteStopShape } from './routeStyle';
import type { PinIcon } from '../types/pin';
import type { Course } from '../types/course';
import type { DayDecor, PlacedText } from './decor';
import { cardToScene, DEFAULT_LAYOUT, LAYOUT_CARDS, POLAROID, SCENE, sceneToCard, STRIP, type PolaroidLayout } from './polaroid';
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
  /** Where the title goes by default: the strip's middle, or its right end (a day's date, like a print's). */
  titleAt?: TitlePlace;
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

export type TitlePlace = 'middle' | 'corner';

/**
 * The card's title as a text box (scene fractions), where it's written by
 * default: handwritten on the front card's strip, in its middle or (a day's
 * date) toward its bottom right, turned with the card.
 */
export function cardTitleText(title: string, layout: PolaroidLayout = DEFAULT_LAYOUT, place: TitlePlace = 'middle'): PlacedText {
  const front = LAYOUT_CARDS[layout].front;
  const at =
    place === 'corner'
      ? cardToScene(front, POLAROID.w * 0.8, STRIP.y + STRIP.h * 0.55)
      : cardToScene(front, POLAROID.w / 2, STRIP.y + STRIP.h * 0.48);
  return {
    id: 'card-title',
    text: title,
    x: at.x / SCENE.w,
    y: at.y / SCENE.h,
    size: (110 * (front.scale ?? 1)) / SCENE.w,
    rotate: front.angle,
    font: 'pen',
    color: 'ink-black',
    align: place === 'corner' ? 'right' : 'center',
  };
}

/** A card's 꾸미기 with its title put down once as a text box (left alone after that, even if it was thrown away). */
export function withCardTitle(decor: DayDecor, title: string, place: TitlePlace = 'middle'): DayDecor {
  if (decor.titled) return decor;
  return { ...decor, texts: [...(decor.texts ?? []), cardTitleText(title, decor.layout, place)], titled: true };
}

/**
 * The card laid out another way: the title box (if it's still there) goes
 * with the photo card, keeping where it was on the card, its turn and size
 * relative to it. Everything else stays where it was on the scene.
 */
export function withLayout(decor: DayDecor, layout: PolaroidLayout): DayDecor {
  const from = LAYOUT_CARDS[decor.layout ?? DEFAULT_LAYOUT].front;
  const to = LAYOUT_CARDS[layout].front;
  const texts = decor.texts?.map((t) => {
    if (t.id !== 'card-title') return t;
    const onCard = sceneToCard(from, t.x * SCENE.w, t.y * SCENE.h);
    const at = cardToScene(to, onCard.x, onCard.y);
    return {
      ...t,
      x: Math.min(1, Math.max(0, at.x / SCENE.w)),
      y: Math.min(1, Math.max(0, at.y / SCENE.h)),
      size: (t.size * (to.scale ?? 1)) / (from.scale ?? 1),
      rotate: (t.rotate ?? 0) - from.angle + to.angle,
    };
  });
  return { ...decor, ...(texts ? { texts } : {}), layout };
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
    titleAt: 'corner',
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

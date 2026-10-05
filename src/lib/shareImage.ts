import type { RouteEdgeStyle } from '../domain/routeStyle';
import type { PinIcon } from '../types/pin';
import { pinGlyphSvg } from './pinGlyphs';
import { latestPingIndex, layoutPings, type DayPing, type EdgeStyle } from '../domain/dayPings';
import { ERASER_SCALE, getSticker, isCustomColor, PEN_WIDTHS, TEXT_LINE_HEIGHT, textFamily, textWeight, type DayDecor, type PlacedText, type ThemeId } from '../domain/decor';
import { CLOTHESLINE, clotheslineY, DEFAULT_LAYOUT, DRAWING_BOX, LAYOUT_CARDS, POLAROID, SCENE, TICKET, type CardPose, type PolaroidLayout } from '../domain/polaroid';
import type { CardStamp, StopMark } from '../domain/shareSubject';
import { paintPattern } from './dayPatterns';
import { HEART_PATH, PIN_PATH, shapeBox, STAR_PATH } from './pingPaths';
import { labelSide } from '../domain/stopLabels';

export interface ShareImageInput {
  pings: DayPing[];
  /** How each ping is drawn, by index. */
  marks: StopMark[];
  /** `edges[i]` joins `pings[i]` and `pings[i + 1]`. */
  edges: RouteEdgeStyle[];
  icons?: PinIcon[];
  /** Stickers, pen strokes, text boxes, theme and pattern; pieces in scene fractions (0..1 of its width / height). */
  decor?: DayDecor;
  /** Leave the card's stickers, strokes and text boxes off (the 꾸미기 screen lays its own over the image). */
  withoutPieces?: boolean;
  /**
   * A day's own 꾸미기 from its day screen (pieces in the drawing box, its
   * theme and pattern): the photo is drawn as that screen looks, in the
   * day's colours and pattern whatever the card's own theme, then turned
   * with the card. Left out (a route), the photo takes the card's theme.
   */
  photo?: DayDecor;
  /** The pass's and the notebook's words (탑승권, 노트 layouts). */
  stamp?: CardStamp;
  /** Drawn smaller (the layout picker's previews): a fraction of the full size. */
  scale?: number;
}

const W = SCENE.w;
const H = SCENE.h;
const PHOTO = POLAROID.photo;
const BOX = DRAWING_BOX;

/** Colours come from the page's own tokens, so the image matches the app (and its theme). */
function tokens() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return {
    backdrop: get('--accent-soft'),
    card: get('--polaroid'),
    cardShadow: get('--polaroid-shadow'),
    photo: get('--surface-2'),
    page: get('--surface'),
    text: get('--text'),
    muted: get('--muted'),
    accent: get('--accent'),
    onAccent: get('--on-accent'),
    route: get('--route'),
    perforation: get('--perforation'),
    arrow: get('--ticket-arrow'),
    peg: get('--clothespin'),
    pegShade: get('--clothespin-shade'),
    font: getComputedStyle(document.body).fontFamily,
  };
}

const DASHES: Record<EdgeStyle, { width: number; dash: number[]; cap: CanvasLineCap }> = {
  solid: { width: 9, dash: [], cap: 'round' },
  dashed: { width: 9, dash: [34, 22], cap: 'butt' },
  dotted: { width: 12, dash: [0.1, 26], cap: 'round' },
  bold: { width: 19, dash: [], cap: 'round' },
};

/**
 * Draws the share image: two polaroids lying askew on the backdrop (its
 * theme colour and pattern), the front one holding the photo (the lines and
 * stops laid out as the day screen does), and the 꾸미기 pieces over all of
 * it (the strip's title among them). Returns a PNG data URL.
 * Drawn from the data rather than screenshotting the DOM: sharp at any
 * size, and no capture library needed.
 */
export async function renderShareImage({ pings, marks, edges, decor, withoutPieces, photo, icons, stamp, scale = 1 }: ShareImageInput): Promise<string> {
  await document.fonts?.ready;
  // Web fonts load only once something shows them; make sure the strip's
  // hand and the text boxes' fonts are in before drawing (one that won't
  // load falls back).
  await Promise.all([
    ...[...(withoutPieces ? [] : (decor?.texts ?? [])), ...(photo?.texts ?? [])].map((t) =>
      document.fonts?.load(textFont(t, 40), t.text).catch(() => undefined),
    ),
    // The pass's caps and the notebook's hand.
    document.fonts?.load(`40px ${CAPS}`, 'SEOUL').catch(() => undefined),
    document.fonts?.load(`40px ${textFamily('pen')}`, '2026. 성수').catch(() => undefined),
  ]);
  const layout: PolaroidLayout = decor?.layout ?? DEFAULT_LAYOUT;
  const cards = LAYOUT_CARDS[layout];
  const c = tokens();
  const pinImages = await Promise.all(marks.map(async (mark, i) => {
    if (mark !== 'transparent') return null;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinGlyphSvg(icons?.[i] ?? 'pin').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('fill="currentColor"', `color="${c.accent}" fill="${c.accent}"`))}`;
    await img.decode();
    return img;
  }));
  // Decode local sticker assets before painting either the day photo or the card.
  const stickerImages = new Map<string, HTMLImageElement>();
  const stickerIds = new Set([...(withoutPieces ? [] : decor?.stickers ?? []), ...(photo?.stickers ?? [])].map((s) => s.stickerId));
  await Promise.all([...stickerIds].map(async (id) => {
    const sticker = getSticker(id);
    if (!sticker) return;
    const img = new Image();
    img.src = sticker.src;
    await img.decode();
    stickerImages.set(id, img);
  }));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  drawBackdrop(ctx, c, layout);
  // The background pattern, as a still frame even if it flows on screen.
  if (decor?.pattern) paintPattern(ctx, decor.pattern, { w: W, h: H }, W / 390, c.accent);
  if (layout === 'ticket') drawTicket(ctx, c, stamp);

  // The blank card behind (두 장), then the one with the photo.
  if (cards.back) {
    onCard(ctx, cards.back, () => {
      drawPaper(ctx, c);
      ctx.fillStyle = c.photo;
      ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    });
  }
  onCard(ctx, cards.front, () => {
    drawPaper(ctx, c);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    ctx.clip();
    // A day's photo is its day screen as it looks there: its page colour,
    // pattern, pin colours and pieces, in its own theme.
    withTheme(photo ? (photo.theme ?? 'default') : null, () => {
      const p = tokens();
      const bg = photo ? p.page : p.photo;
      ctx.fillStyle = bg;
      ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
      if (photo?.pattern) {
        ctx.save();
        ctx.translate(PHOTO.x, PHOTO.y);
        // Tiles at the size they have beside the day's drawing (its box is 360 css px at most).
        paintPattern(ctx, photo.pattern, { w: PHOTO.w, h: PHOTO.h }, BOX.size / 360, p.accent);
        ctx.restore();
      }
      drawStops(ctx, p, bg, pings, marks, edges, pinImages);
      if (photo) drawDecor(ctx, photo, BOX_FRAME, stickerImages);
    });
    ctx.restore();
    // The strip's title is one of the card's text boxes (withCardTitle), drawn with the pieces.
    if (layout === 'tape') drawTape(ctx, c);
    if (layout === 'notebook') drawClip(ctx, c);
  });
  if (layout === 'line') drawPegs(ctx, c);
  if (layout === 'notebook') drawNoteDate(ctx, c, stamp);

  if (decor && !withoutPieces) drawDecor(ctx, decor, SCENE_FRAME, stickerImages);
  return canvas.toDataURL('image/png');
}

/**
 * Runs `draw` with the page in `theme`'s colours (null: as it is), for
 * reading its tokens, then puts the page's own theme back. All in one go,
 * so the page never shows the borrowed theme.
 */
function withTheme(theme: ThemeId | null, draw: () => void) {
  const root = document.documentElement;
  const before = root.dataset.theme;
  if (theme === null || (theme === 'default' ? before === undefined : before === theme)) return draw();
  if (theme === 'default') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    draw();
  } finally {
    if (before === undefined) delete root.dataset.theme;
    else root.dataset.theme = before;
  }
}

/** Draws in a card's own pixels (0..POLAROID.w/h), as the card lies on the scene. */
function onCard(ctx: CanvasRenderingContext2D, pose: CardPose, draw: () => void) {
  ctx.save();
  ctx.translate(pose.cx, pose.cy);
  ctx.rotate((pose.angle * Math.PI) / 180);
  ctx.scale(pose.scale ?? 1, pose.scale ?? 1);
  ctx.translate(-POLAROID.w / 2, -POLAROID.h / 2);
  draw();
  ctx.restore();
}

type Tokens = ReturnType<typeof tokens>;

/** The boarding pass's condensed caps (the calendar title's face). */
const CAPS = '"Bebas Neue", "Oswald", sans-serif';

/** Runs `draw` with the canvas a little see-through. */
function faint(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) {
  ctx.save();
  ctx.globalAlpha = alpha;
  draw();
  ctx.restore();
}

/**
 * What the cards lie on: plain white in every layout (the card paper's white,
 * whatever the theme); a background pattern goes over it. 항로 adds its
 * dashed flight and 빨랫줄 its line, behind the card.
 */
function drawBackdrop(ctx: CanvasRenderingContext2D, c: Tokens, layout: PolaroidLayout) {
  ctx.fillStyle = c.card;
  ctx.fillRect(0, 0, W, H);
  if (layout === 'map') drawFlight(ctx, c);
  if (layout === 'line') drawClothesline(ctx, c);
}

/** 빨랫줄: the sagging line, behind the card and its pegs. */
function drawClothesline(ctx: CanvasRenderingContext2D, c: Tokens) {
  const { from, control, to } = CLOTHESLINE;
  ctx.save();
  ctx.strokeStyle = c.muted;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/** 빨랫줄: two wooden pegs on the line, gripping the card's top edge, each turned along the line. */
function drawPegs(ctx: CanvasRenderingContext2D, c: Tokens) {
  for (const x of CLOTHESLINE.pegs) {
    const y = clotheslineY(x);
    const slope = (clotheslineY(x + 1) - clotheslineY(x - 1)) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan(slope) * 0.8);
    ctx.save();
    ctx.shadowColor = c.cardShadow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = c.peg;
    ctx.beginPath();
    ctx.roundRect(-34, -70, 68, 220, 12);
    ctx.fill();
    ctx.restore();
    // The two halves' seam, and the metal spring band across them.
    ctx.fillStyle = c.pegShade;
    ctx.fillRect(-2, -62, 4, 204);
    ctx.fillStyle = c.muted;
    ctx.fillRect(-38, 6, 76, 22);
    ctx.restore();
  }
}

/** 항로: a dashed flight across the scene, its plane near the start. */
function drawFlight(ctx: CanvasRenderingContext2D, c: Tokens) {
  ctx.save();
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.moveTo(40, 1960);
  ctx.bezierCurveTo(260, 1600, 140, 700, 1360, 120);
  ctx.stroke();
  ctx.restore();
  drawPlane(ctx, c.accent, 150, 1720, -62, 1.4);
}

/** A small plane (lucide's, stroked), centred on x, y, nose turned `angle` degrees from the right. */
function drawPlane(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, angle: number, k: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((angle + 45) * Math.PI) / 180);
  ctx.scale(k * 3, k * 3);
  ctx.translate(-12, -12);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  const plane = new Path2D(PLANE_PATH);
  ctx.fill(plane);
  ctx.stroke(plane);
  ctx.restore();
}

const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';

/** 테이프: see-through accent masking tape over the card's two top corners (card pixels). */
function drawTape(ctx: CanvasRenderingContext2D, c: Tokens) {
  for (const [x, turn] of [[40, -38], [POLAROID.w - 40, 38]] as const) {
    ctx.save();
    ctx.translate(x, 40);
    ctx.rotate((turn * Math.PI) / 180);
    faint(ctx, 0.42, () => {
      ctx.fillStyle = c.accent;
      ctx.fillRect(-170, -48, 340, 96);
    });
    ctx.restore();
  }
}

/** 노트: a paperclip over the card's top edge, near its left (card pixels). */
function drawClip(ctx: CanvasRenderingContext2D, c: Tokens) {
  ctx.save();
  ctx.translate(250, -70);
  ctx.strokeStyle = c.muted;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.roundRect(-38, 0, 76, 250, 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, 200);
  ctx.lineTo(-14, 60);
  ctx.arc(4, 60, 18, Math.PI, 0);
  ctx.lineTo(22, 170);
  ctx.stroke();
  ctx.restore();
}

/** `2026-10-05` as written on a print: 2026.10.05 (or by hand, 2026. 10. 5). */
const dotDate = (date: string, hand = false) => {
  const [y, m, d] = date.split('-');
  return hand ? `${y}. ${Number(m)}. ${Number(d)}` : `${y}.${m}.${d}`;
};

/** 노트: the date (and the place) in hand on the page's lines under the card. */
function drawNoteDate(ctx: CanvasRenderingContext2D, c: Tokens, stamp?: CardStamp) {
  if (!stamp) return;
  ctx.save();
  ctx.fillStyle = c.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `92px ${textFamily('pen')}`;
  ctx.fillText(`${dotDate(stamp.date, true)}${stamp.area ? ` · ${stamp.area}` : ''}`, 200, 1818, W - 260);
  ctx.restore();
}

/**
 * 탑승권: a boarding pass under the card, a little askew — FROM → TO and the
 * date and stops on the left, a torn-off stub with ROOT and a plane on the
 * right, split by a dashed tear line with a notch at each end.
 */
function drawTicket(ctx: CanvasRenderingContext2D, c: Tokens, stamp?: CardStamp) {
  const { w, h, stub } = TICKET;
  const tear = w - stub;
  ctx.save();
  ctx.translate(TICKET.cx, TICKET.cy);
  ctx.rotate((TICKET.angle * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  // The paper, with the two notches cut where the tear line meets the edges
  // (even-odd, so whatever is under the pass shows through them).
  const paper = new Path2D();
  paper.roundRect(0, 0, w, h, 30);
  for (const y of [0, h]) {
    paper.moveTo(tear + 22, y);
    paper.arc(tear, y, 22, 0, Math.PI * 2);
  }
  ctx.save();
  ctx.shadowColor = c.cardShadow;
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = c.card;
  ctx.fill(paper, 'evenodd');
  ctx.restore();
  ctx.strokeStyle = c.perforation;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(tear, 34);
  ctx.lineTo(tear, h - 34);
  ctx.stroke();
  ctx.setLineDash([]);

  // FROM → TO, then the date and the stops.
  // Long names shrink to fit before the tear line.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const room = tear - 64 - 36;
  const from = (stamp?.from ?? 'MY ROUTE').toUpperCase();
  const to = stamp?.from && stamp.to ? stamp.to.toUpperCase() : '';
  const widthAt = (size: number) => {
    ctx.font = `${size}px ${CAPS}`;
    const words = ctx.measureText(from).width + (to ? ctx.measureText(to).width : 0);
    ctx.font = `${size * 0.7}px ${CAPS}`;
    return words + (to ? ctx.measureText('→').width + size * 0.56 : 0);
  };
  const size = Math.min(92, (92 * room) / widthAt(92));
  let x = 64;
  ctx.fillStyle = c.muted;
  ctx.font = `${size}px ${CAPS}`;
  ctx.fillText(from, x, 150);
  if (to) {
    x += ctx.measureText(from).width + size * 0.28;
    ctx.fillStyle = c.arrow;
    ctx.font = `${size * 0.7}px ${CAPS}`;
    ctx.fillText('→', x, 150 - size * 0.1);
    x += ctx.measureText('→').width + size * 0.28;
    ctx.fillStyle = c.muted;
    ctx.font = `${size}px ${CAPS}`;
    ctx.fillText(to, x, 150);
  }
  if (stamp) {
    ctx.fillStyle = c.muted;
    ctx.font = `48px ${CAPS}`;
    ctx.fillText(`${dotDate(stamp.date)} · ${stamp.stops} ${stamp.stops === 1 ? 'STOP' : 'STOPS'}`, 64, 226, room);
  }

  // The stub: ROOT and a plane.
  ctx.textAlign = 'center';
  ctx.fillStyle = c.muted;
  ctx.font = `46px ${CAPS}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('ROOT', tear + stub / 2, 128, stub - 40);
  ctx.letterSpacing = '0px';
  ctx.restore();
  ctx.save();
  // The plane in the stub, turned with the pass.
  const t = (TICKET.angle * Math.PI) / 180;
  const sx = tear + stub / 2 - w / 2;
  const sy = 205 - h / 2;
  drawPlane(ctx, c.accent, TICKET.cx + sx * Math.cos(t) - sy * Math.sin(t), TICKET.cy + sx * Math.sin(t) + sy * Math.cos(t), -90 + TICKET.angle, 1.6);
  ctx.restore();
}

/** The card's paper, with a soft shadow on what's under it. */
function drawPaper(ctx: CanvasRenderingContext2D, c: ReturnType<typeof tokens>) {
  ctx.save();
  ctx.shadowColor = c.cardShadow;
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = c.card;
  ctx.fillRect(0, 0, POLAROID.w, POLAROID.h);
  ctx.restore();
}

/** Lines first, then the stops over them, laid out in the drawing box. */
function drawStops(ctx: CanvasRenderingContext2D, c: ReturnType<typeof tokens>, bg: string, pings: DayPing[], marks: StopMark[], edges: RouteEdgeStyle[], pinImages: (HTMLImageElement | null)[]) {
  const points = layoutPings(pings.map((p) => p.center)).map((p) => ({
    x: BOX.x + p.x * BOX.size,
    y: BOX.y + p.y * BOX.size,
  }));

  ctx.strokeStyle = c.route;
  for (let i = 0; i + 1 < points.length; i++) {
    const edge = edges[i] ?? 'solid';
    if (edge === 'transparent') continue;
    const style = DASHES[edge];
    ctx.lineWidth = style.width;
    ctx.lineCap = style.cap;
    ctx.setLineDash(style.dash);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Only a day's pings have times, and the latest of them is drawn bigger.
  const timed = pings.some((p) => p.time);
  const latest = timed ? latestPingIndex(pings) : -1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  pings.forEach((ping, i) => {
    const originalMark = marks[i] ?? 'pin';
    const mark = originalMark === 'transparent' ? 'dot' : originalMark;
    const k = i === latest ? 1.4 : 1;
    const { x, y } = points[i];
    let bottom: number;
    if (originalMark === 'transparent' && pinImages[i]) {
      ctx.drawImage(pinImages[i]!, x - 42, y - 42, 84, 84);
      bottom = y + 42;
    } else if (mark === 'number') {
      // A route's plain stop: a flat accent disc with its number, as on the map.
      const r = 34;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.onAccent;
      ctx.textBaseline = 'middle';
      ctx.font = `700 38px ${c.font}`;
      ctx.fillText(String(i + 1), x, y + 2);
      ctx.textBaseline = 'alphabetic';
      bottom = y + r;
    } else {
      const box = shapeBox(mark);
      const h = (mark === 'pin' ? 118 : 84) * k;
      const scale = h / box.h;
      const w = box.w * scale;
      // Pins stand on their point; the round shapes centre on it.
      const top = mark === 'pin' ? y - h : y - h / 2;
      ctx.save();
      ctx.translate(x - w / 2, top);
      ctx.scale(scale, scale);
      ctx.translate(-box.x, -box.y);
      ctx.fillStyle = c.accent;
      if (mark === 'dot') {
        ctx.beginPath();
        ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fill(new Path2D(mark === 'pin' ? PIN_PATH : mark === 'star' ? STAR_PATH : HEART_PATH));
      }
      if (mark === 'pin') {
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(12, 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      bottom = mark === 'pin' ? y : y + h / 2;
    }

    // The name (and time) below the mark, unless one of its lines leaves that
    // way: then above, right or left of it, as on the day screen.
    const side = labelSide({ x, y }, [points[i - 1], points[i + 1]].filter((p): p is { x: number; y: number } => !!p));
    const top = mark === 'number' ? y - 34 : bottom - (mark === 'pin' ? (118 * k) : (84 * k));
    const half = mark === 'number' ? 34 : (mark === 'pin' ? (shapeBox('pin').w * (118 * k)) / shapeBox('pin').h : 84 * k) / 2;
    const mid = (top + bottom) / 2;
    const lines = ping.time ? 2 : 1;
    let tx = x;
    let nameY = bottom + 46;
    if (side === 'above') nameY = top - (lines === 2 ? 54 : 14);
    if (side === 'right' || side === 'left') {
      tx = side === 'right' ? x + half + 18 : x - half - 18;
      nameY = mid + (lines === 2 ? -6 : 12);
    }
    ctx.textAlign = side === 'right' ? 'left' : side === 'left' ? 'right' : 'center';
    ctx.fillStyle = c.text;
    ctx.font = `700 ${Math.round(36 * (k > 1 ? 1.15 : 1))}px ${c.font}`;
    ctx.fillText(ping.name, tx, nameY);
    if (ping.time) {
      ctx.fillStyle = c.muted;
      ctx.font = `600 32px ${c.font}`;
      ctx.fillText(ping.time, tx, nameY + 42);
    }
    ctx.textAlign = 'center';
  });
}

/** A text box's canvas font at `sizePx`, like its CSS (DecorLayer). */
const textFont = (t: PlacedText, sizePx: number) =>
  `${t.italic ? 'italic ' : ''}${textWeight(t)} ${sizePx}px ${textFamily(t.font)}`;

/**
 * Where a set of pieces lies, in the pixels of what it's drawn on (`canvas`):
 * places are fractions of the box's width and height, sizes of its width,
 * as the 꾸미기 layer lays them out.
 */
interface PieceFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  canvas: { w: number; h: number };
}

/** The card's own pieces: the whole scene. */
const SCENE_FRAME: PieceFrame = { x: 0, y: 0, w: W, h: H, canvas: { w: W, h: H } };
/** A day's pieces: its drawing box, in the card's pixels. */
const BOX_FRAME: PieceFrame = { x: BOX.x, y: BOX.y, w: BOX.size, h: BOX.size, canvas: { w: POLAROID.w, h: POLAROID.h } };

/** Pen strokes, then stickers, then text boxes, laid out in `frame`. */
function drawDecor(ctx: CanvasRenderingContext2D, decor: DayDecor, frame: PieceFrame, stickerImages: Map<string, HTMLImageElement>) {
  const css = getComputedStyle(document.documentElement);
  const px = (v: number) => v * frame.w;
  const at = (x: number, y: number): [number, number] => [frame.x + x * frame.w, frame.y + y * frame.h];
  // Ink goes on its own layer so eraser passes (destination-out) cut only
  // ink drawn before them, never the pings or the page underneath.
  const layer = document.createElement('canvas');
  layer.width = frame.canvas.w;
  layer.height = frame.canvas.h;
  const ink = layer.getContext('2d')!;
  ink.lineCap = 'round';
  ink.lineJoin = 'round';
  const trace = (points: [number, number][]) => {
    ink.beginPath();
    points.forEach(([x, y], i) => (i ? ink.lineTo : ink.moveTo).call(ink, ...at(x, y)));
    if (points.length === 1) ink.lineTo(at(...points[0])[0] + 0.01, at(...points[0])[1]);
    ink.stroke();
  };
  for (const stroke of decor.strokes) {
    const w = px(PEN_WIDTHS[stroke.width]);
    ink.save();
    if (stroke.tool === 'eraser') {
      ink.globalCompositeOperation = 'destination-out';
      ink.strokeStyle = css.getPropertyValue('--mask-show').trim();
      ink.lineWidth = w * ERASER_SCALE;
      trace(stroke.points);
      ink.restore();
      continue;
    }
    const color = isCustomColor(stroke.color) ? stroke.color : css.getPropertyValue(`--${stroke.color}`).trim();
    ink.strokeStyle = color;
    // Same looks as the screen (DecorLayer's Ink): highlighter wide and see-through,
    // neon a glow in its colour with a bright core.
    if (stroke.tool === 'highlighter') {
      ink.globalAlpha = 0.35;
      ink.lineWidth = w * 2.4;
      trace(stroke.points);
    } else if (stroke.tool === 'neon') {
      ink.shadowColor = color;
      ink.shadowBlur = w * 2.5;
      ink.lineWidth = w;
      trace(stroke.points);
      trace(stroke.points);
      ink.shadowBlur = 0;
      ink.strokeStyle = css.getPropertyValue('--ink-white').trim();
      ink.globalAlpha = 0.85;
      ink.lineWidth = w * 0.35;
      trace(stroke.points);
    } else {
      ink.lineWidth = w;
      trace(stroke.points);
    }
    ink.restore();
  }
  ctx.save();
  ctx.drawImage(layer, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of decor.stickers) {
    ctx.save();
    ctx.translate(...at(s.x, s.y));
    ctx.rotate(((s.rotate ?? 0) * Math.PI) / 180);
    const img = stickerImages.get(s.stickerId);
    const size = px(s.size * 0.78);
    if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  for (const t of decor.texts ?? []) {
    const fs = px(t.size);
    const lh = fs * TEXT_LINE_HEIGHT;
    ctx.save();
    ctx.translate(...at(t.x, t.y));
    ctx.rotate(((t.rotate ?? 0) * Math.PI) / 180);
    ctx.font = textFont(t, fs);
    ctx.fillStyle = isCustomColor(t.color) ? t.color : css.getPropertyValue(`--${t.color}`).trim();
    ctx.textAlign = t.align;
    ctx.textBaseline = 'middle';
    // Centred on its spot as a block; each line aligned inside the block.
    const lines = t.text.split('\n');
    const widths = lines.map((line) => ctx.measureText(line).width);
    const w = Math.max(...widths);
    const h = lines.length * lh;
    const x = t.align === 'left' ? -w / 2 : t.align === 'right' ? w / 2 : 0;
    lines.forEach((line, i) => {
      const y = -h / 2 + lh * (i + 0.5);
      ctx.fillText(line, x, y);
      const lw = widths[i];
      const from = t.align === 'left' ? x : t.align === 'right' ? x - lw : -lw / 2;
      const thick = Math.max(1, fs * 0.06);
      if (t.underline) ctx.fillRect(from, y + fs * 0.42, lw, thick);
      if (t.strike) ctx.fillRect(from, y + fs * 0.02, lw, thick);
    });
    ctx.restore();
  }
  ctx.restore();
}

/** Saves a data URL as a file (on phones this opens the image to keep or share). */
export function downloadDataUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

function dataUrlFile(url: string, filename: string): File {
  const [head, body] = url.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
  return new File([bytes], filename, { type });
}

/** True where the system share sheet can take an image (most phones). */
export function canShareImage(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && navigator.canShare?.({ files: [probe] }) === true;
  } catch {
    return false;
  }
}

/** Hands the image to the system share sheet (every SNS app is in it). False if it couldn't open. */
export async function shareImage(url: string, filename: string, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [dataUrlFile(url, filename)], title });
    return true;
  } catch {
    return false;
  }
}

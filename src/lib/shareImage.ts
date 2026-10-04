import { latestPingIndex, layoutPings, type DayPing, type EdgeStyle } from '../domain/dayPings';
import { ERASER_SCALE, isCustomColor, PEN_WIDTHS, TEXT_LINE_HEIGHT, textFamily, textWeight, type DayDecor, type PlacedText } from '../domain/decor';
import { BACK_CARD, DRAWING_BOX, FRONT_CARD, POLAROID, SCENE, STRIP, type CardPose } from '../domain/polaroid';
import type { StopMark } from '../domain/shareSubject';
import { paintPattern } from './dayPatterns';
import { HEART_PATH, PIN_PATH, shapeBox, STAR_PATH } from './pingPaths';

export interface ShareImageInput {
  title: string;
  pings: DayPing[];
  /** How each ping is drawn, by index. */
  marks: StopMark[];
  /** `edges[i]` joins `pings[i]` and `pings[i + 1]`. */
  edges: EdgeStyle[];
  /** Stickers, pen strokes, text boxes, theme and pattern; pieces in scene fractions (0..1 of its width / height). */
  decor?: DayDecor;
  /** Leave the stickers, strokes and text boxes off (the 꾸미기 screen lays its own over the image). */
  withoutPieces?: boolean;
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
    cardInk: get('--polaroid-ink'),
    cardShadow: get('--polaroid-shadow'),
    photo: get('--surface-2'),
    text: get('--text'),
    muted: get('--muted'),
    accent: get('--accent'),
    onAccent: get('--on-accent'),
    route: get('--route'),
    font: getComputedStyle(document.body).fontFamily,
  };
}

/** The strip's handwriting, with a fallback if the web font can't load. */
const HAND_FONT = '"Nanum Pen Script", "Jua", cursive';

const DASHES: Record<EdgeStyle, { width: number; dash: number[]; cap: CanvasLineCap }> = {
  solid: { width: 9, dash: [], cap: 'round' },
  dashed: { width: 9, dash: [34, 22], cap: 'butt' },
  dotted: { width: 12, dash: [0.1, 26], cap: 'round' },
  bold: { width: 19, dash: [], cap: 'round' },
};

/**
 * Draws the share image: two polaroids lying askew on the backdrop (its
 * theme colour and pattern), the front one holding the photo (the lines and
 * stops laid out as the day screen does) with the title handwritten on its
 * strip, and the 꾸미기 pieces over all of it. Returns a PNG data URL.
 * Drawn from the data rather than screenshotting the DOM: sharp at any
 * size, and no capture library needed.
 */
export async function renderShareImage({ title, pings, marks, edges, decor, withoutPieces }: ShareImageInput): Promise<string> {
  await document.fonts?.ready;
  // Web fonts load only once something shows them; make sure the strip's
  // hand and the text boxes' fonts are in before drawing (one that won't
  // load falls back).
  await Promise.all([
    document.fonts?.load(`110px ${HAND_FONT}`, title).catch(() => undefined),
    ...(withoutPieces ? [] : (decor?.texts ?? [])).map((t) => document.fonts?.load(textFont(t, 40), t.text).catch(() => undefined)),
  ]);
  const c = tokens();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = c.backdrop;
  ctx.fillRect(0, 0, W, H);
  // The background pattern, as a still frame even if it flows on screen.
  if (decor?.pattern) paintPattern(ctx, decor.pattern, { w: W, h: H }, W / 390, c.accent);

  // The blank card behind, then the one with the photo.
  onCard(ctx, BACK_CARD, () => {
    drawPaper(ctx, c);
    ctx.fillStyle = c.photo;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  });
  onCard(ctx, FRONT_CARD, () => {
    drawPaper(ctx, c);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    ctx.clip();
    ctx.fillStyle = c.photo;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    drawStops(ctx, c, pings, marks, edges);
    ctx.restore();
    ctx.fillStyle = c.cardInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `110px ${HAND_FONT}`;
    ctx.fillText(title, POLAROID.w / 2, STRIP.y + STRIP.h * 0.48, PHOTO.w);
  });

  if (decor && !withoutPieces) drawDecor(ctx, decor, c.font);
  return canvas.toDataURL('image/png');
}

/** Draws in a card's own pixels (0..POLAROID.w/h), as the card lies on the scene. */
function onCard(ctx: CanvasRenderingContext2D, pose: CardPose, draw: () => void) {
  ctx.save();
  ctx.translate(pose.cx, pose.cy);
  ctx.rotate((pose.angle * Math.PI) / 180);
  ctx.translate(-POLAROID.w / 2, -POLAROID.h / 2);
  draw();
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
function drawStops(ctx: CanvasRenderingContext2D, c: ReturnType<typeof tokens>, pings: DayPing[], marks: StopMark[], edges: EdgeStyle[]) {
  const points = layoutPings(pings.map((p) => p.center)).map((p) => ({
    x: BOX.x + p.x * BOX.size,
    y: BOX.y + p.y * BOX.size,
  }));

  ctx.strokeStyle = c.route;
  for (let i = 0; i + 1 < points.length; i++) {
    const style = DASHES[edges[i] ?? 'solid'];
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
    const mark = marks[i] ?? 'pin';
    const k = i === latest ? 1.4 : 1;
    const { x, y } = points[i];
    let bottom: number;
    if (mark === 'number') {
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
        ctx.fillStyle = c.photo;
        ctx.beginPath();
        ctx.arc(12, 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      bottom = mark === 'pin' ? y : y + h / 2;
    }

    ctx.fillStyle = c.text;
    ctx.font = `700 ${Math.round(36 * (k > 1 ? 1.15 : 1))}px ${c.font}`;
    ctx.fillText(ping.name, x, bottom + 46);
    if (ping.time) {
      ctx.fillStyle = c.muted;
      ctx.font = `600 32px ${c.font}`;
      ctx.fillText(ping.time, x, bottom + 88);
    }
  });
}

/** A text box's canvas font at `sizePx`, like its CSS (DecorLayer). */
const textFont = (t: PlacedText, sizePx: number) =>
  `${t.italic ? 'italic ' : ''}${textWeight(t)} ${sizePx}px ${textFamily(t.font)}`;

/**
 * Pen strokes, then stickers, then text boxes, over the whole scene: places
 * are fractions of its width and height, sizes fractions of its width (as
 * the 꾸미기 layer lays them out).
 */
function drawDecor(ctx: CanvasRenderingContext2D, decor: DayDecor, font: string) {
  const css = getComputedStyle(document.documentElement);
  const px = (v: number) => v * W;
  const at = (x: number, y: number): [number, number] => [x * W, y * H];
  // Ink goes on its own layer so eraser passes (destination-out) cut only
  // ink drawn before them, never the pings or the page underneath.
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
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
    ctx.font = `${px(s.size * 0.78)}px ${font}`;
    ctx.fillText(s.emoji, 0, 0);
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

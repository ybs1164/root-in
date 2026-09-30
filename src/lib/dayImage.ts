import { latestPingIndex, layoutPings, type DayPing, type EdgeStyle, type PingShape } from '../domain/dayPings';
import { isCustomColor, PEN_WIDTHS, type DayDecor } from '../domain/decor';
import { HEART_PATH, PIN_PATH, shapeBox, STAR_PATH } from './pingPaths';

export interface DayImageInput {
  title: string;
  pings: DayPing[];
  shapeOf: (ping: DayPing) => PingShape;
  edgeStyleOf: (from: DayPing, to: DayPing) => EdgeStyle;
  /** Stickers and pen strokes, in the same box coordinates as the pings. */
  decor?: DayDecor;
}

// 4:5 portrait, the shape most feeds show uncropped.
const W = 1080;
const H = 1350;
const BOX = { x: 110, y: 300, size: 860 };

/** Colours come from the page's own tokens, so the image matches the app (and its theme). */
function tokens() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: get('--surface'),
    text: get('--text'),
    muted: get('--muted'),
    accent: get('--accent'),
    route: get('--route'),
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
 * Draws a day's pings and lines onto a canvas, the way the day screen shows
 * them (same layout, shapes and line styles), and returns a PNG data URL.
 * Drawn from the data rather than screenshotting the DOM: sharp at any
 * size, and no capture library needed.
 */
export async function renderDayImage({ title, pings, shapeOf, edgeStyleOf, decor }: DayImageInput): Promise<string> {
  await document.fonts?.ready;
  const c = tokens();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = c.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 118px ${c.font}`;
  ctx.fillText(title, W / 2, 210);

  const points = layoutPings(pings.map((p) => p.center)).map((p) => ({
    x: BOX.x + p.x * BOX.size,
    y: BOX.y + p.y * BOX.size,
  }));

  // Lines first, pins over them.
  ctx.strokeStyle = c.route;
  for (let i = 0; i + 1 < points.length; i++) {
    const style = DASHES[edgeStyleOf(pings[i], pings[i + 1])];
    ctx.lineWidth = style.width;
    ctx.lineCap = style.cap;
    ctx.setLineDash(style.dash);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const latest = latestPingIndex(pings);
  pings.forEach((ping, i) => {
    const shape = shapeOf(ping);
    const k = i === latest ? 1.4 : 1;
    const box = shapeBox(shape);
    const h = (shape === 'pin' ? 118 : 84) * k;
    const scale = h / box.h;
    const w = box.w * scale;
    const { x, y } = points[i];
    // Pins stand on their point; the round shapes centre on it.
    const top = shape === 'pin' ? y - h : y - h / 2;

    ctx.save();
    ctx.translate(x - w / 2, top);
    ctx.scale(scale, scale);
    ctx.translate(-box.x, -box.y);
    ctx.fillStyle = c.accent;
    if (shape === 'dot') {
      ctx.beginPath();
      ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fill(new Path2D(shape === 'pin' ? PIN_PATH : shape === 'star' ? STAR_PATH : HEART_PATH));
    }
    if (shape === 'pin') {
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(12, 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const labelTop = shape === 'pin' ? y : y + h / 2;
    ctx.fillStyle = c.text;
    ctx.font = `700 ${Math.round(36 * (k > 1 ? 1.15 : 1))}px ${c.font}`;
    ctx.fillText(ping.name, x, labelTop + 46);
    ctx.fillStyle = c.muted;
    ctx.font = `600 32px ${c.font}`;
    ctx.fillText(ping.time, x, labelTop + 88);
  });

  if (decor) drawDecor(ctx, decor, c.font);

  // A quiet signature: a bit smaller and see-through so the day stays the
  // subject. Drawn whole on its own layer first, then faded as one piece, so
  // the pin's hole stays the background colour instead of a pink blend.
  const logo = document.createElement('canvas');
  logo.width = W;
  logo.height = H;
  const lctx = logo.getContext('2d')!;
  drawLogo(lctx, c, W / 2, H - 64, 42);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(logo, 0, 0);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/** Pen strokes, then stickers, over the drawing, mapped from box fractions onto BOX. */
function drawDecor(ctx: CanvasRenderingContext2D, decor: DayDecor, font: string) {
  const css = getComputedStyle(document.documentElement);
  const px = (v: number) => v * BOX.size;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (points: [number, number][]) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, BOX.x + px(x), BOX.y + px(y)));
    if (points.length === 1) ctx.lineTo(BOX.x + px(points[0][0]) + 0.01, BOX.y + px(points[0][1]));
    ctx.stroke();
  };
  for (const stroke of decor.strokes) {
    const color = isCustomColor(stroke.color) ? stroke.color : css.getPropertyValue(`--${stroke.color}`).trim();
    const w = px(PEN_WIDTHS[stroke.width]);
    ctx.save();
    ctx.strokeStyle = color;
    // Same looks as the screen (DecorLayer's Ink): highlighter wide and see-through,
    // neon a glow in its colour with a bright core.
    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = w * 2.4;
      trace(stroke.points);
    } else if (stroke.tool === 'neon') {
      ctx.shadowColor = color;
      ctx.shadowBlur = w * 2.5;
      ctx.lineWidth = w;
      trace(stroke.points);
      trace(stroke.points);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = css.getPropertyValue('--ink-white').trim();
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = w * 0.35;
      trace(stroke.points);
    } else {
      ctx.lineWidth = w;
      trace(stroke.points);
    }
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of decor.stickers) {
    ctx.font = `${px(s.size * 0.78)}px ${font}`;
    ctx.fillText(s.emoji, BOX.x + px(s.x), BOX.y + px(s.y));
  }
  ctx.restore();
}

/**
 * The root-in wordmark (components/Logo.tsx) drawn centred on (cx, baseline):
 * "root" in text colour, then the pin standing in for the i and "n" in the
 * accent. Proportions follow .logo / .logo__i in styles.css (em = size).
 */
function drawLogo(ctx: CanvasRenderingContext2D, c: ReturnType<typeof tokens>, cx: number, baseline: number, size: number) {
  ctx.save();
  ctx.font = `800 ${size}px ${c.font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.02 * size}px`;
  const root = ctx.measureText('root').width;
  const n = ctx.measureText('n').width;
  const gap = 0.07 * size + 0.01 * size; // .logo__in margin + the pin's own margin
  const pinW = 0.72 * size;
  const pinH = 0.95 * size;
  const x0 = cx - (root + gap + pinW + 0.01 * size + n) / 2;

  ctx.fillStyle = c.text;
  ctx.fillText('root', x0, baseline);

  // Pin viewBox is 4 1.5 16 21; it fits the 0.72em × 0.95em box by width,
  // centred in the height, so the tip lands on the baseline like on screen.
  const pinX = x0 + root + gap;
  const k = Math.min(pinW / 16, pinH / 21);
  ctx.save();
  ctx.translate(pinX + (pinW - 16 * k) / 2, baseline - pinH + (pinH - 21 * k) / 2);
  ctx.scale(k, k);
  ctx.translate(-4, -1.5);
  ctx.fillStyle = c.accent;
  ctx.fill(new Path2D(PIN_PATH));
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.arc(12, 10, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = c.accent;
  ctx.fillText('n', pinX + pinW + 0.01 * size, baseline);
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

import { ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getSticker } from '../domain/decor';
import { outlinedSticker, stickerEdgePx } from '../lib/stickerEdge';
import { SHEET_PULL, SWIPE, swipeCommits } from '../domain/appTabs';
import StickerPackBand from './StickerPackBand';
import StickerShop from './StickerShop';
import { loadPackOrder, savePackOrder } from '../services/stickerPackOrderRepository';
import { listInk, orderPackGroups, packGroups, peelFold, squareTarget, themeIcon, themeIconBg, STICKER_SHEETS, type PeelFold, type SheetSlot, type StickerDrop, type StickerSheet } from '../domain/stickerSheets';

/** Less movement than this is a tap on a sticker, not a pull (px). */
const TAP_SLOP = 6;
/** The white die-cut edge around a sticker (px; the CSS outline is about as wide). */
/** A let-go mid-peel lays the flap back down over this long (ms). */
const UNPEEL_MS = 140;
/** A new sheet slides in this long (ms, matches `sheet-in`). */
const SLIDE_MS = 260;
/** Tucked down, this much of the panel stays up: the row of themes (px, matches `--peek-h`). */
const PEEK_PX = 66;
/** A theme square held this long lifts, to be dragged to a new place (ms). */
const LIFT_MS = 400;
/** Moving more than this before then is a scroll of the row, not a hold (px). */
const LIFT_SLOP = 8;
/** The gap between theme squares (px, matches the CSS). */
const SQUARE_GAP = 10;

/** A theme square held and being dragged along the row. */
type SquareLift = { name: string; from: number; centers: number[]; widths: number[]; dx: number };

/** The sticker's die-cut edge, and its paper back, drawn once when a peel starts. */
interface Textures {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  /** Their width on screen, edge included (px). */
  size: number;
}

function makeTextures(img: HTMLImageElement, width: number, colours: { edge: string; back: string }): Textures {
  const dpr = window.devicePixelRatio || 1;
  const { canvas: front } = outlinedSticker(img, width * dpr, stickerEdgePx(width) * dpr, colours.edge);
  const back = Object.assign(document.createElement('canvas'), { width: front.width, height: front.height });
  const bc = back.getContext('2d')!;
  bc.drawImage(front, 0, 0);
  bc.globalCompositeOperation = 'source-in';
  bc.fillStyle = colours.back;
  bc.fillRect(0, 0, back.width, back.height);
  return { front, back, size: front.width / dpr };
}

/** One sticker on its way off a sheet. */
interface Peel {
  key: string;
  stickerId: string;
  pointerId: number;
  /** Where the finger came down, and the sticker's centre, width and turn on the sheet (client px). */
  startX: number;
  startY: number;
  cx: number;
  cy: number;
  width: number;
  rotate: number;
  img: HTMLImageElement;
  textures: Textures | null;
  colours: { fold: string; shadow: string };
  phase: 'press' | 'peel' | 'free';
  dx: number;
  dy: number;
  /** Sideways lean while carried, from how fast it moves. */
  tilt: number;
  /** Let go already (a peel still laying back down): a second release is ignored. */
  released?: boolean;
}

/**
 * The page-turn: the part of the sticker still stuck, then the lifted part
 * mirrored over the fold line, showing its paper back with a soft shadow,
 * darker where it bends.
 */
function drawPeel(canvas: HTMLCanvasElement, p: Peel, fold: PeelFold | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !p.textures) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { front, back, size } = p.textures;
  const place = (tex: HTMLCanvasElement) => {
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate((p.rotate * Math.PI) / 180);
    ctx.drawImage(tex, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
  if (!fold) return place(front);
  const { nx, ny, mx, my } = fold;
  // A half-plane past the fold line, toward the pull (side 1) or behind it (-1).
  const far = Math.hypot(canvas.width, canvas.height);
  const halfPlane = (side: 1 | -1) => {
    const [tx, ty] = [-ny * far, nx * far];
    ctx.beginPath();
    ctx.moveTo(mx + tx, my + ty);
    ctx.lineTo(mx - tx, my - ty);
    ctx.lineTo(mx - tx + nx * far * side, my - ty + ny * far * side);
    ctx.lineTo(mx + tx + nx * far * side, my + ty + ny * far * side);
    ctx.closePath();
    ctx.clip();
  };
  ctx.save();
  halfPlane(1);
  place(front);
  ctx.restore();

  // The flap: everything behind the fold, mirrored over it.
  const dot = mx * nx + my * ny;
  ctx.save();
  ctx.transform(1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * dot * nx, 2 * dot * ny);
  halfPlane(-1);
  ctx.shadowColor = p.colours.shadow;
  ctx.shadowBlur = 8;
  place(back);
  ctx.shadowColor = 'transparent';
  // Shading from the bend (dark) to the lifted edge (clear); in the mirrored
  // space, behind the fold is where the flap lies on screen.
  const reach = Math.hypot(p.dx, p.dy) / 2;
  const shade = ctx.createLinearGradient(mx, my, mx - nx * reach, my - ny * reach);
  shade.addColorStop(0, p.colours.fold);
  shade.addColorStop(1, 'transparent');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = shade;
  ctx.fillRect(mx - far, my - far, far * 2, far * 2);
  ctx.restore();
}

/**
 * The packs of the theme in use, one row each (a thumbnail in the band's
 * colour, the name and its number in the theme in the pack's name ink (its
 * band colour when that ink is white), a
 * peek at its stickers), in the big pack's place. A row puts that pack up.
 */
function ThemePackList({ sheets, current, onPick }: { sheets: StickerSheet[]; current: number; onPick: (index: number) => void }) {
  const name = sheets[current]?.name;
  const packs = sheets.flatMap((sheet, index) => (sheet.name === name ? [{ sheet, index }] : []));
  return (
    <div className="sticker-list__rows" role="list" aria-label={`${sheets[current]?.label ?? name} 팩 목록`}>
      {packs.map(({ sheet, index }, n) => {
        const [first, ...rest] = sheet.slots.map((sl) => getSticker(sl.stickerId)).filter((st) => !!st);
        const on = index === current;
        return (
          <button
            key={sheet.id}
            role="listitem"
            className="sticker-list__row"
            style={{ '--pack-ink': listInk(sheet) } as CSSProperties}
            aria-label={`${sheet.label ?? sheet.name} ${n + 1}`}
            aria-current={on || undefined}
            onClick={() => onPick(index)}
          >
            <span className="sticker-list__thumb" style={{ '--pack': sheet.color } as CSSProperties} aria-hidden>
              <b />
              {first && <img src={first.src} alt="" draggable={false} />}
            </span>
            <span className="sticker-list__text" aria-hidden>
              <span className="sticker-list__name">
                {sheet.name}
                <small>{n + 1}</small>
              </span>
              <span className="sticker-list__peek">
                {rest.slice(0, 6).map((st, i) => (
                  <img key={i} src={st.src} alt="" draggable={false} />
                ))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The sticker tool: a printed sheet of stickers a little below the middle of
 * the screen, `<` `>` (or a sideways swipe on its band or bare paper) to the
 * sheets either side. Pull a sticker and it peels
 * off toward the pull, page-turn style, then comes away and follows the
 * finger; let go and it's stuck on the drawing there. A tap sticks it in the
 * drawing's middle. Once it's off, the sheet drops to the bottom edge (its
 * band showing) and stays there until that band is tapped; let go on it and
 * the sticker goes back. A peeled spot keeps a faint mark of the sticker,
 * from the first lift until the pack next comes up, full again — so at
 * most one spot is ever bare. While it's up, a touch anywhere off it tucks
 * it down (and only the next one puts the tool away), and so does dragging
 * it down by its band or bare paper. It all sits on a low panel (the day
 * shows above, over half the screen), under a row of squares, one per theme
 * with a sticker standing for it; a square brings up that theme's first pack,
 * and `<` `>` page through that theme only. A square held a moment lifts and
 * drags to a new place (the order is kept on this phone). The square of the
 * theme in use tapped again lists that theme's packs in the pack's place. In front of the
 * row, standing still while it scrolls, the store button opens the shop.
 */
export default function StickerSheets({
  onPlace,
  sheets = STICKER_SHEETS,
}: {
  onPlace: (drop: StickerDrop) => void;
  /** The packs to show (the pack editor's try-out passes its own). */
  sheets?: StickerSheet[];
}) {
  const [index, setIndex] = useState(0);
  const [from, setFrom] = useState<'next' | 'prev' | null>(null);
  // The one spot peeled off (its faint mark shows): every sticker is back when the pack comes up again.
  const [taken, setTaken] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const [carried, setCarried] = useState<Peel | null>(null);
  // Tucked down to its band at the bottom of the screen, so the drawing (and
  // stickers under the sheet) can be reached; only a tap on it brings it back.
  const [peek, setPeekState] = useState(false);
  const [order, setOrder] = useState(loadPackOrder);
  const themes = useMemo(() => orderPackGroups(packGroups(sheets), order), [sheets, order]);
  const [shop, setShop] = useState(false);
  // The theme's packs as a list in the big pack's place (the squares stay):
  // how the tool opens, and again on its square tapped twice or the pack's
  // band tapped, until a pack is picked (or the square is tapped once more).
  const [listed, setListed] = useState(true);
  const squares = useRef<HTMLDivElement | null>(null);
  const [squareLift, setSquareLift] = useState<SquareLift | null>(null);
  const squareLiftRef = useRef<SquareLift | null>(null);
  squareLiftRef.current = squareLift;
  const squarePress = useRef<{ x: number; y: number; timer: number; lifted: boolean } | null>(null);
  /** Swallows the click that ends a drag of a square. */
  const squareDropped = useRef(false);
  const setPeek = (down: boolean) => {
    setPeekState(down);
    if (!down) setTaken(null);
  };
  const sheetEl = useRef<HTMLDivElement | null>(null);
  const sheetsEl = useRef<HTMLDivElement | null>(null);
  /** Pulling the tucked pack up by its band: where it started and how far down it sits. */
  const raise = useRef<{ id: number; y: number; t: number; down: number; dy: number; on: boolean } | null>(null);
  /** Swallows the click that ends a pull up. */
  const raised = useRef(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const freeEl = useRef<HTMLImageElement | null>(null);
  const peel = useRef<Peel | null>(null);
  const frame = useRef(0);
  /** Swallows the click that ends a pull. */
  const pulled = useRef(false);
  const count = sheets.length;
  const sheet = sheets[Math.min(index, count - 1)];
  /** One pack in the theme: nothing for `<` `>` to page to. */
  const alone = !!sheet && sheets.filter((s) => s.name === sheet.name).length < 2;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Keep the shown theme's square whole in its row (not half under the fade at either end).
  useEffect(() => {
    const row = squares.current;
    const on = row?.querySelector<HTMLElement>('.sticker-sheets__theme.is-on');
    if (!row || !on) return;
    const [r, o] = [row.getBoundingClientRect(), on.getBoundingClientRect()];
    const edge = 28;
    if (o.left < r.left + edge) row.scrollBy({ left: o.left - r.left - edge, behavior: 'smooth' });
    else if (o.right > r.right - edge) row.scrollBy({ left: o.right - r.right + edge, behavior: 'smooth' });
  }, [sheet?.name]);

  // While a square is held the row mustn't scroll under the finger.
  useEffect(() => {
    const row = squares.current;
    if (!row || !squareLift) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    row.addEventListener('touchmove', stop, { passive: false });
    return () => row.removeEventListener('touchmove', stop);
  }, [squareLift]);

  const pressSquare = (e: ReactPointerEvent<HTMLButtonElement>, name: string) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const press = { x: e.clientX, y: e.clientY, timer: 0, lifted: false };
    press.timer = window.setTimeout(() => {
      const els = [...(squares.current?.querySelectorAll<HTMLElement>('[data-theme-square]') ?? [])];
      const rects = els.map((el) => el.getBoundingClientRect());
      press.lifted = true;
      setSquareLift({
        name,
        from: els.findIndex((el) => el.dataset.themeSquare === name),
        centers: rects.map((r) => r.left + r.width / 2),
        widths: rects.map((r) => r.width),
        dx: 0,
      });
      navigator.vibrate?.(10);
    }, LIFT_MS);
    squarePress.current = press;
    const move = (ev: PointerEvent) => {
      const cur = squarePress.current;
      if (!cur) return;
      if (!cur.lifted) {
        if (Math.hypot(ev.clientX - cur.x, ev.clientY - cur.y) > LIFT_SLOP) done(false);
        return;
      }
      setSquareLift((l) => l && { ...l, dx: ev.clientX - cur.x });
    };
    const done = (drop: boolean) => {
      const cur = squarePress.current;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      squarePress.current = null;
      if (!cur) return;
      window.clearTimeout(cur.timer);
      if (!cur.lifted) return;
      squareDropped.current = true;
      window.setTimeout(() => (squareDropped.current = false), 0);
      const l = squareLiftRef.current;
      setSquareLift(null);
      if (!l || !drop) return;
      const to = squareTarget(l.centers, l.from, l.dx);
      if (to === l.from) return;
      const names = themes.map((g) => g.name);
      names.splice(to, 0, ...names.splice(l.from, 1));
      setOrder(names);
      savePackOrder(names);
    };
    const up = () => done(true);
    const cancel = () => done(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  /** How far each square slides while one is dragged: the held one follows the finger, the rest make room. */
  const squareShift = (i: number): number => {
    const l = squareLift;
    if (!l) return 0;
    if (i === l.from) return l.dx;
    const to = squareTarget(l.centers, l.from, l.dx);
    const room = l.widths[l.from] + SQUARE_GAP;
    if (l.from < to && i > l.from && i <= to) return -room;
    if (to < l.from && i >= to && i < l.from) return room;
    return 0;
  };

  const step = (by: 1 | -1) => {
    // A sticker half off this pack (its release lost, or still laying back
    // down) would otherwise stay drawn over the next pack.
    if (peel.current) {
      cancelAnimationFrame(frame.current);
      end();
    }
    const theme = sheets.flatMap((s, i) => (s.name === sheet.name ? [i] : []));
    if (theme.length < 2) return;
    const at = Math.max(0, theme.indexOf(index));
    setIndex(theme[(at + by + theme.length) % theme.length]);
    setFrom(by > 0 ? 'next' : 'prev');
  };
  useEffect(() => {
    if (!from) return;
    const t = window.setTimeout(() => setFrom(null), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [from, index]);

  // Up, a touch anywhere off the pack (and its arrows) tucks it down. Off
  // the drawing that touch would also put the tool away; here it only tucks
  // (heard first, and stopped), and the next touch out there closes as before.
  useEffect(() => {
    if (peek) return;
    const tuck = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!e.isPrimary || peel.current || t?.closest('.sticker-sheets, .sticker-shop, .decor-rail, .color-picker')) return;
      setPeek(true);
      if (t?.closest('.decor')) return; // on the drawing: the touch still picks or moves what it's on
      e.stopPropagation();
      // Nor does its click press what's under it.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 500);
    };
    document.addEventListener('pointerdown', tuck, true);
    return () => document.removeEventListener('pointerdown', tuck, true);
  }, [peek]);

  /** Shows pack `i`; `list` opens on its theme's list of packs instead of the pack itself. */
  const pickPack = (i: number, list = false) => {
    setListed(list);
    if (i === index) return;
    setIndex(i);
    setFrom(null);
  };

  const slotKey = (i: number) => `${sheet.id}:${i}`;

  const sizeCanvas = () => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
  };
  const paint = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const p = peel.current;
      if (p && canvas.current && p.phase === 'peel') drawPeel(canvas.current, p, peelFold(p.cx, p.cy, p.width, p.dx, p.dy));
    });
  };
  /** The carried sticker follows the finger by its style, not a re-render. */
  const moveFree = () => {
    const p = peel.current;
    const el = freeEl.current;
    if (!p || !el) return;
    el.style.left = `${p.cx + p.dx}px`;
    el.style.top = `${p.cy + p.dy}px`;
    el.style.rotate = `${p.rotate + p.tilt}deg`;
  };

  // The moves and the let-go are heard on the window, not just on the
  // sticker: if the browser drops (or never grants) the sticker's pointer
  // capture, a release away from it would otherwise never arrive and the
  // sticker would stay held.
  const unlisten = useRef<(() => void) | null>(null);
  const listen = () => {
    unlisten.current?.();
    const move = (e: PointerEvent) => onMove(e);
    const up = (e: PointerEvent) => onUp(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    unlisten.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      unlisten.current = null;
    };
  };
  useEffect(() => () => unlisten.current?.(), []);

  const end = () => {
    unlisten.current?.();
    peel.current = null;
    setLifted(null);
    setCarried(null);
  };

  /** Stick a carried sticker down where it is now (or put it back), for a hold whose release went missing. */
  const finish = (p: Peel) => {
    if (p.phase === 'free' && !p.released) {
      onPlace({ stickerId: p.stickerId, at: { x: p.cx + p.dx, y: p.cy + p.dy }, width: p.width, rotate: p.rotate });
      setTaken(p.key);
    }
    cancelAnimationFrame(frame.current);
    end();
  };

  const onDown = (slot: SheetSlot, i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary || taken === slotKey(i)) return;
    // A new touch while one is still held means that one's release was lost: settle it first.
    if (peel.current) finish(peel.current);
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the moves still come while it's over the sticker.
    }
    pulled.current = false;
    // The picture's own box, unturned: its centre and width.
    const r = e.currentTarget.getBoundingClientRect();
    const width = e.currentTarget.offsetWidth;
    const css = getComputedStyle(e.currentTarget);
    peel.current = {
      key: slotKey(i),
      stickerId: slot.stickerId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      width,
      rotate: slot.rotate,
      img,
      textures: null,
      colours: { fold: css.getPropertyValue('--sticker-fold').trim(), shadow: css.getPropertyValue('--sticker-shadow').trim() },
      phase: 'press',
      dx: 0,
      dy: 0,
      tilt: 0,
    };
    listen();
  };

  const onMove = (e: PointerEvent) => {
    const p = peel.current;
    if (!p || p.released || e.pointerId !== p.pointerId) return;
    const [dx, dy] = [e.clientX - p.startX, e.clientY - p.startY];
    const vx = dx - p.dx;
    p.dx = dx;
    p.dy = dy;
    if (p.phase === 'press') {
      if (Math.hypot(dx, dy) <= TAP_SLOP) return;
      pulled.current = true;
      if (p.img.complete && p.img.naturalWidth) {
        const css = getComputedStyle(p.img);
        p.textures = makeTextures(p.img, p.width, {
          edge: css.getPropertyValue('--sticker-edge').trim(),
          back: css.getPropertyValue('--sticker-back').trim(),
        });
        p.phase = 'peel';
        setLifted(p.key);
      } else {
        // Not drawn yet: no page-turn, it just comes away.
        p.phase = 'free';
        setLifted(p.key);
        setCarried({ ...p });
        setPeek(true);
      }
    }
    if (p.phase === 'peel') {
      if ((peelFold(p.cx, p.cy, p.width, dx, dy)?.progress ?? 0) < 1) return paint();
      // Off the sheet: it pops up whole and is carried from here.
      cancelAnimationFrame(frame.current);
      p.phase = 'free';
      setCarried({ ...p });
      // The sheet drops down out of the way at once, so the drawing shows.
      setPeek(true);
    }
    p.tilt = Math.max(-10, Math.min(10, p.tilt * 0.8 + vx * 0.5));
    moveFree();
  };

  const onUp = (e: PointerEvent) => {
    const p = peel.current;
    if (!p || p.released || e.pointerId !== p.pointerId) return;
    p.released = true;
    unlisten.current?.();
    if (p.phase === 'press') {
      peel.current = null;
      return; // a tap: the click sticks it down
    }
    const cancelled = e.type === 'pointercancel';
    if (p.phase === 'peel') {
      // Not off yet: the flap lays back down.
      const [fromX, fromY] = [p.dx, p.dy];
      const t0 = performance.now();
      const settle = (now: number) => {
        const k = Math.min(1, (now - t0) / UNPEEL_MS);
        p.dx = fromX * (1 - k);
        p.dy = fromY * (1 - k);
        if (canvas.current) drawPeel(canvas.current, p, peelFold(p.cx, p.cy, p.width, p.dx, p.dy));
        if (k < 1) frame.current = requestAnimationFrame(settle);
        else end();
      };
      frame.current = requestAnimationFrame(settle);
      return;
    }
    // Let go on the tucked-down sheet (or the system took the touch): it goes back on the sheet.
    const box = sheetEl.current?.getBoundingClientRect();
    const onSheet = !!box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    if (!cancelled && !onSheet) {
      onPlace({ stickerId: p.stickerId, at: { x: p.cx + p.dx, y: p.cy + p.dy }, width: p.width, rotate: p.rotate });
      setTaken(p.key);
    }
    end();
  };

  const tap = (slot: SheetSlot, i: number) => {
    if (pulled.current) {
      pulled.current = false;
      return;
    }
    if (taken === slotKey(i)) return;
    onPlace({ stickerId: slot.stickerId, rotate: slot.rotate });
    setTaken(slotKey(i));
    setPeek(true);
  };

  // Tucked down, the pack can be dragged up by its band: it follows the
  // finger (never below where it sits) and, let go far or fast enough, comes
  // all the way up; otherwise it drops back down. The move is set on the
  // element straight from the pointer, not by a re-render each frame.
  const placeSheets = (y: number | null, animate: boolean) => {
    const el = sheetsEl.current;
    if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = y === null ? '' : `translateY(${y}px)`;
  };
  const onRaiseDown = (e: ReactPointerEvent) => {
    const el = sheetsEl.current;
    if (!e.isPrimary || !el) return;
    const down = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
    raise.current = { id: e.pointerId, y: e.clientY, t: performance.now(), down, dy: 0, on: false };
  };
  const onRaiseMove = (e: ReactPointerEvent) => {
    const r = raise.current;
    if (!r || r.id !== e.pointerId) return;
    const dy = e.clientY - r.y;
    if (!r.on) {
      if (Math.abs(dy) < SHEET_PULL.startPx) return;
      r.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      // The pack shows again as it comes up with the finger (hidden while tucked).
      sheetsEl.current?.classList.add('is-raising');
    }
    r.dy = Math.min(0, Math.max(-r.down, dy));
    placeSheets(r.down + r.dy, false);
  };
  const onRaiseUp = (e: ReactPointerEvent) => {
    const r = raise.current;
    raise.current = null;
    if (!r || r.id !== e.pointerId || !r.on) return;
    sheetsEl.current?.classList.remove('is-raising');
    raised.current = true;
    window.setTimeout(() => (raised.current = false), 0);
    const velocity = r.dy / Math.max(1, performance.now() - r.t);
    // Either way it glides on from where the finger left it (up, or back down to its band).
    placeSheets(null, true);
    if (swipeCommits(-1, r.dy, r.down, velocity, SHEET_PULL)) setPeek(false);
  };

  // Up, the pack can be dragged down by its band or bare paper the same way:
  // it follows the finger and, let go far or fast enough, tucks down to its
  // band; otherwise it springs back up. Dragged sideways instead, it pages
  // like the arrows: the sheet follows the finger and, let go far or fast
  // enough, the next (or previous) one slides in.
  const lower = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    down: number;
    dx: number;
    dy: number;
    on: 'down' | 'side' | null;
  } | null>(null);
  /** Slides the sheet sideways with the finger (null puts it back, gliding when `animate`). */
  const slideSheet = (x: number | null, animate: boolean) => {
    const el = sheetEl.current;
    if (!el) return;
    el.style.transition = animate ? 'translate 0.18s var(--slide-ease), opacity 0.18s var(--slide-ease)' : 'none';
    el.style.translate = x === null ? '' : `${x}px 0`;
    el.style.opacity = x === null ? '' : String(Math.max(0.4, 1 - Math.abs(x) / (el.offsetWidth * 1.5)));
  };
  const lowered = useRef(false);
  const onLowerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sheetBox = sheetEl.current;
    if (peek || !e.isPrimary || !sheetBox || (e.target as Element).closest('.sticker-sheet__slot')) return;
    // How far down the tucked panel sits: all but its row of themes below the screen.
    // (The row sits `--peek-lift` up: the panel's own bottom padding, 10px + the home bar, and 12px more.)
    const panel = sheetsEl.current;
    const lift = (panel ? parseFloat(getComputedStyle(panel).paddingBottom) || 0 : 0) + 12;
    const down = Math.max(0, (panel?.offsetHeight ?? 0) - PEEK_PX - lift);
    lower.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), down, dx: 0, dy: 0, on: null };
  };
  const onLowerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = lower.current;
    if (!r || r.id !== e.pointerId) return;
    const [dx, dy] = [e.clientX - r.x, e.clientY - r.y];
    if (!r.on) {
      const side = Math.abs(dx) > Math.abs(dy);
      if (side ? Math.abs(dx) < SWIPE.startPx : Math.abs(dy) < SHEET_PULL.startPx) return;
      // Only one pack: nothing to page to.
      if (side && count < 2) return;
      r.on = side ? 'side' : 'down';
      r.t = performance.now();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Moves still come while the finger is over the pack.
      }
    }
    if (r.on === 'side') {
      r.dx = dx;
      slideSheet(dx, false);
      return;
    }
    r.dy = Math.max(0, Math.min(r.down, dy));
    placeSheets(r.dy, false);
  };
  const onLowerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = lower.current;
    lower.current = null;
    if (!r || r.id !== e.pointerId || !r.on) return;
    lowered.current = true;
    window.setTimeout(() => (lowered.current = false), 0);
    const cancelled = e.type === 'pointercancel';
    if (r.on === 'side') {
      const velocity = r.dx / Math.max(1, performance.now() - r.t);
      const width = sheetEl.current?.offsetWidth ?? window.innerWidth;
      const dir = r.dx < 0 ? -1 : 1;
      // Pulled left, the next sheet comes in from the right (like `>`).
      if (!cancelled && swipeCommits(dir, r.dx, width, velocity)) step(dir < 0 ? 1 : -1);
      else slideSheet(null, true);
      return;
    }
    const velocity = r.dy / Math.max(1, performance.now() - r.t);
    placeSheets(null, true);
    if (!cancelled && swipeCommits(1, r.dy, r.down, velocity, SHEET_PULL)) setPeek(true);
  };

  if (!sheet) return null;
  return (
    <>
      {/* Tucked down: the whole strip around the band (a little above it, edge to edge) brings the
          pack back up — a tap, or a drag up that the pack follows. */}
      {peek && !lifted && (
        <button
          className="sticker-sheets__catch"
          aria-label="스티커 팩 올리기"
          onPointerDown={onRaiseDown}
          onPointerMove={onRaiseMove}
          onPointerUp={onRaiseUp}
          onPointerCancel={onRaiseUp}
          onClick={(e) => {
            if (raised.current) return;
            // A tap on another theme's square (under this catch) brings the pack up on that theme.
            const square = document
              .elementsFromPoint(e.clientX, e.clientY)
              .find((el) => el instanceof HTMLElement && el.dataset.themeSquare !== undefined) as HTMLElement | undefined;
            const first = square && themes.find((g) => g.name === square.dataset.themeSquare)?.packs[0];
            if (first && first.sheet.name !== sheet.name) pickPack(first.index, true);
            setPeek(false);
          }}
        />
      )}
      <div ref={sheetsEl} className={`sticker-sheets ${peek ? 'is-peek' : ''}`}>
        <div className="sticker-sheets__head">
          <button className="sticker-sheets__shop" aria-label="스티커 상점" onClick={() => setShop(true)}>
            <Store size={22} strokeWidth={2.2} aria-hidden />
          </button>
          <div ref={squares} className={`sticker-sheets__themes ${squareLift ? 'is-dragging' : ''}`} data-swipe-keep>
            {themes.map((g, i) => {
              const first = g.packs[0];
              const icon = getSticker(themeIcon(g.packs.map((p) => p.sheet)) ?? '');
              const on = g.name === sheet.name;
              return (
                <button
                  key={g.name}
                  data-theme-square={g.name}
                  className={`sticker-sheets__theme ${on ? 'is-on' : ''} ${squareLift?.name === g.name ? 'is-lifted' : ''}`}
                  style={{ '--pack': themeIconBg(g.packs.map((p) => p.sheet)) ?? g.color, transform: squareLift ? `translateX(${squareShift(i)}px)` : undefined } as CSSProperties}
                  aria-label={first?.sheet.label ?? g.name}
                  aria-pressed={on}
                  aria-expanded={on ? listed : undefined}
                  onPointerDown={(e) => pressSquare(e, g.name)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => {
                    if (squareDropped.current || !first) return;
                    if (on) setListed((v) => !v);
                    // Another theme opens on its list of packs first.
                    else pickPack(first.index, true);
                  }}
                >
                  {icon && <img src={icon.src} alt="" draggable={false} />}
                </button>
              );
            })}
          </div>
        </div>
        {listed ? (
          <ThemePackList sheets={sheets} current={index} onPick={pickPack} />
        ) : (
        <div className="sticker-sheets__row" style={{ '--pack': sheet.color } as CSSProperties}>
          <button className="sticker-sheets__step" aria-label="이전 스티커 한 장" disabled={alone} onClick={() => step(-1)}>
            <ChevronLeft size={30} strokeWidth={2.2} aria-hidden />
          </button>
          <div
            ref={sheetEl}
            key={sheet.id}
            className={`sticker-sheet ${from ? `is-from-${from}` : ''}`}
            style={{ '--pack': sheet.color, '--pack-ink': sheet.ink } as CSSProperties}
            role="group"
            data-swipe-keep
            aria-label={`스티커 한 장 ${sheet.label ?? sheet.name}`}
            onPointerDown={onLowerDown}
            onPointerMove={onLowerMove}
            onPointerUp={onLowerUp}
            onPointerCancel={onLowerUp}
            // Tucked down: a tap brings it back up. Up: a tap on the band goes back
            // to the list, and one on the bare paper tucks it down.
            onClick={(e) => {
              if (lowered.current) return;
              if (peek) return setPeek(false);
              const t = e.target as Element;
              if (t.closest('.sticker-pack__band')) return setListed(true);
              if (!t.closest('.sticker-sheet__slot')) setPeek(true);
            }}
          >
            <StickerPackBand sheet={sheet} />
            <div className="sticker-sheet__body">
              {sheet.slots.map((slot, i) => {
                const sticker = getSticker(slot.stickerId);
                if (!sticker) return null;
                const key = slotKey(i);
                return (
                  <button
                    key={key}
                    className={`sticker-sheet__slot ${taken === key ? 'is-used' : ''} ${lifted === key ? 'is-lifted' : ''}`}
                    style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.size * 100}%`, rotate: `${slot.rotate}deg` } as CSSProperties}
                    aria-label={`스티커 ${sticker.label}`}
                    disabled={taken === key}
                    onPointerDown={onDown(slot, i)}
                    onClick={(e) => {
                      // The sheet's own click would tuck it away or bring it back.
                      e.stopPropagation();
                      tap(slot, i);
                    }}
                  >
                    <img src={sticker.src} alt="" draggable={false} />
                  </button>
                );
              })}
            </div>
          </div>
          <button className="sticker-sheets__step" aria-label="다음 스티커 한 장" disabled={alone} onClick={() => step(1)}>
            <ChevronRight size={30} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        )}
        {lifted &&
          createPortal(
            <>
              {!carried && <canvas ref={(el) => { canvas.current = el; if (el) { sizeCanvas(); paint(); } }} className="sticker-peel" aria-hidden />}
              {carried && (
                <img
                  ref={(el) => {
                    freeEl.current = el;
                    if (el) moveFree();
                  }}
                  className="sticker-free"
                  src={getSticker(carried.stickerId)?.src}
                  style={{ width: `${carried.width}px`, '--edge': `${stickerEdgePx(carried.width)}px` } as CSSProperties}
                  alt=""
                  draggable={false}
                />
              )}
            </>,
            document.body,
          )}
      </div>
      {/* On the body, over everything the tool sits under (TODAY's ‹ included). */}
      {shop && createPortal(<StickerShop onClose={() => setShop(false)} />, document.body)}
    </>
  );
}

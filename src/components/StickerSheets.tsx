import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getSticker } from '../domain/decor';
import { outlinedSticker } from '../lib/stickerEdge';
import { peelFold, STICKER_SHEETS, type PeelFold, type SheetSlot, type StickerDrop, type StickerSheet } from '../domain/stickerSheets';

/** Less movement than this is a tap on a sticker, not a pull (px). */
const TAP_SLOP = 6;
/** The white die-cut edge around a sticker (px; the CSS outline is about as wide). */
const EDGE_PX = 2.5;
/** A let-go mid-peel lays the flap back down over this long (ms). */
const UNPEEL_MS = 140;
/** A new sheet slides in this long (ms, matches `sheet-in`). */
const SLIDE_MS = 260;

/** The sticker's die-cut edge, and its paper back, drawn once when a peel starts. */
interface Textures {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  /** Their width on screen, edge included (px). */
  size: number;
}

function makeTextures(img: HTMLImageElement, width: number, colours: { edge: string; back: string }): Textures {
  const dpr = window.devicePixelRatio || 1;
  const { canvas: front } = outlinedSticker(img, width * dpr, EDGE_PX * dpr, colours.edge);
  const back = Object.assign(document.createElement('canvas'), { width: front.width, height: front.height });
  const bc = back.getContext('2d')!;
  bc.drawImage(front, 0, 0);
  bc.globalCompositeOperation = 'source-in';
  bc.fillStyle = colours.back;
  bc.fillRect(0, 0, back.width, back.height);
  return { front, back, size: front.width / dpr };
}

/** The pack's band: its colour (set on the sheet), its name, a pattern and a STICKER PACK tag. */
export function StickerPackBand({ sheet }: { sheet: Pick<StickerSheet, 'name' | 'nameStyle' | 'motif'> }) {
  return (
    <div className="sticker-pack__band" aria-hidden>
      <span className={`sticker-pack__name sticker-pack__name--${sheet.nameStyle}`}>{sheet.name}</span>
      <span className="sticker-pack__side">
        {sheet.motif !== 'none' && <i className={`sticker-pack__motif sticker-pack__motif--${sheet.motif}`} />}
        <span className="sticker-pack__tag">STICKER PACK</span>
      </span>
    </div>
  );
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
 * The sticker tool: a printed sheet of stickers a little below the middle of
 * the screen, `<` `>` to the sheets either side. Pull a sticker and it peels
 * off toward the pull, page-turn style, then comes away and follows the
 * finger; let go and it's stuck on the drawing there. A tap sticks it in the
 * drawing's middle. Once it's off, the sheet drops to the bottom edge (its
 * band showing) and stays there until that band is tapped; let go on it and
 * the sticker goes back. A peeled spot keeps a faint mark of the sticker,
 * from the first lift until the pack next comes up, full again — so at
 * most one spot is ever bare. While it's up, a touch anywhere off it tucks
 * it down (and only the next one puts the tool away).
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
  const setPeek = (down: boolean) => {
    setPeekState(down);
    if (!down) setTaken(null);
  };
  const sheetEl = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const freeEl = useRef<HTMLImageElement | null>(null);
  const peel = useRef<Peel | null>(null);
  const frame = useRef(0);
  /** Swallows the click that ends a pull. */
  const pulled = useRef(false);
  const count = sheets.length;
  const sheet = sheets[Math.min(index, count - 1)];

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const step = (by: 1 | -1) => {
    setIndex((i) => (i + by + count) % count);
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
      if (!e.isPrimary || peel.current || t?.closest('.sticker-sheets__row, .decor-rail, .color-picker')) return;
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

  if (!sheet) return null;
  return (
    <>
      {/* Tucked down: the whole strip around the band (a little above it, edge to edge) brings the pack back up. */}
      {peek && !lifted && <button className="sticker-sheets__catch" aria-label="스티커 팩 올리기" onClick={() => setPeek(false)} />}
      <div className={`sticker-sheets ${peek ? 'is-peek' : ''}`}>
        <div className="sticker-sheets__row">
          <button className="sticker-sheets__step" aria-label="이전 스티커 한 장" onClick={() => step(-1)}>
            <ChevronLeft size={30} strokeWidth={2.2} aria-hidden />
          </button>
          <div
            ref={sheetEl}
            key={sheet.id}
            className={`sticker-sheet ${from ? `is-from-${from}` : ''}`}
            style={{ '--pack': sheet.color, '--pack-ink': sheet.ink } as CSSProperties}
            role="group"
            aria-label={`스티커 한 장 ${sheet.label ?? sheet.name}`}
            // Tucked down: a tap brings it back up. Up: a tap off the stickers tucks it down.
            onClick={(e) => (peek ? setPeek(false) : !(e.target as Element).closest('.sticker-sheet__slot') && setPeek(true))}
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
          <button className="sticker-sheets__step" aria-label="다음 스티커 한 장" onClick={() => step(1)}>
            <ChevronRight size={30} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
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
                  style={{ width: `${carried.width}px` }}
                  alt=""
                  draggable={false}
                />
              )}
            </>,
            document.body,
          )}
      </div>
    </>
  );
}

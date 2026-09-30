import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  clamp01,
  ERASER_SCALE,
  extendStroke,
  inkCss,
  PEN_WIDTHS,
  STICKER_SIZE,
  stickerGesture,
  type DayDecor,
  type DecorTool,
  type PenSettings,
  type StickerPose,
  type Stroke,
} from '../domain/decor';

interface DecorLayerProps {
  decor: DayDecor;
  /** Which tool is out; stickers and strokes only take touches with theirs. */
  tool: DecorTool | null;
  /** Sticker picked in the tray, placed where the box is tapped. */
  armed: string | null;
  pen: PenSettings;
  onChange: (decor: DayDecor) => void;
}

const strokePath = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' ') +
  // A single tap still leaves a dot.
  (points.length === 1 ? ` l0.01 0` : '');

/**
 * One stroke as SVG, styled by its pen: plain ink; a wide see-through
 * highlighter; or a neon tube (blurred glow in the colour, then the colour,
 * then a bright core).
 */
function Ink({ stroke, glowId }: { stroke: Stroke; glowId: string }) {
  const d = strokePath(stroke.points);
  const w = PEN_WIDTHS[stroke.width] * 100;
  const color = inkCss(stroke.color);
  if (stroke.tool === 'highlighter') {
    return <path d={d} className="decor__hl" style={{ stroke: color, strokeWidth: w * 2.4 }} />;
  }
  if (stroke.tool === 'neon') {
    return (
      <g>
        <path d={d} filter={`url(#${glowId})`} style={{ stroke: color, strokeWidth: w * 1.8 }} />
        <path d={d} style={{ stroke: color, strokeWidth: w }} />
        <path d={d} className="decor__neon-core" style={{ strokeWidth: w * 0.35 }} />
      </g>
    );
  }
  return <path d={d} style={{ stroke: color, strokeWidth: w }} />;
}

/**
 * All strokes in order. Each eraser pass wraps everything drawn before it
 * in a mask that hides where it rubbed, so it clears an area of earlier
 * ink but not what's drawn afterwards.
 */
function inkLayers(strokes: Stroke[], glowId: string, maskId: string): ReactNode[] {
  let layers: ReactNode[] = [];
  strokes.forEach((stroke, i) => {
    if (stroke.tool !== 'eraser') {
      layers.push(<Ink key={i} stroke={stroke} glowId={glowId} />);
      return;
    }
    const id = `${maskId}-${i}`;
    layers = [
      <mask key={`m${i}`} id={id} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
        <rect x="-10" y="-10" width="120" height="120" className="decor__mask-keep" />
        <path
          d={strokePath(stroke.points)}
          className="decor__mask-rub"
          style={{ strokeWidth: PEN_WIDTHS[stroke.width] * ERASER_SCALE * 100 }}
        />
      </mask>,
      <g key={`g${i}`} mask={`url(#${id})`}>
        {layers}
      </g>,
    ];
  });
  return layers;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random()}`;

/**
 * Stickers and pen strokes over the ping drawing (the `.pings` box; all
 * positions are box fractions). With the sticker tool, tapping the box
 * places the picked sticker and placed ones can be dragged or removed;
 * with the pen, a finger draws. Otherwise the layer is just a picture.
 */
export default function DecorLayer({ decor, tool, armed, pen, onChange }: DecorLayerProps) {
  const layer = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Fingers on the selected sticker (the first on it, a second anywhere in
  // the box), and its pose when the current set of fingers came down.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ id: string; base: StickerPose; from: { x: number; y: number }[] } | null>(null);
  const [live, setLiveState] = useState<({ id: string } & StickerPose) | null>(null);
  // Mirrored in a ref: a finger can lift in the same frame as the last move,
  // before a re-render hands the handlers the newest pose.
  const liveRef = useRef(live);
  const setLive = (next: typeof live) => {
    liveRef.current = next;
    setLiveState(next);
  };

  // While drawing or placing, finger moves are ours: stop the browser from
  // turning a quick stroke into a scroll fling, which would swallow the next
  // tap (on a tool button, say) as "stop the fling". Needs a non-passive
  // listener, so it can't be a React prop.
  const active = tool === 'sticker' || tool === 'pen';
  useEffect(() => {
    const el = layer.current;
    if (!el || !active) return;
    const hold = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', hold, { passive: false });
    return () => el.removeEventListener('touchmove', hold);
  }, [active]);

  const at = (e: PointerEvent): [number, number] => {
    const box = layer.current!.getBoundingClientRect();
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  };

  // ----- Pen -----

  const onPenDown = (e: PointerEvent) => {
    // A second finger means a pinch or a palm, not drawing: drop the stroke in progress.
    if (!e.isPrimary) return setDrawing(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    setDrawing({ tool: pen.tool, color: pen.color, width: pen.width, points: extendStroke([], x, y) });
  };
  const onPenMove = (e: PointerEvent) => {
    if (!drawing) return;
    const [x, y] = at(e);
    const points = extendStroke(drawing.points, x, y);
    if (points !== drawing.points) setDrawing({ ...drawing, points });
  };
  const onPenUp = () => {
    if (!drawing) return;
    onChange({ ...decor, strokes: [...decor.strokes, drawing] });
    setDrawing(null);
  };

  // ----- Stickers -----

  const poseOf = (id: string): StickerPose => {
    const now = liveRef.current;
    if (now?.id === id) return now;
    const st = decor.stickers.find((x) => x.id === id)!;
    return { x: st.x, y: st.y, size: st.size, rotate: st.rotate ?? 0 };
  };

  // Each time a finger lands or lifts, the gesture restarts from the pose so
  // far, so going from one finger to two (or back) never makes it jump.
  const restart = (id: string) => {
    gesture.current = fingers.current.size ? { id, base: poseOf(id), from: [...fingers.current.values()].slice(0, 2) } : null;
  };

  const grab = (id: string, e: PointerEvent) => {
    // Captured by the layer, so the sticker's fingers and a second finger
    // elsewhere in the box all report to the same handlers.
    layer.current!.setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    restart(id);
  };

  const onBoxDown = (e: PointerEvent) => {
    if (e.target !== e.currentTarget) return; // a sticker handles its own press
    // A second finger while one holds a sticker: pinch and twist it.
    if (gesture.current && fingers.current.size === 1) return grab(gesture.current.id, e);
    if (!e.isPrimary) return;
    setSelected(null);
    if (!armed) return;
    const [x, y] = at(e);
    const sticker = { id: newId(), emoji: armed, x: clamp01(x), y: clamp01(y), size: STICKER_SIZE };
    onChange({ ...decor, stickers: [...decor.stickers, sticker] });
    setSelected(sticker.id);
  };

  const onStickerDown = (id: string) => (e: PointerEvent) => {
    if (tool !== 'sticker') return;
    e.stopPropagation();
    if (gesture.current && gesture.current.id !== id) {
      // Second finger landed on another sticker: still the first one's pinch.
      if (fingers.current.size === 1) grab(gesture.current.id, e);
      return;
    }
    if (fingers.current.size >= 2) return;
    setSelected(id);
    grab(id, e);
  };

  const onStickerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || !fingers.current.has(e.pointerId)) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const to = [...fingers.current.values()].slice(0, 2);
    if (to.length !== g.from.length) return;
    const pose = stickerGesture(g.base, g.from, to, layer.current!.getBoundingClientRect().width);
    setLive({ id: g.id, ...pose });
  };

  const onStickerUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || !fingers.current.delete(e.pointerId)) return;
    if (fingers.current.size) return restart(g.id);
    gesture.current = null;
    if (!liveRef.current) return;
    const { id, ...pose } = liveRef.current;
    onChange({ ...decor, stickers: decor.stickers.map((st) => (st.id === id ? { ...st, ...pose } : st)) });
    setLive(null);
  };

  const strokes = drawing ? [...decor.strokes, drawing] : decor.strokes;
  const uid = useId().replace(/:/g, '');
  const glowId = `neon-${uid}`;

  return (
    <div
      ref={layer}
      className={`decor ${active ? `decor--${tool}` : ''} ${tool === 'sticker' && armed ? 'is-armed' : ''} ${tool === 'pen' && pen.tool === 'eraser' ? 'is-erasing' : ''}`}
      onPointerDown={tool === 'pen' ? onPenDown : tool === 'sticker' ? onBoxDown : undefined}
      onPointerMove={tool === 'pen' ? onPenMove : tool === 'sticker' ? onStickerMove : undefined}
      onPointerUp={tool === 'pen' ? onPenUp : tool === 'sticker' ? onStickerUp : undefined}
      onPointerCancel={tool === 'pen' ? onPenUp : tool === 'sticker' ? onStickerUp : undefined}
      aria-hidden={!active}
    >
      {strokes.length > 0 && (
        <svg className="decor__ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            {/* Filter region in box units, not the stroke's own bounds: a flat
                stroke's bounds are too thin and would clip the glow square. */}
            <filter id={glowId} filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          {inkLayers(strokes, glowId, `rub-${uid}`)}
        </svg>
      )}
      {decor.stickers.map((s) => {
        const pos = live?.id === s.id ? live : s;
        const isSelected = tool === 'sticker' && selected === s.id;
        return (
          <span
            key={s.id}
            className={`decor__sticker ${isSelected ? 'is-selected' : ''}`}
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              fontSize: `${pos.size * 78}cqw`,
              rotate: `${pos.rotate ?? 0}deg`,
            }}
            onPointerDown={onStickerDown(s.id)}
          >
            {s.emoji}
            {isSelected && (
              <button
                className="decor__remove"
                aria-label="스티커 떼기"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onChange({ ...decor, stickers: decor.stickers.filter((st) => st.id !== s.id) });
                  setSelected(null);
                }}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

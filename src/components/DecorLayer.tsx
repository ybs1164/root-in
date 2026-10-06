import { Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  CRAYON_SCALE,
  bringDecorToFront,
  decorPieces,
  nextDecorOrder,
  withDecorOrder,
  clamp01,
  getSticker,
  cleanTextStyle,
  dropOutcome,
  ERASER_SCALE,
  extendStroke,
  inkCss,
  isBlankText,
  PEN_WIDTHS,
  STICKER_MAX,
  STICKER_MIN,
  STICKER_SIZE,
  stickerGesture,
  TEXT_LINE_HEIGHT,
  TEXT_MAX,
  TEXT_MAX_LENGTH,
  TEXT_MIN,
  TEXT_SIZE,
  textFamily,
  textWeight,
  type DayDecor,
  type DecorTool,
  type PenSettings,
  type PlacedText,
  type StickerPose,
  type Stroke,
  type TextStyle,
} from '../domain/decor';

/** The text box picked with the text tool, and whether it's being typed in. */
export type TextFocus = { id: string; editing: boolean } | null;

interface DecorLayerProps {
  decor: DayDecor;
  /** Which tool is out; stickers and strokes only take touches with theirs. */
  tool: DecorTool | null;
  /** Sticker picked in the tray, placed where the box is tapped. */
  armed: string | null;
  pen: PenSettings;
  onChange: (decor: DayDecor) => void;
  /** Stickers and ink settle in from above once the pins have landed (it mounts with the day). */
  enterDelayMs?: number;
  /** Text tool: the box picked (its toolbar shows below) or being typed in. */
  textFocus?: TextFocus;
  onTextFocus?: (focus: TextFocus) => void;
  /** How a new text box starts out (the last style picked). */
  textStyle?: TextStyle;
  /** A sticker or text box is being dragged (the tool sheet steps aside for the trash under the box). */
  onDragging?: (on: boolean) => void;
  /**
   * The box's height over its width (1: a square). Places are fractions of
   * the box's width and height; sizes, pen widths included, of its width.
   */
  aspect?: number;
}

/** How far a finger may wander and still count as a tap on a box (px). */
const TAP_SLOP = 6;

/** CSS for a text box's looks (the share image draws the same in lib/shareImage.ts). */
const textCss = (t: PlacedText) => ({
  fontFamily: textFamily(t.font),
  fontWeight: textWeight(t),
  fontStyle: t.italic ? 'italic' : 'normal',
  textDecorationLine: [t.underline && 'underline', t.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
  textAlign: t.align,
  color: inkCss(t.color),
  lineHeight: TEXT_LINE_HEIGHT,
});

/** In the ink's viewBox: 100 across, 100 × aspect down. */
const strokePath = (points: [number, number][], aspect: number) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100 * aspect).toFixed(2)}`).join(' ') +
  // A single tap still leaves a dot.
  (points.length === 1 ? ` l0.01 0` : '');

/**
 * One stroke as SVG, styled by its pen: plain ink; a wide see-through
 * highlighter; a neon tube (blurred glow in the colour, then the colour,
 * then a bright core); or a waxy crayon line (grain cut out of it and its
 * edges roughened by the crayon filter).
 */
function Ink({ stroke, glowId, aspect }: { stroke: Stroke; glowId: string; aspect: number }) {
  const d = strokePath(stroke.points, aspect);
  const w = PEN_WIDTHS[stroke.width] * 100;
  const color = inkCss(stroke.color);
  if (stroke.tool === 'highlighter') {
    return <path d={d} className="decor__hl" style={{ stroke: color, strokeWidth: w * 2.4 }} />;
  }
  if (stroke.tool === 'crayon') {
    return <path d={d} filter={`url(#${glowId}-crayon)`} style={{ stroke: color, strokeWidth: w * CRAYON_SCALE }} />;
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
function inkLayers(strokes: Stroke[], glowId: string, maskId: string, aspect: number): ReactNode[] {
  const h = 100 * aspect + 20;
  let layers: ReactNode[] = [];
  strokes.forEach((stroke, i) => {
    if (stroke.tool !== 'eraser') {
      layers.push(<Ink key={i} stroke={stroke} glowId={glowId} aspect={aspect} />);
      return;
    }
    const id = `${maskId}-${i}`;
    layers = [
      <mask key={`m${i}`} id={id} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height={h}>
        <rect x="-10" y="-10" width="120" height={h} className="decor__mask-keep" />
        <path
          d={strokePath(stroke.points, aspect)}
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
export default function DecorLayer({
  decor: savedDecor,
  tool,
  armed,
  pen,
  onChange,
  enterDelayMs = 0,
  textFocus = null,
  onTextFocus = () => {},
  textStyle = { font: 'sans', color: 'ink-black', align: 'center' },
  onDragging,
  aspect = 1,
}: DecorLayerProps) {
  const decor = useMemo(() => withDecorOrder(savedDecor), [savedDecor]);
  const decorRef = useRef(decor);
  decorRef.current = decor;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const changeDecor = (next: DayDecor) => {
    decorRef.current = next;
    changeRef.current(next);
  };
  const layer = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Fingers on the selected sticker (the first on it, a second anywhere in
  // the box), and its pose when the current set of fingers came down.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: 'sticker' | 'text';
    id: string;
    base: StickerPose;
    from: { x: number; y: number }[];
    /** Where the first finger came down, and whether the box was already picked then (a tap on it types). */
    start?: { x: number; y: number; picked: boolean };
    moved?: boolean;
  } | null>(null);
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
  const active = tool === 'sticker' || tool === 'pen' || tool === 'text';
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
    setDrawing({ order: nextDecorOrder(decor), tool: pen.tool, color: pen.color, width: pen.width, points: extendStroke([], x, y) });
  };
  const onPenMove = (e: PointerEvent) => {
    if (!drawing) return;
    const [x, y] = at(e);
    const points = extendStroke(drawing.points, x, y);
    if (points !== drawing.points) setDrawing({ ...drawing, points });
  };
  const onPenUp = () => {
    if (!drawing) return;
    changeDecor({ ...decor, strokes: [...decor.strokes, drawing] });
    setDrawing(null);
  };

  // ----- Stickers -----

  const poseOf = (kind: 'sticker' | 'text', id: string): StickerPose => {
    const now = liveRef.current;
    if (now?.id === id) return now;
    const st = (kind === 'sticker' ? decor.stickers : (decor.texts ?? [])).find((x) => x.id === id)!;
    return { x: st.x, y: st.y, size: st.size, rotate: st.rotate ?? 0 };
  };

  // Each time a finger lands or lifts, the gesture restarts from the pose so
  // far, so going from one finger to two (or back) never makes it jump.
  const restart = (kind: 'sticker' | 'text', id: string) => {
    const g = gesture.current;
    gesture.current = fingers.current.size
      ? { kind, id, base: poseOf(kind, id), from: [...fingers.current.values()].slice(0, 2), start: g?.start, moved: g?.moved }
      : null;
  };

  const grab = (kind: 'sticker' | 'text', id: string, e: PointerEvent, picked = false) => {
    // Captured by the layer, so the box's fingers and a second finger
    // elsewhere in the box all report to the same handlers.
    layer.current!.setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const first = !gesture.current;
    restart(kind, id);
    if (first && gesture.current) gesture.current.start = { x: e.clientX, y: e.clientY, picked };
    else if (gesture.current) gesture.current.moved = true; // a second finger: a pinch, not a tap
  };

  const onBoxDown = (e: PointerEvent) => {
    if (e.target !== e.currentTarget) return; // a sticker handles its own press
    // A second finger while one holds a sticker: pinch and twist it.
    if (gesture.current && fingers.current.size === 1) return grab(gesture.current.kind, gesture.current.id, e);
    if (!e.isPrimary) return;
    setSelected(null);
    if (!armed) return;
    const [x, y] = at(e);
    const sticker = { order: nextDecorOrder(decor), id: newId(), stickerId: armed, x: clamp01(x), y: clamp01(y), size: STICKER_SIZE };
    changeDecor({ ...decor, stickers: [...decor.stickers, sticker] });
    setSelected(sticker.id);
  };

  const onStickerDown = (id: string) => (e: PointerEvent) => {
    if (tool !== 'sticker') return;
    e.stopPropagation();
    if (gesture.current && gesture.current.id !== id) {
      // Second finger landed on another sticker: still the first one's pinch.
      if (fingers.current.size === 1) grab(gesture.current.kind, gesture.current.id, e);
      return;
    }
    if (fingers.current.size >= 2) return;
    changeDecor(bringDecorToFront(decorRef.current, 'sticker', id));
    setSelected(id);
    grab('sticker', id, e);
  };

  const onStickerMove = (e: PointerEvent) => {
    const p = pendingPinch.current;
    if (p?.pointerId === e.pointerId) {
      p.x = e.clientX;
      p.y = e.clientY;
      return;
    }
    const g = gesture.current;
    if (!g || !fingers.current.has(e.pointerId)) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g.moved && g.start && Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) <= TAP_SLOP) return;
    g.moved = true;
    const to = [...fingers.current.values()].slice(0, 2);
    if (to.length !== g.from.length) return;
    const limits = g.kind === 'text' ? { min: TEXT_MIN, max: TEXT_MAX, free: true } : { min: STICKER_MIN, max: STICKER_MAX, free: true };
    const pose = stickerGesture(g.base, g.from, to, layer.current!.getBoundingClientRect().width, limits);
    setLive({ id: g.id, ...pose });
    const over = landing(e) === 'trash';
    if (over !== overTrash) setOverTrash(over);
  };

  // Dragged pieces may go anywhere; where the finger lets go decides: the
  // trash (just under the box, shown while dragging) deletes; anywhere else
  // the piece lands at the nearest spot on the box.
  const trashEl = useRef<HTMLSpanElement | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const dragging = !!live;
  useEffect(() => onDragging?.(dragging), [dragging]); // eslint-disable-line react-hooks/exhaustive-deps
  const landing = (e: PointerEvent) =>
    dropOutcome(
      { x: e.clientX, y: e.clientY },
      layer.current!.getBoundingClientRect(),
      trashEl.current?.getBoundingClientRect() ?? null,
    );

  const onStickerUp = (e: PointerEvent) => {
    if (pendingPinch.current?.pointerId === e.pointerId) {
      pendingPinch.current = null;
      return onTextFocus(null); // no second finger came: a tap off the picked box
    }
    const g = gesture.current;
    if (!g || !fingers.current.delete(e.pointerId)) return;
    if (fingers.current.size) return restart(g.kind, g.id);
    gesture.current = null;
    if (!liveRef.current) {
      // A tap on a text box that was already picked: type in it.
      if (g.kind === 'text' && !g.moved && g.start?.picked) startTyping(g.id);
      return;
    }
    const { id, ...moved } = liveRef.current;
    setOverTrash(false);
    setLive(null);
    // A cancelled touch (the system took it) puts the piece back where it was.
    if (e.type === 'pointercancel') return;
    if (landing(e) === 'trash') {
      if (g.kind === 'sticker') {
        changeDecor({ ...decor, stickers: decor.stickers.filter((st) => st.id !== id) });
        setSelected(null);
      } else {
        changeDecor({ ...decor, texts: (decor.texts ?? []).filter((t) => t.id !== id) });
        onTextFocus(null);
      }
      return;
    }
    // On the box it stays where it is; off it, it comes to the nearest spot on it.
    const pose = { ...moved, x: clamp01(moved.x), y: clamp01(moved.y) };
    if (g.kind === 'sticker') changeDecor({ ...decor, stickers: decor.stickers.map((st) => (st.id === id ? { ...st, ...pose } : st)) });
    else changeDecor({ ...decor, texts: (decor.texts ?? []).map((t) => (t.id === id ? { ...t, ...pose } : t)) });
  };

  // ----- Text -----

  // The box being typed in: a copy until it's done (a new one isn't on the
  // day yet), so a box left blank never makes it into the day or its undo.
  const [draft, setDraftState] = useState<PlacedText | null>(null);
  const draftRef = useRef(draft);
  const setDraft = (next: PlacedText | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const focusRef = useRef(onTextFocus);
  focusRef.current = onTextFocus;

  const startTyping = (id: string) => {
    const t = (decorRef.current.texts ?? []).find((x) => x.id === id);
    if (!t) return;
    setDraft({ ...t });
    onTextFocus({ id, editing: true });
  };

  /** Done typing: blank boxes go, others are kept (or updated). Safe to call twice. */
  const finishTyping = () => {
    const d = draftRef.current;
    if (!d) return;
    setDraft(null);
    focusRef.current(null);
    const now = decorRef.current;
    const texts = now.texts ?? [];
    const old = texts.find((t) => t.id === d.id);
    if (isBlankText(d.text)) {
      if (old) changeDecor({ ...now, texts: texts.filter((t) => t.id !== d.id) });
      return;
    }
    if (!old) changeDecor({ ...now, texts: [...texts, d] });
    else if (old.text !== d.text) changeDecor({ ...now, texts: texts.map((t) => (t.id === d.id ? { ...t, text: d.text } : t)) });
    // Written: the box stays picked, so its toolbar comes straight up.
    focusRef.current({ id: d.id, editing: false });
  };

  // Putting the text tool away (or leaving the day) ends the typing.
  useEffect(() => {
    if (tool !== 'text') finishTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => finishTyping(), []);

  // A picked box is small to get two fingers on: with one picked, a finger
  // on bare drawing waits to see if a second follows (anywhere in the box,
  // the picked box included) and then pinches and turns the picked box.
  // Lifted alone, it was a tap that lets go of the box.
  const pendingPinch = useRef<{ pointerId: number; id: string; x: number; y: number } | null>(null);
  const startPinch = (e: PointerEvent) => {
    const p = pendingPinch.current!;
    pendingPinch.current = null;
    layer.current!.setPointerCapture(e.pointerId);
    fingers.current.clear();
    fingers.current.set(p.pointerId, { x: p.x, y: p.y });
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { kind: 'text', id: p.id, base: poseOf('text', p.id), from: [...fingers.current.values()], moved: true };
  };

  const onTextBoxDown = (e: PointerEvent) => {
    if (e.target !== e.currentTarget) return; // a box handles its own press
    if (gesture.current && fingers.current.size === 1) return grab(gesture.current.kind, gesture.current.id, e);
    if (pendingPinch.current && e.pointerId !== pendingPinch.current.pointerId) return startPinch(e);
    if (!e.isPrimary) return;
    // No mouse events after this: they would move focus off the new box's field.
    e.preventDefault();
    // A tap away from the box being typed in or picked lets go of it first.
    if (draftRef.current) return finishTyping();
    if (textFocus && !textFocus.editing) {
      e.currentTarget.setPointerCapture(e.pointerId);
      pendingPinch.current = { pointerId: e.pointerId, id: textFocus.id, x: e.clientX, y: e.clientY };
      return;
    }
    if (textFocus) return onTextFocus(null);
    const [x, y] = at(e);
    const box: PlacedText = { order: nextDecorOrder(decorRef.current), id: newId(), text: '', x: clamp01(x), y: clamp01(y), size: TEXT_SIZE, ...cleanTextStyle(textStyle) };
    setDraft(box);
    onTextFocus({ id: box.id, editing: true });
  };

  const onTextDown = (id: string) => (e: PointerEvent) => {
    if (tool !== 'text') return;
    e.stopPropagation();
    if (draftRef.current?.id === id) return; // typing in it: the finger moves the caret
    e.preventDefault();
    if (pendingPinch.current) return startPinch(e); // the second finger of a pinch on the picked box
    if (draftRef.current) finishTyping();
    if (gesture.current && gesture.current.id !== id) {
      if (fingers.current.size === 1) grab(gesture.current.kind, gesture.current.id, e);
      return;
    }
    if (fingers.current.size >= 2) return;
    changeDecor(bringDecorToFront(decorRef.current, 'text', id));
    const picked = textFocus?.id === id && !textFocus.editing;
    onTextFocus({ id, editing: false });
    grab('text', id, e, picked);
  };

  const strokes = drawing ? [...decor.strokes, drawing] : decor.strokes;
  const savedTexts = decor.texts ?? [];
  const texts = draft
    ? savedTexts.some((t) => t.id === draft.id)
      ? savedTexts.map((t) => (t.id === draft.id ? draft : t))
      : [...savedTexts, draft]
    : savedTexts;
  const pieces = decorPieces({ ...decor, strokes, texts });
  const zIndex = new Map(pieces.map((p, i) => [`${p.kind}:${p.index}`, i + 1]));
  const uid = useId().replace(/:/g, '');
  const glowId = `neon-${uid}`;

  return (
    <div
      ref={layer}
      className={`decor ${active ? `decor--${tool}` : ''} ${tool === 'sticker' && armed ? 'is-armed' : ''} ${tool === 'pen' && pen.tool === 'eraser' ? 'is-erasing' : ''}`}
      onPointerDown={tool === 'pen' ? onPenDown : tool === 'sticker' ? onBoxDown : tool === 'text' ? onTextBoxDown : undefined}
      onPointerMove={tool === 'pen' ? onPenMove : tool === 'sticker' || tool === 'text' ? onStickerMove : undefined}
      onPointerUp={tool === 'pen' ? onPenUp : tool === 'sticker' || tool === 'text' ? onStickerUp : undefined}
      onPointerCancel={tool === 'pen' ? onPenUp : tool === 'sticker' || tool === 'text' ? onStickerUp : undefined}
      style={{ animationDelay: `${enterDelayMs}ms` }}
      aria-hidden={!active}
    >
      {strokes.map((stroke, i) => stroke.tool !== 'eraser' && (
        <svg key={i} className="decor__ink" style={{ zIndex: zIndex.get(`stroke:${i}`) }} viewBox={`0 0 100 ${100 * aspect}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            {/* Filter region in box units, not the stroke's own bounds: a flat
                stroke's bounds are too thin and would clip the glow square. */}
            <filter id={`${glowId}-${i}`} filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height={100 * aspect + 20}>
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
            {/* Crayon: fractal noise both roughens the line's edges and, made
                into an alpha grain, punches the paper's tooth through it. */}
            <filter id={`${glowId}-${i}-crayon`} filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height={100 * aspect + 20}>
              <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.15" result="grain" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.7" xChannelSelector="R" yChannelSelector="G" result="rough" />
              <feComposite in="rough" in2="grain" operator="in" />
            </filter>
          </defs>
          {inkLayers([stroke, ...strokes.slice(i + 1).filter((s) => s.tool === 'eraser')], `${glowId}-${i}`, `rub-${uid}-${i}`, aspect)}
        </svg>
      ))}
      {drawing?.tool === 'eraser' && (
        <svg className="decor__ink" style={{ zIndex: pieces.length + 1 }} viewBox={`0 0 100 ${100 * aspect}`} preserveAspectRatio="none" aria-hidden>
          {/* While rubbing: a ring the size of the eraser under the finger, so it shows how much it takes. */}
          {drawing?.tool === 'eraser' && drawing.points.length > 0 && (() => {
            const [x, y] = drawing.points[drawing.points.length - 1];
            return (
              <circle
                className="decor__eraser-ring"
                cx={x * 100}
                cy={y * 100 * aspect}
                r={(PEN_WIDTHS[drawing.width] * ERASER_SCALE * 100) / 2}
              />
            );
          })()}
        </svg>
      )}
      {decor.stickers.map((s, i) => {
        const sticker = getSticker(s.stickerId);
        if (!sticker) return null;
        const pos = live?.id === s.id ? live : s;
        const isSelected = tool === 'sticker' && selected === s.id;
        return (
          <span
            key={s.id}
            className={`decor__sticker ${isSelected ? 'is-selected' : ''} ${live?.id === s.id ? `is-lifted ${overTrash ? 'is-doomed' : ''}` : ''}`}
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: `${pos.size * 78}cqw`,
              zIndex: zIndex.get(`sticker:${i}`),
              rotate: `${pos.rotate ?? 0}deg`,
            }}
            onPointerDown={onStickerDown(s.id)}
          >
            <img src={sticker.src} alt={sticker.label} draggable={false} />
          </span>
        );
      })}
      {texts.map((t, i) => {
        const pos = live?.id === t.id ? live : t;
        const typing = draft?.id === t.id;
        const picked = tool === 'text' && textFocus?.id === t.id;
        return (
          <div
            key={t.id}
            className={`decor__text ${picked ? 'is-selected' : ''} ${typing ? 'is-typing' : ''} ${live?.id === t.id ? `is-lifted ${overTrash ? 'is-doomed' : ''}` : ''}`}
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              fontSize: `${pos.size * 100}cqw`,
              zIndex: zIndex.get(`text:${i}`),
              rotate: `${pos.rotate ?? 0}deg`,
              ...textCss(t),
            }}
            onPointerDown={onTextDown(t.id)}
          >
            {typing ? (
              // A hidden copy of the text sizes the box; the field lies over it.
              <span className="decor__text-field">
                <span className="decor__text-sizer" aria-hidden>
                  {`${t.text}\u200b`}
                </span>
                <textarea
                  className="decor__text-input"
                  aria-label="텍스트"
                  value={t.text}
                  maxLength={TEXT_MAX_LENGTH}
                  autoFocus
                  wrap="off"
                  spellCheck={false}
                  onChange={(e) => setDraft({ ...t, text: e.target.value })}
                  onBlur={finishTyping}
                  onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
                />
              </span>
            ) : (
              t.text
            )}
          </div>
        );
      })}
      {(tool === 'sticker' || tool === 'text') && live && (
        // Drag a sticker or text box here to throw it away.
        <span ref={trashEl} style={{ zIndex: pieces.length + 2 }} className={`decor__trash ${overTrash ? 'is-over' : ''}`} aria-hidden>
          <Trash2 size={22} />
        </span>
      )}
    </div>
  );
}

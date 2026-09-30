import { X } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import {
  clamp01,
  extendStroke,
  PEN_WIDTHS,
  STICKER_SIZE,
  type DayDecor,
  type DecorTool,
  type PenColor,
  type PenWidth,
  type Stroke,
} from '../domain/decor';

interface DecorLayerProps {
  decor: DayDecor;
  /** Which tool is out; stickers and strokes only take touches with theirs. */
  tool: DecorTool | null;
  /** Sticker picked in the tray, placed where the box is tapped. */
  armed: string | null;
  pen: { color: PenColor; width: PenWidth };
  onChange: (decor: DayDecor) => void;
}

const strokePath = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' ') +
  // A single tap still leaves a dot.
  (points.length === 1 ? ` l0.01 0` : '');

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
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragged, setDragged] = useState<{ id: string; x: number; y: number } | null>(null);

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
    setDrawing({ ...pen, points: extendStroke([], x, y) });
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

  const onBoxDown = (e: PointerEvent) => {
    if (e.target !== e.currentTarget) return; // a sticker handles its own press
    setSelected(null);
    if (!armed) return;
    const [x, y] = at(e);
    const sticker = { id: newId(), emoji: armed, x: clamp01(x), y: clamp01(y), size: STICKER_SIZE };
    onChange({ ...decor, stickers: [...decor.stickers, sticker] });
    setSelected(sticker.id);
  };

  const onStickerDown = (id: string) => (e: PointerEvent) => {
    if (tool !== 'sticker' || !e.isPrimary) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = decor.stickers.find((st) => st.id === id)!;
    const [x, y] = at(e);
    drag.current = { id, dx: s.x - x, dy: s.y - y };
    setSelected(id);
  };
  const onStickerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [x, y] = at(e);
    setDragged({ id: d.id, x: clamp01(x + d.dx), y: clamp01(y + d.dy) });
  };
  const onStickerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !dragged) return;
    onChange({ ...decor, stickers: decor.stickers.map((s) => (s.id === d.id ? { ...s, x: dragged.x, y: dragged.y } : s)) });
    setDragged(null);
  };

  const strokes = drawing ? [...decor.strokes, drawing] : decor.strokes;
  const active = tool === 'sticker' || tool === 'pen';

  return (
    <div
      ref={layer}
      className={`decor ${active ? `decor--${tool}` : ''} ${tool === 'sticker' && armed ? 'is-armed' : ''}`}
      onPointerDown={tool === 'pen' ? onPenDown : tool === 'sticker' ? onBoxDown : undefined}
      onPointerMove={tool === 'pen' ? onPenMove : undefined}
      onPointerUp={tool === 'pen' ? onPenUp : undefined}
      onPointerCancel={tool === 'pen' ? onPenUp : undefined}
      aria-hidden={!active}
    >
      {strokes.length > 0 && (
        <svg className="decor__ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {strokes.map((s, i) => (
            <path
              key={i}
              d={strokePath(s.points)}
              style={{ stroke: `var(--${s.color})`, strokeWidth: PEN_WIDTHS[s.width] * 100 }}
            />
          ))}
        </svg>
      )}
      {decor.stickers.map((s) => {
        const pos = dragged?.id === s.id ? dragged : s;
        const isSelected = tool === 'sticker' && selected === s.id;
        return (
          <span
            key={s.id}
            className={`decor__sticker ${isSelected ? 'is-selected' : ''}`}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, fontSize: `${s.size * 78}cqw` }}
            onPointerDown={onStickerDown(s.id)}
            onPointerMove={onStickerMove}
            onPointerUp={onStickerUp}
            onPointerCancel={onStickerUp}
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

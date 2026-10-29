import { PenLine, Sticker, Type } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  canUndo,
  cleanTextStyle,
  EMPTY_HISTORY,
  recordChange,
  redoDecor,
  undoDecor,
  type DayDecor,
  type DecorHistory,
  type PenSettings,
  type TextStyle,
} from '../domain/decor';
import type { StickerDrop } from '../domain/stickerSheets';
import { usePhotoDecor } from '../hooks/usePhotoDecor';
import DecorLayer, { type TextFocus } from './DecorLayer';
import { DecorTray } from './DecorTools';

type DoodleTool = 'pen' | 'sticker' | 'text';
const DOODLE_TOOLS: { tool: DoodleTool; label: string; Icon: typeof PenLine }[] = [
  { tool: 'pen', label: '펜', Icon: PenLine },
  { tool: 'sticker', label: '스티커', Icon: Sticker },
  { tool: 'text', label: '텍스트', Icon: Type },
];
/** A doodler's stickers wear a die-cut edge in their colour (white when it's not known). */
const edgeOf = (ink: string | null | undefined): CSSProperties | undefined =>
  ink ? ({ '--sticker-edge': `var(--${ink})` } as CSSProperties) : undefined;

/** How long the sheet takes to go down when switching tools (matches `tray-down` in styles.css). */
const TRAY_SWAP_MS = 170;

export interface PhotoDoodle {
  /** A tool is out: the photo doesn't page under the finger, and Esc puts the tool away first. */
  active: boolean;
  putAway(): void;
  /** 펜 · 스티커 · 텍스트, over the photo's top right (null when it can't be doodled on). */
  tools: ReactNode;
  /** Every member's doodles, over the photo (inside its box). */
  layers: ReactNode;
  /** The tool's sheet along the bottom, as on TODAY (on the body, over the veil). */
  tray: ReactNode;
}

/**
 * A group photo's doodles, for the big photo: every member's layer shown,
 * mine edited with the same tools and bottom sheets as TODAY's 꾸미기 —
 * 펜 (its kinds, widths, undo / redo / clear), 스티커 (the packs) and 텍스트
 * (fonts, effects, alignment) — except that the one ink is `color`, my
 * colour in the group. No `color`: shown only (the gallery). A touch off
 * the photo and the tools puts the tool away.
 */
export function usePhotoDoodle(path: string | null, color: string | null): PhotoDoodle {
  const decor = usePhotoDecor(path, color);
  const editable = !!path && !!color;
  const ink = color ?? 'ink-black';
  const [tool, setTool] = useState<DoodleTool | null>(null);
  const [pen, setPenState] = useState<PenSettings>({ tool: 'pen', color: ink, width: 'medium' });
  const setPen = (next: PenSettings) => setPenState({ ...next, color: ink });
  const [textStyle, setTextStyle] = useState<TextStyle>({ font: 'sans', color: ink, align: 'center' });
  const [textFocus, setTextFocus] = useState<TextFocus>(null);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<DecorHistory>(EMPTY_HISTORY);
  const placeSticker = useRef<((drop: StickerDrop) => void) | null>(null);

  // Another photo (or my colour changed): the tools are put away, the ink is mine.
  useEffect(() => {
    setTool(null);
    setTextFocus(null);
    setHistory(EMPTY_HISTORY);
    setPenState((p) => ({ ...p, color: ink }));
    setTextStyle((t) => ({ ...t, color: ink }));
  }, [path, ink]);

  const mine = decor.mine;
  const changeDecor = (next: DayDecor) => {
    setHistory((h) => recordChange(h, mine));
    decor.setMine(next);
  };
  const step = (result: { history: DecorHistory; decor: DayDecor } | null) => {
    if (!result) return;
    setHistory(result.history);
    decor.setMine(result.decor);
  };

  // As on TODAY: the text sheet is for a written box that's been picked.
  const pickedText = textFocus && !textFocus.editing ? (mine.texts ?? []).find((t) => t.id === textFocus.id) : undefined;
  const sheetTool = tool === 'text' && !pickedText ? null : tool;
  const sheetTextStyle: TextStyle = pickedText ?? textStyle;
  const changeTextStyle = (patch: Partial<TextStyle>) => {
    const next = cleanTextStyle({ ...sheetTextStyle, ...patch, color: ink });
    setTextStyle(next);
    if (!pickedText) return;
    const texts = (mine.texts ?? []).map((t) => {
      if (t.id !== pickedText.id) return t;
      const { bold: _b, italic: _i, underline: _u, strike: _s, ...rest } = t;
      return { ...rest, ...next };
    });
    changeDecor({ ...mine, texts });
  };

  // The sheet trails the tool: switching sends the open one down first.
  const [trayTool, setTrayTool] = useState<DoodleTool | null>(null);
  const [trayLeaving, setTrayLeaving] = useState(false);
  const pulledAway = useRef(false);
  useEffect(() => {
    if (!trayTool) {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
      return;
    }
    if (sheetTool === trayTool) return setTrayLeaving(false);
    if (!sheetTool && pulledAway.current) {
      pulledAway.current = false;
      setTrayTool(null);
      setTrayLeaving(false);
      return;
    }
    setTrayLeaving(true);
    const swap = window.setTimeout(() => {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
    }, TRAY_SWAP_MS);
    return () => window.clearTimeout(swap);
  }, [sheetTool]);

  // A touch anywhere but the photo, the tools or the sheet puts the tool
  // away — and only that: its click doesn't also close the photo.
  useEffect(() => {
    if (!tool) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.photo-doodle, .photo-doodle__tools, .decor-tray, .color-picker')) return;
      setTool(null);
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 500);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [tool]);

  const tools = editable ? (
    <div className="photo-doodle__tools" role="toolbar" aria-label="사진 꾸미기">
      {DOODLE_TOOLS.map(({ tool: t, label, Icon }) => (
        <button
          key={t}
          className={`photo-doodle__tool ${tool === t ? 'is-on' : ''}`}
          style={{ '--doodle': `var(--${ink})` } as CSSProperties}
          aria-label={label}
          aria-pressed={tool === t}
          onClick={() => {
            setTextFocus(null);
            setTool(tool === t ? null : t);
          }}
        >
          <Icon size={20} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  ) : null;

  const layers = path ? (
    // Everyone else's doodles under mine; only mine take the tools.
    <div className={`photo-doodle ${tool ? 'is-drawing' : ''}`}>
      {decor.others?.map((layer) => (
        <div key={layer.userId} className="photo-doodle__layer" style={edgeOf(layer.ink)}>
          <DecorLayer decor={layer.decor} tool={null} pen={pen} onChange={() => {}} />
        </div>
      ))}
      <div className="photo-doodle__layer" style={edgeOf(color ?? decor.mineInk)}>
        <DecorLayer
          decor={mine}
          tool={editable ? tool : null}
          placeRef={placeSticker}
          pen={pen}
          onChange={changeDecor}
          textFocus={textFocus}
          onTextFocus={setTextFocus}
          textStyle={textStyle}
          onDragging={setDragging}
        />
      </div>
    </div>
  ) : null;

  const tray =
    editable && trayTool
      ? createPortal(
          // The packs' stickers peel off with my edge too.
          <div className="photo-doodle__tray" style={edgeOf(ink)}>
            <DecorTray
              key={trayTool}
              leaving={trayLeaving}
              away={dragging}
              tool={trayTool}
              onPlace={(drop) => placeSticker.current?.(drop)}
              pen={pen}
              onPen={setPen}
              canUndo={canUndo(history, mine)}
              onUndo={() => step(undoDecor(history, mine))}
              canRedo={history.future.length > 0}
              onRedo={() => step(redoDecor(history, mine))}
              canClear={mine.strokes.length > 0}
              onClear={() => changeDecor({ ...mine, strokes: [] })}
              theme="default"
              onTheme={() => {}}
              pattern="none"
              onPattern={() => {}}
              textStyle={sheetTextStyle}
              onTextStyle={changeTextStyle}
              onlyInk={ink}
              onClose={() => {
                pulledAway.current = true;
                setTool(null);
              }}
            />
          </div>,
          document.body,
        )
      : null;

  return { active: tool !== null, putAway: () => setTool(null), tools, layers, tray };
}

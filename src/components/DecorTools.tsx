import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Brush,
  BrushCleaning,
  ChevronDown,
  ChevronUp,
  Clock,
  Eraser,
  GalleryVerticalEnd,
  Highlighter,
  Italic,
  Palette,
  PenLine,
  Pencil,
  Redo2,
  Share,
  Sparkles,
  Sticker,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  Wallpaper,
} from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import ColorPicker from './ColorPicker';
import {
  BASE_COLORS,
  inkCss,
  isCustomColor,
  PEN_TOOLS,
  PEN_WIDTHS,
  STICKERS,
  PATTERNS,
  TEXT_ALIGNS,
  TEXT_EFFECTS,
  TEXT_FONTS,
  textFamily,
  textWeight,
  THEMES,
  type DecorTool,
  type TextAlign,
  type TextStyle,
  type PenSettings,
  type PenTool,
  type PatternId,
  type PenWidth,
  type ThemeId,
} from '../domain/decor';
import { POLAROID_LAYOUTS, type PolaroidLayout } from '../domain/polaroid';
import { PIN_BOX, PIN_PATH } from '../lib/pingPaths';
import DayPattern from './DayPattern';

const RAIL: { tool: DecorTool; label: string; Icon: typeof Sticker }[] = [
  { tool: 'sticker', label: '스티커', Icon: Sticker },
  { tool: 'pen', label: '펜', Icon: PenLine },
  { tool: 'text', label: '텍스트', Icon: Type },
  { tool: 'theme', label: '테마', Icon: Palette },
  { tool: 'pattern', label: '꾸미기', Icon: Wallpaper },
];
/** 장소 이름 switch: a pin with a line of text above its head. */
function PinName() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h10" />
      <path d="M18 14c0 4-6 8-6 8s-6-4-6-8a6 6 0 0 1 12 0Z" />
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}

/** The day screen's order: 텍스트 first. */
const DAY_RAIL: typeof RAIL = ['text', 'sticker', 'pen', 'theme', 'pattern'].map((t) => RAIL.find((r) => r.tool === t)!);
/** The share screen's own: how the polaroid lies on the image. */
const POLAROID_TOOL = { tool: 'polaroid' as const, label: '폴라로이드', Icon: GalleryVerticalEnd };

/** 스티커 · 펜 · 텍스트 · 테마 · 꾸미기 (on a day 텍스트 first, then ↓ unfolding the name and time switches, ↑ folding them), then 공유 a little apart where given. */
export function DecorRail({
  tool,
  onTool,
  onShare,
  row = false,
  labels,
}: {
  tool: DecorTool | null;
  onTool: (tool: DecorTool | null) => void;
  /** A 공유 button under the tools, set apart (left out when the screen shares another way). */
  onShare?: () => void;
  /** Laid out in a row (the 꾸미기 screen's top edge) rather than a column. */
  row?: boolean;
  /** The day screen's switches under the tools: the pings' place names and visit times. */
  labels?: { names: boolean; times: boolean; onNames: () => void; onTimes: () => void };
}) {
  // A day's rail folds its name / time switches away behind ↓ until asked for.
  const [open, setOpen] = useState(false);
  const tools = labels ? DAY_RAIL : row ? [...RAIL, POLAROID_TOOL] : RAIL;
  return (
    <div className={`decor-rail ${row ? 'decor-rail--row' : ''}`} role="toolbar" aria-label="꾸미기" aria-orientation={row ? 'horizontal' : 'vertical'}>
      {tools.map(({ tool: t, label, Icon }) => (
        <button
          key={t}
          className={`decor-rail__btn ${tool === t ? 'is-on' : ''}`}
          aria-label={label}
          aria-pressed={tool === t}
          onClick={() => onTool(tool === t ? null : t)}
        >
          <Icon size={20} aria-hidden />
        </button>
      ))}
      {labels && open && (
        <>
          <button
            className={`decor-rail__btn decor-rail__switch ${labels.names ? '' : 'is-off'}`}
            aria-label="장소 이름 보이기"
            aria-pressed={labels.names}
            onClick={labels.onNames}
          >
            <PinName />
          </button>
          <button
            className={`decor-rail__btn decor-rail__switch ${labels.times ? '' : 'is-off'}`}
            aria-label="방문 시간 보이기"
            aria-pressed={labels.times}
            onClick={labels.onTimes}
          >
            <Clock size={20} aria-hidden />
          </button>
        </>
      )}
      {labels && (
        <button
          className="decor-rail__btn decor-rail__more"
          aria-label={open ? '접기' : '펼치기'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
        </button>
      )}
      {onShare && (
        <button className="decor-rail__btn decor-rail__share" aria-label="공유" onClick={onShare}>
          <Share size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}

interface DecorTrayProps {
  tool: DecorTool;
  /** Going down before the next tool's sheet comes up. */
  leaving?: boolean;
  /** Out of the way below the screen for now (a piece is being dragged). */
  away?: boolean;
  armed: string | null;
  onArm: (stickerId: string | null) => void;
  pen: PenSettings;
  onPen: (pen: PenSettings) => void;
  /** Takes back the day's last stroke (eraser passes included). */
  canUndo: boolean;
  onUndo: () => void;
  /** Brings back what undo took, until something new is drawn. */
  canRedo: boolean;
  onRedo: () => void;
  /** 전체 지우개: clears the day's pen strokes, keeping stickers (undo brings them back). */
  canClear: boolean;
  onClear: () => void;
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  /** The day's background pattern: one at a time, like the theme. */
  pattern: PatternId;
  onPattern: (pattern: PatternId) => void;
  /** The picked text box's looks; changes apply to it (and to the next new box). */
  textStyle: TextStyle;
  onTextStyle: (patch: Partial<TextStyle>) => void;
  /** Share cards: the polaroid's layout, and a small picture of the card in each (while they're drawn, none). */
  layout?: PolaroidLayout;
  onLayout?: (layout: PolaroidLayout) => void;
  layoutPreviews?: Partial<Record<PolaroidLayout, string>>;
  /** Dragged all the way down by its top edge: put the tool away. */
  onClose?: () => void;
}

/** The sheets of cards (stickers, themes, patterns, layouts) can be pulled up to nearly full screen, or down shut. */
const PULLABLE: DecorTool[] = ['sticker', 'theme', 'pattern', 'polaroid'];
/** How far a pull has to go before it counts (px). */
const PULL_STEP = 40;
/** Less movement than this is a tap on the top edge, not a pull (px). */
const TAP_SLOP = 6;
/** Matches the sheet's slide down in styles.css (`is-closing`). */
const CLOSE_MS = 200;
/** Matches the sheet's height easing in styles.css. */
const SETTLE_MS = 260;

/**
 * Dragging a card sheet by its top edge. It starts at its usual height; up
 * past a step it opens to nearly the whole screen, down to under ~60% of
 * its usual height it closes. From full height, letting go anywhere above
 * that goes back to the usual height (or stays full if barely moved).
 * A plain tap on the top edge flips between the usual and full height.
 */
function useSheetPull(onClose?: () => void) {
  const sheet = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; from: number; normal: number; moved: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const normalHeight = useRef(0);
  const settle = useRef(0);

  // Nearly the whole screen: a strip stays clear at the top (matches `is-expanded`).
  const fullHeight = () => window.innerHeight - 56;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = sheet.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(settle.current);
    delete el.dataset.settling;
    const from = el.offsetHeight;
    if (!expanded) normalHeight.current = from;
    drag.current = { y: e.clientY, from, normal: normalHeight.current || from, moved: 0 };
    // Pin the height it has now before lifting the max-height, or the sheet
    // would jump to its full content height at the first touch.
    el.style.height = `${from}px`;
    el.dataset.pulling = '';
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = sheet.current;
    if (!d || !el) return;
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.y));
    const h = Math.max(0, Math.min(fullHeight(), d.from - (e.clientY - d.y)));
    el.style.height = `${h}px`;
  };
  const onPointerEnd = () => {
    const d = drag.current;
    const el = sheet.current;
    drag.current = null;
    if (!d || !el) return;
    const h = el.offsetHeight;
    // A tap on the top edge (no real drag): flip between usual and full height.
    const tapped = d.moved < TAP_SLOP;
    if (!tapped && h < d.normal * 0.6) {
      delete el.dataset.pulling;
      setClosing(true);
      window.setTimeout(() => onClose?.(), CLOSE_MS);
      return;
    }
    const toFull = tapped ? !expanded : expanded ? h > fullHeight() - PULL_STEP : h > d.normal + PULL_STEP;
    // Glide from where the finger left it to the new height (a px height can
    // ease; the usual one is content-sized and can't), then hand back to CSS.
    // Data attributes, not classes: React rewrites className on the re-render.
    delete el.dataset.pulling;
    el.dataset.settling = '';
    void el.offsetHeight;
    el.style.height = `${toFull ? fullHeight() : d.normal}px`;
    setExpanded(toFull);
    settle.current = window.setTimeout(() => {
      delete el.dataset.settling;
      el.style.height = '';
    }, SETTLE_MS);
  };
  /** Back to the usual height (gliding, as a release does); no-op if it's there already. */
  const collapse = () => {
    const el = sheet.current;
    if (!expanded || !el) return;
    window.clearTimeout(settle.current);
    el.style.height = `${el.offsetHeight}px`;
    el.dataset.settling = '';
    void el.offsetHeight;
    el.style.height = `${normalHeight.current || el.offsetHeight}px`;
    setExpanded(false);
    settle.current = window.setTimeout(() => {
      delete el.dataset.settling;
      el.style.height = '';
    }, SETTLE_MS);
  };
  const handle = { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
  return { sheet, expanded, closing, handle, collapse };
}

const EFFECT_ICONS = { bold: Bold, italic: Italic, underline: Underline, strike: Strikethrough };
const ALIGN_ICONS: Record<TextAlign, typeof Bold> = { left: AlignLeft, center: AlignCenter, right: AlignRight };

const PEN_ICONS: Record<PenTool, typeof PenLine> = {
  pen: Pencil,
  crayon: Brush,
  highlighter: Highlighter,
  neon: Sparkles,
  eraser: Eraser,
};

// Previews shrink some patterns to fit a small card: the grid reads as zoomed
// in at full size, and the scattered ones would show only a mark or two.
const PREVIEW_SCALE: Partial<Record<PatternId, number>> = {
  grid: 0.7, check: 0.7, checker: 0.7, hearts: 0.55, stars: 0.55, snow: 0.55, drops: 0.55, night: 0.55, clouds: 0.55, flowers: 0.55,
};

const WIDTH_LABELS: Record<PenWidth, string> = { thin: '가늘게', medium: '보통', thick: '굵게' };

/**
 * The tool's panel, rising from the bottom in the tab buttons' place: a
 * dark see-through sheet across the screen, at most a quarter of it tall.
 * Stickers scroll up and down, themes sideways as cards; the pen fits
 * without scrolling (tools and width on top, colours below). It closes
 * from the same rail button that opened it.
 */
export function DecorTray(p: DecorTrayProps) {
  const [picking, setPicking] = useState(false);
  const pullable = PULLABLE.includes(p.tool);
  const pull = useSheetPull(p.onClose);
  const label = [...RAIL, POLAROID_TOOL].find((r) => r.tool === p.tool)?.label;
  // Picking a colour means drawing with it: the eraser hands over to the pen.
  // With the text tool the colours are the picked box's.
  const isText = p.tool === 'text';
  const inkColor = isText ? p.textStyle.color : p.pen.color;
  const custom = isCustomColor(inkColor) ? inkColor : null;
  const setColor = (color: string) =>
    isText ? p.onTextStyle({ color }) : p.onPen({ ...p.pen, color, tool: p.pen.tool === 'eraser' ? 'pen' : p.pen.tool });
  const colorButtons = (
    <>
      {BASE_COLORS.map(({ color, label: name }) => (
        <button
          key={color}
          className={`decor-tray__color ${inkColor === color ? 'is-on' : ''}`}
          style={{ color: inkCss(color) }}
          aria-label={name}
          aria-pressed={inkColor === color}
          onClick={() => setColor(color)}
        >
          <span aria-hidden />
        </button>
      ))}
      {custom && (
        <button className="decor-tray__color is-on" style={{ color: custom }} aria-label="팔레트에서 고른 색" aria-pressed>
          <span aria-hidden />
        </button>
      )}
      <button
        className={`decor-tray__palette ${picking ? 'is-on' : ''}`}
        data-palette-toggle
        aria-label="팔레트에서 색 고르기"
        aria-expanded={picking}
        onClick={() => setPicking(!picking)}
      >
        <span aria-hidden />
      </button>
    </>
  );
  const picker = picking && <ColorPicker color={custom ?? '#ff4d6d'} onPick={setColor} onClose={() => setPicking(false)} />;

  return (
    <div
      ref={pull.sheet}
      className={`decor-tray decor-tray--${p.tool} ${p.leaving ? 'is-leaving' : ''} ${p.away ? 'is-away' : ''} ${pull.expanded ? 'is-expanded' : ''} ${pull.closing ? 'is-closing' : ''}`}
      role="toolbar"
      aria-label={label}
    >
      {pullable ? (
        // The top edge: drag up for nearly the whole screen, down to close.
        <div className="decor-tray__handle" {...pull.handle} aria-hidden>
          <div className="decor-tray__grip" />
        </div>
      ) : (
        <div className="decor-tray__grip" aria-hidden />
      )}

      {p.tool === 'sticker' && (
        <div className="decor-tray__stickers">
          {STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              className={`decor-tray__sticker ${p.armed === sticker.id ? 'is-on' : ''}`}
              aria-label={`스티커 ${sticker.label}`}
              aria-pressed={p.armed === sticker.id}
              onClick={(e) => {
                const picking = p.armed !== sticker.id;
                p.onArm(picking ? sticker.id : null);
                if (!picking) return;
                // Picked: the sheet goes back to its usual height and the
                // sticker's row scrolls to the top of the grid, once the height has settled.
                const btn = e.currentTarget;
                const wasExpanded = pull.expanded;
                pull.collapse();
                window.setTimeout(() => {
                  const grid = btn.parentElement;
                  if (!grid) return;
                  const top = grid.scrollTop + btn.getBoundingClientRect().top - grid.getBoundingClientRect().top;
                  grid.scrollTo({ top, behavior: 'smooth' });
                }, wasExpanded ? SETTLE_MS : 0);
              }}
            >
              <img src={sticker.src} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {p.tool === 'pen' && (
        <div className="decor-tray__pen">
          <div className="decor-tray__row">
            {PEN_TOOLS.map(({ tool, label: name }) => {
              const Icon = PEN_ICONS[tool];
              return (
                <button
                  key={tool}
                  className={`decor-tray__tool ${p.pen.tool === tool ? 'is-on' : ''}`}
                  aria-label={name}
                  aria-pressed={p.pen.tool === tool}
                  onClick={() => p.onPen({ ...p.pen, tool })}
                >
                  <Icon size={22} aria-hidden />
                </button>
              );
            })}
            <span className="decor-tray__sep" aria-hidden />
            {(Object.keys(PEN_WIDTHS) as PenWidth[]).map((width) => (
              <button
                key={width}
                className={`decor-tray__width ${p.pen.width === width ? 'is-on' : ''}`}
                aria-label={`굵기 ${WIDTH_LABELS[width]}`}
                aria-pressed={p.pen.width === width}
                onClick={() => p.onPen({ ...p.pen, width })}
              >
                <span style={{ width: `${PEN_WIDTHS[width] * 520}px`, height: `${PEN_WIDTHS[width] * 520}px` }} aria-hidden />
              </button>
            ))}
          </div>
          <div className="decor-tray__row">
            {colorButtons}
            <button className="decor-tray__undo" aria-label="되돌리기" disabled={!p.canUndo} onClick={p.onUndo}>
              <Undo2 size={22} aria-hidden />
            </button>
            <button className="decor-tray__undo" aria-label="다시 실행" disabled={!p.canRedo} onClick={p.onRedo}>
              <Redo2 size={22} aria-hidden />
            </button>
            <button className="decor-tray__undo" aria-label="전체 지우기" disabled={!p.canClear} onClick={p.onClear}>
              <BrushCleaning size={22} aria-hidden />
            </button>
          </div>
          {picker}
        </div>
      )}

      {/* Text: fonts; effects and alignment; colours — one row each, centred. */}
      {isText && (
        <div className="decor-tray__pen decor-tray__text">
          <div className="decor-tray__row">
            {TEXT_FONTS.map(({ font, label: name, sample }) => (
              <button
                key={font}
                className={`decor-tray__font ${p.textStyle.font === font ? 'is-on' : ''}`}
                style={{ fontFamily: textFamily(font), fontWeight: textWeight({ font }) }}
                aria-label={`글꼴 ${name}`}
                aria-pressed={p.textStyle.font === font}
                onClick={() => p.onTextStyle({ font })}
              >
                {sample}
              </button>
            ))}
          </div>
          <div className="decor-tray__row">
            {TEXT_EFFECTS.map(({ effect, label: name }) => {
              const Icon = EFFECT_ICONS[effect];
              const on = !!p.textStyle[effect];
              return (
                <button
                  key={effect}
                  className={`decor-tray__tool ${on ? 'is-on' : ''}`}
                  aria-label={name}
                  aria-pressed={on}
                  onClick={() => p.onTextStyle({ [effect]: !on })}
                >
                  <Icon size={20} aria-hidden />
                </button>
              );
            })}
            <span className="decor-tray__sep" aria-hidden />
            {TEXT_ALIGNS.map(({ align, label: name }) => {
              const Icon = ALIGN_ICONS[align];
              return (
                <button
                  key={align}
                  className={`decor-tray__tool ${p.textStyle.align === align ? 'is-on' : ''}`}
                  aria-label={name}
                  aria-pressed={p.textStyle.align === align}
                  onClick={() => p.onTextStyle({ align })}
                >
                  <Icon size={20} aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="decor-tray__row">{colorButtons}</div>
          {picker}
        </div>
      )}

      {p.tool === 'theme' && (
        <div className="decor-tray__themes">
          {THEMES.map(({ id, label: name }) => (
            <button
              key={id}
              className={`decor-tray__theme theme-card--${id} ${p.theme === id ? 'is-on' : ''}`}
              aria-pressed={p.theme === id}
              aria-label={name}
              onClick={() => p.onTheme(id)}
            >
              <span className="theme-card" aria-hidden>
                <svg className="theme-card__pin" viewBox={`${PIN_BOX.x} ${PIN_BOX.y} ${PIN_BOX.w} ${PIN_BOX.h}`}>
                  <path d={PIN_PATH} />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <i />
              </span>
            </button>
          ))}
        </div>
      )}

      {p.tool === 'polaroid' && (
        <div className="decor-tray__themes">
          {POLAROID_LAYOUTS.map(({ id, label: name }) => (
            <button
              key={id}
              className={`decor-tray__theme ${p.layout === id ? 'is-on' : ''}`}
              aria-pressed={p.layout === id}
              aria-label={name}
              onClick={() => p.onLayout?.(id)}
            >
              <span className="theme-card layout-card" aria-hidden>
                {p.layoutPreviews?.[id] && <img src={p.layoutPreviews[id]} alt="" draggable={false} />}
              </span>
            </button>
          ))}
        </div>
      )}

      {p.tool === 'pattern' && (
        <div className="decor-tray__themes">
          {PATTERNS.map(({ id, label: name }) => (
            <button
              key={id}
              className={`decor-tray__theme ${p.pattern === id ? 'is-on' : ''}`}
              aria-pressed={p.pattern === id}
              aria-label={name}
              onClick={() => p.onPattern(id)}
            >
              <span className="theme-card pattern-card" aria-hidden>
                <DayPattern pattern={id} className="day-pattern--preview" scale={PREVIEW_SCALE[id] ?? 1} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

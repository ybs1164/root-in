import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BrushCleaning,
  Eraser,
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
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  BASE_COLORS,
  hexToHsv,
  hsvToHex,
  inkCss,
  isCustomColor,
  normalizeHex,
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
import { PIN_BOX, PIN_PATH } from '../lib/pingPaths';
import DayPattern from './DayPattern';

const RAIL: { tool: DecorTool; label: string; Icon: typeof Sticker }[] = [
  { tool: 'sticker', label: '스티커', Icon: Sticker },
  { tool: 'pen', label: '펜', Icon: PenLine },
  { tool: 'text', label: '텍스트', Icon: Type },
  { tool: 'theme', label: '테마', Icon: Palette },
  { tool: 'pattern', label: '꾸미기', Icon: Wallpaper },
];

/** 스티커 · 펜 · 텍스트 · 테마 · 꾸미기, stacked under the settings button, then 공유 a little apart in the accent colour. */
export function DecorRail({
  tool,
  onTool,
  onShare,
  row = false,
}: {
  tool: DecorTool | null;
  onTool: (tool: DecorTool | null) => void;
  /** A 공유 button under the tools, set apart (left out when the screen shares another way). */
  onShare?: () => void;
  /** Laid out in a row (the 꾸미기 screen's top edge) rather than a column. */
  row?: boolean;
}) {
  return (
    <div className={`decor-rail ${row ? 'decor-rail--row' : ''}`} role="toolbar" aria-label="꾸미기" aria-orientation={row ? 'horizontal' : 'vertical'}>
      {RAIL.map(({ tool: t, label, Icon }) => (
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
  onArm: (emoji: string | null) => void;
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
}

const EFFECT_ICONS = { bold: Bold, italic: Italic, underline: Underline, strike: Strikethrough };
const ALIGN_ICONS: Record<TextAlign, typeof Bold> = { left: AlignLeft, center: AlignCenter, right: AlignRight };

const PEN_ICONS: Record<PenTool, typeof PenLine> = {
  pen: Pencil,
  highlighter: Highlighter,
  neon: Sparkles,
  eraser: Eraser,
};

// Previews shrink some patterns to fit a small card: the grid reads as zoomed
// in at full size, and the scattered ones would show only a mark or two.
const PREVIEW_SCALE: Partial<Record<PatternId, number>> = { grid: 0.7, hearts: 0.55, stars: 0.55, snow: 0.55 };

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
  const label = RAIL.find((r) => r.tool === p.tool)?.label;
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
    <div className={`decor-tray decor-tray--${p.tool} ${p.leaving ? 'is-leaving' : ''} ${p.away ? 'is-away' : ''}`} role="toolbar" aria-label={label}>
      <div className="decor-tray__grip" aria-hidden />

      {p.tool === 'sticker' && (
        <div className="decor-tray__stickers">
          {STICKERS.map((emoji) => (
            <button
              key={emoji}
              className={`decor-tray__sticker ${p.armed === emoji ? 'is-on' : ''}`}
              aria-label={`스티커 ${emoji}`}
              aria-pressed={p.armed === emoji}
              onClick={() => p.onArm(p.armed === emoji ? null : emoji)}
            >
              {emoji}
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
              onClick={() => p.onTheme(id)}
            >
              <span className="theme-card" aria-hidden>
                <svg className="theme-card__pin" viewBox={`${PIN_BOX.x} ${PIN_BOX.y} ${PIN_BOX.w} ${PIN_BOX.h}`}>
                  <path d={PIN_PATH} />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <i />
              </span>
              {name}
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
              onClick={() => p.onPattern(id)}
            >
              <span className="theme-card pattern-card" aria-hidden>
                <DayPattern pattern={id} className="day-pattern--preview" scale={PREVIEW_SCALE[id] ?? 1} />
              </span>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The palette: a round wheel of every hue (saturation grows from the white
 * centre to the rim), a brightness slider, and a box for a colour code.
 * Every change is the ink straight away. Taps outside close it.
 */
function ColorPicker({ color, onPick, onClose }: { color: string; onPick: (hex: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  // HSV is kept here rather than derived from the hex, so turning the
  // brightness all the way down and back up doesn't lose the hue.
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [code, setCode] = useState(color);
  const wheel = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const away = (e: globalThis.PointerEvent) => {
      const t = e.target as Element | null;
      if (box.current?.contains(t) || t?.closest('.decor-tray__palette')) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const apply = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setCode(hex);
    onPick(hex);
  };

  const pickAt = (e: PointerEvent) => {
    const r = wheel.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // Hue runs clockwise from the top, as the conic gradient draws it.
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    // Picking on a black wheel would show nothing: bring the light back.
    apply({ h, s, v: hsv.v < 0.15 ? 1 : hsv.v });
  };

  const rad = (hsv.h * Math.PI) / 180;
  const marker = { left: `${50 + Math.sin(rad) * hsv.s * 50}%`, top: `${50 - Math.cos(rad) * hsv.s * 50}%` };
  const current = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div ref={box} className="color-picker" role="dialog" aria-label="팔레트">
      <div
        ref={wheel}
        className="color-picker__wheel"
        role="slider"
        aria-label="색상"
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          pickAt(e);
        }}
        onPointerMove={(e) => dragging.current && pickAt(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <span className="color-picker__shade" style={{ opacity: 1 - hsv.v }} aria-hidden />
        <span className="color-picker__marker" style={{ ...marker, background: current }} aria-hidden />
      </div>
      <div className="color-picker__side">
        <input
          className="color-picker__value"
          type="range"
          min={0}
          max={100}
          aria-label="밝기"
          value={Math.round(hsv.v * 100)}
          style={{ '--picker-top': hsvToHex(hsv.h, hsv.s, 1) } as CSSProperties}
          onChange={(e) => apply({ ...hsv, v: Number(e.target.value) / 100 })}
        />
        <label className="color-picker__code">
          <span className="color-picker__chip" style={{ background: current }} aria-hidden />
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            aria-label="색상 코드"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex) {
                setHsv(hexToHsv(hex));
                onPick(hex);
              }
            }}
            onBlur={() => setCode(current)}
          />
        </label>
      </div>
    </div>
  );
}

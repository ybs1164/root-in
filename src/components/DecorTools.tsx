import { Eraser, Highlighter, Palette, PenLine, Pencil, Sparkles, Sticker } from 'lucide-react';
import { useRef } from 'react';
import {
  BASE_COLORS,
  inkCss,
  isCustomColor,
  PEN_TOOLS,
  PEN_WIDTHS,
  STICKERS,
  THEMES,
  type DecorTool,
  type PenSettings,
  type PenTool,
  type PenWidth,
  type ThemeId,
} from '../domain/decor';

const RAIL: { tool: DecorTool; label: string; Icon: typeof Sticker }[] = [
  { tool: 'sticker', label: '스티커', Icon: Sticker },
  { tool: 'pen', label: '펜', Icon: PenLine },
  { tool: 'theme', label: '테마', Icon: Palette },
];

/** 스티커 · 펜 · 테마, stacked under the settings button. */
export function DecorRail({ tool, onTool }: { tool: DecorTool | null; onTool: (tool: DecorTool | null) => void }) {
  return (
    <div className="decor-rail" role="toolbar" aria-label="꾸미기" aria-orientation="vertical">
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
    </div>
  );
}

interface DecorTrayProps {
  tool: DecorTool;
  armed: string | null;
  onArm: (emoji: string | null) => void;
  pen: PenSettings;
  onPen: (pen: PenSettings) => void;
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
}

const PEN_ICONS: Record<PenTool, typeof PenLine> = {
  pen: Pencil,
  highlighter: Highlighter,
  neon: Sparkles,
  eraser: Eraser,
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
  const paletteInput = useRef<HTMLInputElement | null>(null);
  const custom = isCustomColor(p.pen.color) ? p.pen.color : null;
  const label = RAIL.find((r) => r.tool === p.tool)?.label;

  return (
    <div className={`decor-tray decor-tray--${p.tool}`} role="toolbar" aria-label={label}>
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
            {BASE_COLORS.map(({ color, label: name }) => (
              <button
                key={color}
                className={`decor-tray__color ${p.pen.color === color ? 'is-on' : ''}`}
                style={{ color: inkCss(color) }}
                aria-label={name}
                aria-pressed={p.pen.color === color}
                onClick={() => p.onPen({ ...p.pen, color, tool: p.pen.tool === 'eraser' ? 'pen' : p.pen.tool })}
              >
                <span aria-hidden />
              </button>
            ))}
            {custom && (
              <button className="decor-tray__color is-on" style={{ color: custom }} aria-label="팔레트에서 고른 색" aria-pressed>
                <span aria-hidden />
              </button>
            )}
            {/* The rainbow opens the system colour picker; its pick becomes the ink. */}
            <button className="decor-tray__palette" aria-label="팔레트에서 색 고르기" onClick={() => paletteInput.current?.click()}>
              <span aria-hidden />
            </button>
            <input
              ref={paletteInput}
              className="sr-only"
              type="color"
              tabIndex={-1}
              aria-hidden
              value={custom ?? '#ff4d6d'}
              onChange={(e) => p.onPen({ ...p.pen, color: e.target.value, tool: p.pen.tool === 'eraser' ? 'pen' : p.pen.tool })}
            />
          </div>
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
                <i />
                <b />
              </span>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

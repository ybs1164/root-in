import { Check, Palette, PenLine, Sticker, Trash2, Undo2 } from 'lucide-react';
import {
  PEN_COLORS,
  PEN_WIDTHS,
  STICKERS,
  THEMES,
  type DecorTool,
  type PenColor,
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
  onDone: () => void;
  armed: string | null;
  onArm: (emoji: string | null) => void;
  pen: { color: PenColor; width: PenWidth };
  onPen: (pen: { color: PenColor; width: PenWidth }) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClearInk: () => void;
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
}

/**
 * The tool's tray, in the bottom bar's place while decorating: sticker
 * list, pen colours and widths, or themes, all in one scrolling row, with
 * a 완료 button to put the tools away.
 */
export function DecorTray(p: DecorTrayProps) {
  return (
    <div className={`decor-tray decor-tray--${p.tool}`} role="toolbar" aria-label={RAIL.find((r) => r.tool === p.tool)?.label}>
      <div className="decor-tray__scroll">
        {p.tool === 'sticker' &&
          STICKERS.map((emoji) => (
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

        {p.tool === 'pen' && (
          <>
            {PEN_COLORS.map(({ color, label }) => (
              <button
                key={color}
                className={`decor-tray__color ${p.pen.color === color ? 'is-on' : ''}`}
                style={{ color: `var(--${color})` }}
                aria-label={`${label} 펜`}
                aria-pressed={p.pen.color === color}
                onClick={() => p.onPen({ ...p.pen, color })}
              >
                <span aria-hidden />
              </button>
            ))}
            <span className="decor-tray__sep" aria-hidden />
            {(Object.keys(PEN_WIDTHS) as PenWidth[]).map((width) => (
              <button
                key={width}
                className={`decor-tray__width ${p.pen.width === width ? 'is-on' : ''}`}
                aria-label={{ thin: '가는 펜', medium: '보통 펜', thick: '굵은 펜' }[width]}
                aria-pressed={p.pen.width === width}
                onClick={() => p.onPen({ ...p.pen, width })}
              >
                <span style={{ height: `${PEN_WIDTHS[width] * 360}px`, background: `var(--${p.pen.color})` }} aria-hidden />
              </button>
            ))}
            <span className="decor-tray__sep" aria-hidden />
            <button className="decor-tray__icon" aria-label="되돌리기" disabled={!p.canUndo} onClick={p.onUndo}>
              <Undo2 size={20} aria-hidden />
            </button>
            <button className="decor-tray__icon" aria-label="그린 것 모두 지우기" disabled={!p.canUndo} onClick={p.onClearInk}>
              <Trash2 size={20} aria-hidden />
            </button>
          </>
        )}

        {p.tool === 'theme' &&
          THEMES.map(({ id, label }) => (
            <button
              key={id}
              className={`decor-tray__theme ${p.theme === id ? 'is-on' : ''}`}
              aria-pressed={p.theme === id}
              onClick={() => p.onTheme(id)}
            >
              <span className={`theme-swatch theme-swatch--${id}`} aria-hidden>
                <i />
              </span>
              {label}
            </button>
          ))}
      </div>
      <button className="decor-tray__done" aria-label="완료" onClick={p.onDone}>
        <Check size={22} aria-hidden />
      </button>
    </div>
  );
}

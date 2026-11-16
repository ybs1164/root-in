import {
  ChevronDown,
  ChevronUp,
  Clock,
  GalleryVerticalEnd,
  PenLine,
  Share,
  Sticker,
  Type,
  Wallpaper,
} from 'lucide-react';
import { useId, useState, type ComponentType, type CSSProperties } from 'react';
import type { DecorTool } from '../domain/decor';

const RAIL: { tool: DecorTool; label: string; Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }[] = [
  { tool: 'sticker', label: '스티커', Icon: Sticker },
  { tool: 'pen', label: '펜', Icon: PenLine },
  { tool: 'text', label: '텍스트', Icon: Type },
  { tool: 'theme', label: '테마', Icon: PinLand },
  { tool: 'pattern', label: '꾸미기', Icon: Wallpaper },
];
/** 테마 (2026-11-12): a ping standing on a flat oval of land — what a day theme now tints. */
function PinLand({ size = 24 }: { size?: number }) {
  const mask = useId();
  const pin = 'M17 9c0 3.6-5 8-5 8s-5-4.4-5-8a5 5 0 0 1 10 0Z';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" stroke="none" />
        {/* The land's outline stops a little short of the pin in front of it. */}
        <path d={pin} fill="black" stroke="black" strokeWidth="4" />
      </mask>
      <ellipse cx="12" cy="17.5" rx="9.5" ry="3.8" mask={`url(#${mask})`} />
      <path d={pin} />
      <circle cx="12" cy="9" r="1.8" />
    </svg>
  );
}

/** How long the name / time switches take to tuck away (matches `.decor-rail__switch.is-leaving`). */
const SWITCH_OUT_MS = 160;

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

/** A tool's name, as its sheet (DecorTray) is labelled. */
export const toolLabel = (tool: DecorTool): string | undefined => [...RAIL, POLAROID_TOOL].find((r) => r.tool === tool)?.label;

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
  // They drop out one after another like the map's category buttons, and tuck
  // back up before going; ↓ / ↑ glides to its new place (`moved` replays it).
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [moved, setMoved] = useState<'down' | 'up' | null>(null);
  const toggle = () => {
    if (leaving) return;
    if (!open) {
      setOpen(true);
      setMoved('down');
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      setMoved('up');
    }, SWITCH_OUT_MS);
  };
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
            className={`decor-rail__btn decor-rail__switch ${labels.names ? '' : 'is-off'} ${leaving ? 'is-leaving' : ''}`}
            style={{ '--i': 0 } as CSSProperties}
            aria-label="장소 이름 보이기"
            aria-pressed={labels.names}
            onClick={labels.onNames}
          >
            <PinName />
          </button>
          <button
            className={`decor-rail__btn decor-rail__switch ${labels.times ? '' : 'is-off'} ${leaving ? 'is-leaving' : ''}`}
            style={{ '--i': 1 } as CSSProperties}
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
          key={open ? 'open' : 'shut'}
          className={`decor-rail__btn decor-rail__more ${moved ? `is-moved-${moved}` : ''}`}
          aria-label={open ? '접기' : '펼치기'}
          aria-expanded={open}
          onClick={toggle}
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

import { Crosshair, MapPin } from 'lucide-react';
import { CalendarToday } from './icons';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import type { AppTab } from '../domain/appTabs';

interface BottomBarProps {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
  /** Pressing the map's tag: dragging it right pulls the calendar in. */
  onTagDrag?: (e: PointerEvent) => void;
  /** The blue pin in the middle of the map's row: a new pin where the map is looking. */
  onPin: () => void;
  /** The small crosshair at the map's bottom right: aim first, then pin. */
  onAim: () => void;
  /** While the calendar page slides over, the map's tag rides it (or waits), then pops back. */
  tagHidden?: boolean;
}

interface EdgeTagProps {
  side: 'left' | 'right';
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
  /** A stand-in riding on a sliding page: not a button, and no pop. */
  ghost?: boolean;
  style?: CSSProperties;
}

/**
 * An index tab sticking out of the screen's edge, like a divider's tab.
 */
export function EdgeTag({ side, label, icon, onClick, onPointerDown, ghost, style }: EdgeTagProps) {
  return (
    <button
      className={`edge-tag edge-tag--${side} ${ghost ? 'edge-tag--ghost' : 'edge-tag--pop'}`}
      aria-label={label}
      aria-hidden={ghost || undefined}
      tabIndex={ghost ? -1 : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={style}
    >
      <svg className="edge-tag__shape" viewBox="0 0 56 54" aria-hidden>
        {/* An index tab like the 경로 folder tabs: flat against the edge, outer corners rounded 14. */}
        <path className="edge-tag__body" d="M-8 0H42A14 14 0 0 1 56 14V40A14 14 0 0 1 42 54H-8Z" />
      </svg>
      <span className="edge-tag__icon" aria-hidden>
        {icon}
      </span>
    </button>
  );
}

export const CalendarTagIcon = () => <CalendarToday />;
export const MapTagIcon = () => <MapPin aria-hidden />;

/**
 * The row along the bottom of the map: a tag on the left edge to the
 * calendar, the blue pin button in the middle, a small crosshair beside it.
 * The calendar's own tag (back to the map) rides on its page, so it slides
 * with it.
 */
export default function BottomBar({ tab, onTab, onTagDrag, onPin, onAim, tagHidden }: BottomBarProps) {
  if (tab !== 'pins') return <nav className="bottom-bar" aria-label="메뉴" />;
  return (
    <nav className="bottom-bar" aria-label="메뉴">
      {!tagHidden && <EdgeTag side="left" label="달력" icon={<CalendarTagIcon />} onClick={() => onTab('calendar')} onPointerDown={onTagDrag} />}
      <button className="bar-pin" aria-label="지도에 핀 꽂기" onClick={onPin}>
        <MapPin size={38} strokeWidth={2.2} aria-hidden />
      </button>
      <button className="bar-aim" aria-label="조준해서 핀 꽂기" onClick={onAim}>
        <Crosshair size={21} strokeWidth={2.2} aria-hidden />
      </button>
    </nav>
  );
}

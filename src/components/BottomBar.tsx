import { Crosshair, MapPin } from 'lucide-react';
import { CalendarToday } from './icons';
import type { CSSProperties, ReactNode } from 'react';
import type { AppTab } from '../domain/appTabs';

interface BottomBarProps {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
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
  /** A stand-in riding on a sliding page: not a button, and no pop. */
  ghost?: boolean;
  style?: CSSProperties;
}

/**
 * A luggage tag lying on its side, its flat end tucked off the screen's
 * edge and its rounded end (with the eyelet hole) pointing in.
 */
export function EdgeTag({ side, label, icon, onClick, ghost, style }: EdgeTagProps) {
  return (
    <button
      className={`edge-tag edge-tag--${side} ${ghost ? 'edge-tag--ghost' : 'edge-tag--pop'}`}
      aria-label={label}
      aria-hidden={ghost || undefined}
      tabIndex={ghost ? -1 : undefined}
      onClick={onClick}
      style={style}
    >
      <svg className="edge-tag__shape" viewBox="0 0 64 54" aria-hidden>
        {/* A body ending in a half-circle arc, the eyelet a hole right through it. */}
        <path
          className="edge-tag__body"
          fillRule="evenodd"
          d="M-8 3H38A24 24 0 0 1 38 51H-8Z M43.5 27a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0Z"
        />
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
export default function BottomBar({ tab, onTab, onPin, onAim, tagHidden }: BottomBarProps) {
  if (tab !== 'pins') return <nav className="bottom-bar" aria-label="메뉴" />;
  return (
    <nav className="bottom-bar" aria-label="메뉴">
      {!tagHidden && <EdgeTag side="left" label="달력" icon={<CalendarTagIcon />} onClick={() => onTab('calendar')} />}
      <button className="bar-pin" aria-label="지도에 핀 꽂기" onClick={onPin}>
        <MapPin size={38} strokeWidth={2.2} aria-hidden />
      </button>
      <button className="bar-aim" aria-label="조준해서 핀 꽂기" onClick={onAim}>
        <Crosshair size={21} strokeWidth={2.2} aria-hidden />
      </button>
    </nav>
  );
}

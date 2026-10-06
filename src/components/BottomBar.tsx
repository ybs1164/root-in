import { Crosshair, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppTab } from '../domain/appTabs';
import { CalendarToday } from './icons';

interface BottomBarProps {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
  /** The blue pin in the middle of the map's row: a new pin where the map is looking. */
  onPin: () => void;
  /** The small crosshair at the map's bottom right: aim first, then pin. */
  onAim: () => void;
}

/**
 * A luggage tag lying on its side, its flat end tucked off the screen's
 * edge and its clipped end (with the eyelet) pointing in. One SVG path with
 * the eyelet cut out (evenodd), so the drop shadow follows the outline.
 */
function EdgeTag({ side, label, icon, onClick }: { side: 'left' | 'right'; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className={`edge-tag edge-tag--${side}`} aria-label={label} onClick={onClick}>
      <svg className="edge-tag__shape" viewBox="0 0 80 54" aria-hidden>
        <path
          fillRule="evenodd"
          d="M-6 2h60a4 4 0 0 1 2.8 1.2l19 19a4 4 0 0 1 0 5.6l-19 19A4 4 0 0 1 54 52H-6ZM64 22.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
        />
      </svg>
      <span className="edge-tag__icon" aria-hidden>
        {icon}
      </span>
    </button>
  );
}

/**
 * The row along the bottom of the two screens (the boarding-pass tab bar is
 * gone). Map: a tag on the left edge to the calendar, the blue pin button in
 * the middle, a small crosshair at the right. Calendar: a tag on the right
 * edge back to the map; its 공유 sits in the middle (CalendarZoom draws it).
 */
export default function BottomBar({ tab, onTab, onPin, onAim }: BottomBarProps) {
  return (
    <nav className="bottom-bar" aria-label="메뉴">
      {tab === 'pins' ? (
        <>
          <EdgeTag side="left" label="달력" icon={<CalendarToday />} onClick={() => onTab('calendar')} />
          <button className="bar-pin" aria-label="지도에 핀 꽂기" onClick={onPin}>
            <MapPin size={34} strokeWidth={2.2} aria-hidden />
          </button>
          <button className="bar-aim" aria-label="조준해서 핀 꽂기" onClick={onAim}>
            <Crosshair size={21} strokeWidth={2.2} aria-hidden />
          </button>
        </>
      ) : (
        <EdgeTag side="right" label="지도" icon={<MapPin aria-hidden />} onClick={() => onTab('pins')} />
      )}
    </nav>
  );
}

import { Crosshair, MapPin } from 'lucide-react';
import { useId, type ReactNode } from 'react';
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
 * edge and its pointed end (with the eyelet) pointing in. The eyelet is cut
 * out with a mask (a stroked hole would fill it), so the shadow follows the outline.
 */
function EdgeTag({ side, label, icon, onClick }: { side: 'left' | 'right'; label: string; icon: ReactNode; onClick: () => void }) {
  const hole = `tag-hole-${useId().replace(/:/g, '')}`;
  return (
    <button className={`edge-tag edge-tag--${side}`} aria-label={label} onClick={onClick}>
      <svg className="edge-tag__shape" viewBox="0 0 80 54" aria-hidden>
        {/* A long body and a pointed end, corners just softened (round joins);
            the eyelet a hole with a light ring round it. */}
        <defs>
          <mask id={hole} maskUnits="userSpaceOnUse" x="-20" y="-10" width="110" height="74">
            <rect x="-20" y="-10" width="110" height="74" fill="#fff" />
            <circle cx="61" cy="27" r="3" fill="#000" />
          </mask>
        </defs>
        <path className="edge-tag__body" d="M-8 3H50L76 27L50 51H-8Z" mask={`url(#${hole})`} />
        <circle className="edge-tag__eyelet" cx="61" cy="27" r="4.6" />
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

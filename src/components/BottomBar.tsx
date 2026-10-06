import { Crosshair, MapPin } from 'lucide-react';
import type { PointerEvent } from 'react';
import type { AppTab } from '../domain/appTabs';
import { CalendarToday } from './icons';

interface BottomBarProps {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
  /** Pressing the corner tab: dragging it up pulls the calendar in. */
  onTagDrag?: (e: PointerEvent) => void;
  /** The blue pin in the middle of the map's row: a new pin where the map is looking. */
  onPin: () => void;
  /** The small crosshair at the pin's lower right: aim first, then pin. */
  onAim: () => void;
}

/**
 * The bottom of the map: an index tab to the calendar in the bottom-left
 * corner, the blue pin in the dead centre, a small white crosshair at its
 * lower right. The calendar's way back to the map is the same tab on its own
 * page (App), so it moves with it.
 */
export default function BottomBar({ tab, onTab, onTagDrag, onPin, onAim }: BottomBarProps) {
  if (tab !== 'pins') return <nav className="bottom-bar" aria-label="메뉴" />;
  return (
    <>
      {/* An index tab standing in the bottom-left corner, its icon at the top. */}
      <button className="corner-tab" aria-label="달력" onClick={() => onTab('calendar')} onPointerDown={onTagDrag}>
        <CalendarToday />
      </button>
      <nav className="bottom-bar" aria-label="메뉴">
        <button className="bar-pin" aria-label="지도에 핀 꽂기" onClick={onPin}>
          <MapPin size={38} strokeWidth={2.2} aria-hidden />
        </button>
        <button className="bar-side bar-aim" aria-label="조준해서 핀 꽂기" onClick={onAim}>
          <Crosshair size={21} strokeWidth={2.2} aria-hidden />
        </button>
      </nav>
    </>
  );
}

import { CalendarDays, Crosshair, MapPin } from 'lucide-react';
import type { AppTab } from '../domain/appTabs';
import { CalendarToday } from './icons';

interface BottomBarProps {
  tab: AppTab;
  /** Day screen or month: what the big calendar button does next. */
  calendarMode: 'day' | 'month';
  /** The calendar button: to the calendar, or (already there, big) on to the month / back to TODAY. */
  onCalendar: () => void;
  /** The pin, small on the calendar: back to the map. */
  onMap: () => void;
  /** The blue pin in the middle of the map's row: a new pin where the map is looking. */
  onPin: () => void;
  /** The small crosshair at the pin's lower right: aim first, then pin. */
  onAim: () => void;
}

/**
 * The row along the bottom of both screens. On the map the blue pin sits big
 * in the dead centre, the calendar and the crosshair small at its lower left
 * and right. Switching to the calendar, the calendar button grows into the
 * centre while the pin shrinks into its corner, where it is the way back; the
 * crosshair steps away. The buttons stay mounted so the swap is animated.
 */
export default function BottomBar({ tab, calendarMode, onCalendar, onMap, onPin, onAim }: BottomBarProps) {
  const cal = tab === 'calendar';
  return (
    <nav className={`bottom-bar ${cal ? 'bottom-bar--cal' : ''}`} aria-label="메뉴">
      <button className="bar-btn bar-pin" aria-label={cal ? '지도' : '지도에 핀 꽂기'} onClick={cal ? onMap : onPin}>
        <MapPin strokeWidth={2.2} aria-hidden />
      </button>
      <button
        className="bar-btn bar-cal"
        aria-label={cal ? (calendarMode === 'day' ? '월 달력' : '오늘') : '달력'}
        onClick={onCalendar}
      >
        {cal && calendarMode === 'day' ? <CalendarDays strokeWidth={2.2} aria-hidden /> : <CalendarToday />}
      </button>
      <button className="bar-btn bar-aim" aria-label="조준해서 핀 꽂기" onClick={onAim} tabIndex={cal ? -1 : undefined} aria-hidden={cal || undefined}>
        <Crosshair strokeWidth={2.2} aria-hidden />
      </button>
    </nav>
  );
}

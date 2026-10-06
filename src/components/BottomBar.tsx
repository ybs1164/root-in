import { CalendarDays, Crosshair, MapPin, Share } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  /** A day on the calendar: 공유 at the row's right end. */
  onShare?: () => void;
}

/**
 * The row along the bottom of both screens. On the map the blue pin sits big
 * in the dead centre, the calendar and the crosshair small at its lower left
 * and right. Switching to the calendar, everything moves right: the calendar
 * button grows into the centre while the pin shrinks into the crosshair's
 * place, where it is the way back; the crosshair slides on and fades. The buttons stay mounted so the swap is animated.
 */
export default function BottomBar({ tab, calendarMode, onCalendar, onMap, onPin, onAim, onShare }: BottomBarProps) {
  const cal = tab === 'calendar';
  // The crosshair slides off to the right on the way to the calendar, and on
  // the way back grows up out of its bottom (an entrance played once).
  const lastTab = useRef(tab);
  const [aimBack, setAimBack] = useState(false);
  useEffect(() => {
    if (lastTab.current === 'calendar' && tab === 'pins') setAimBack(true);
    lastTab.current = tab;
  }, [tab]);
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
        {/* Shows where you are: today's date on the day screens, the month grid on the month. */}
        {cal && calendarMode === 'month' ? <CalendarDays strokeWidth={2.2} aria-hidden /> : <CalendarToday />}
      </button>
      <button
        className={`bar-btn bar-aim ${aimBack && !cal ? 'is-back' : ''}`}
        aria-label="조준해서 핀 꽂기"
        onClick={onAim}
        onAnimationEnd={() => setAimBack(false)}
        tabIndex={cal ? -1 : undefined}
        aria-hidden={cal || undefined}
      >
        <Crosshair strokeWidth={2.2} aria-hidden />
      </button>
      {onShare && (
        <button className="bar-share" aria-label="공유" onClick={onShare}>
          <Share size={24} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    </nav>
  );
}

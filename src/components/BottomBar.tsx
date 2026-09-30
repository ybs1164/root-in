import { CalendarDays, MapPin, Share, Sparkles } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { bottomBarAction, type AppTab } from '../domain/appTabs';
import { CalendarToday } from './icons';

interface BottomBarProps {
  tab: AppTab;
  pinning: boolean;
  onTab: (tab: AppTab) => void;
  onPin: () => void;
  /** Calendar button tapped while the calendar is showing. */
  onCalendarAgain: () => void;
  /** The 공유 / 월 달력 menu above the calendar button (day screens only). */
  calendarMenu: boolean;
  onCloseCalendarMenu: () => void;
  onShareDay: () => void;
  onShowMonth: () => void;
}

const BUTTONS: { tab: AppTab; label: string; icon: ReactNode }[] = [
  { tab: 'calendar', label: '달력', icon: <CalendarToday /> },
  { tab: 'pins', label: '핀', icon: <MapPin aria-hidden /> },
  { tab: 'influencer', label: '추천', icon: <Sparkles aria-hidden /> },
];

/**
 * Three floating round buttons (📅 · 📍 · ✨), icon only. The current
 * screen's button is the big one; size is the only "selected" signal, so
 * the labels live in aria-label instead of on screen. Tapped again on a
 * day screen, the calendar button fans out 공유 and 월 달력 above itself.
 */
export default function BottomBar({
  tab,
  pinning,
  onTab,
  onPin,
  onCalendarAgain,
  calendarMenu,
  onCloseCalendarMenu,
  onShareDay,
  onShowMonth,
}: BottomBarProps) {
  useEffect(() => {
    if (!calendarMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseCalendarMenu();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendarMenu, onCloseCalendarMenu]);

  const press = (target: AppTab) => () => {
    const action = bottomBarAction(target, tab);
    if (action === 'switch') onTab(target);
    else if (action === 'pin') onPin();
    else if (action === 'calendar') onCalendarAgain();
  };

  return (
    <nav className="bottom-bar" aria-label="메뉴">
      {calendarMenu && <div className="bottom-bar__scrim" onPointerDown={onCloseCalendarMenu} aria-hidden />}
      {BUTTONS.map(({ tab: target, label, icon }) => {
        const on = tab === target;
        const isPin = target === 'pins';
        const isCalendar = target === 'calendar';
        return (
          <div key={target} className="bottom-bar__slot">
            {isCalendar && calendarMenu && (
              // Top to bottom: 공유, then 월 달력 right above the calendar button.
              <div className="bottom-bar__dial" role="menu" aria-label="달력 메뉴">
                <button className="bottom-bar__btn bottom-bar__dial-btn" role="menuitem" aria-label="공유" onClick={onShareDay}>
                  <Share aria-hidden />
                </button>
                <button className="bottom-bar__btn bottom-bar__dial-btn" role="menuitem" aria-label="월 달력" onClick={onShowMonth}>
                  <CalendarDays aria-hidden />
                </button>
              </div>
            )}
            <button
              className={`bottom-bar__btn ${isPin ? 'bottom-bar__btn--pin' : ''} ${on ? 'is-on' : ''} ${isPin && pinning ? 'is-pinning' : ''}`}
              aria-label={isPin && on ? '지도에 핀 꽂기' : label}
              aria-current={on ? 'page' : undefined}
              aria-pressed={isPin && on ? pinning : undefined}
              aria-haspopup={isCalendar && on ? 'menu' : undefined}
              aria-expanded={isCalendar && on ? calendarMenu : undefined}
              onClick={press(target)}
            >
              {icon}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

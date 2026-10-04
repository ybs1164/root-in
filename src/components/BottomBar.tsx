import { CalendarDays, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { bottomBarAction, type AppTab } from '../domain/appTabs';
import { CalendarToday } from './icons';

interface BottomBarProps {
  tab: AppTab;
  pinning: boolean;
  onTab: (tab: AppTab) => void;
  onPin: () => void;
  /** Calendar button tapped while the calendar is showing. */
  onCalendarAgain: () => void;
  /**
   * The calendar button shows where its next tap goes: a month grid on a
   * day screen, today's date everywhere else (the month goes back to TODAY).
   */
  calendarIcon: 'today' | 'month';
}

const BUTTONS: { tab: AppTab; label: string; icon: ReactNode }[] = [
  { tab: 'calendar', label: '달력', icon: <CalendarToday /> },
  { tab: 'pins', label: '핀', icon: <MapPin aria-hidden /> },
];

/**
 * One boarding-pass ticket torn into two halves (📅 · 📍), icon only. The
 * current screen's half is filled with the accent; that is the only
 * "selected" signal, so the labels live in aria-label instead of on screen.
 * Tapped again, the calendar button flips a day screen to the month and the
 * month to TODAY.
 */
export default function BottomBar({ tab, pinning, onTab, onPin, onCalendarAgain, calendarIcon }: BottomBarProps) {
  const press = (target: AppTab) => () => {
    const action = bottomBarAction(target, tab);
    if (action === 'switch') onTab(target);
    else if (action === 'pin') onPin();
    else if (action === 'calendar') onCalendarAgain();
  };

  return (
    <nav className="bottom-bar" aria-label="메뉴">
      <div className="bottom-bar__ticket">
        <div className="bottom-bar__stub">
          {BUTTONS.map(({ tab: target, label, icon }) => {
            const on = tab === target;
            const isPin = target === 'pins';
            return (
              <button
                key={target}
                className={`bottom-bar__btn ${on ? 'is-on' : ''} ${isPin && pinning ? 'is-pinning' : ''}`}
                aria-label={isPin && on ? '지도에 핀 꽂기' : label}
                aria-current={on ? 'page' : undefined}
                aria-pressed={isPin && on ? pinning : undefined}
                onClick={press(target)}
              >
                {target === 'calendar' && calendarIcon === 'month' ? <CalendarDays aria-hidden /> : icon}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

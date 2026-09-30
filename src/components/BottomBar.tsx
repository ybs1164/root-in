import { CalendarDays, MapPin, Sparkles, type LucideIcon } from 'lucide-react';
import { bottomBarAction, type AppTab } from '../domain/appTabs';

interface BottomBarProps {
  tab: AppTab;
  pinning: boolean;
  onTab: (tab: AppTab) => void;
  onPin: () => void;
}

const BUTTONS: { tab: AppTab; label: string; Icon: LucideIcon }[] = [
  { tab: 'calendar', label: '달력', Icon: CalendarDays },
  { tab: 'pins', label: '핀', Icon: MapPin },
  { tab: 'influencer', label: '추천', Icon: Sparkles },
];

/**
 * Three floating round buttons (📅 · 📍 · ✨), icon only. The current
 * screen's button is the big one; size is the only "selected" signal, so
 * the labels live in aria-label instead of on screen.
 */
export default function BottomBar({ tab, pinning, onTab, onPin }: BottomBarProps) {
  const press = (target: AppTab) => () => {
    const action = bottomBarAction(target, tab);
    if (action === 'switch') onTab(target);
    else if (action === 'pin') onPin();
  };
  return (
    <nav className="bottom-bar" aria-label="메뉴">
      {BUTTONS.map(({ tab: target, label, Icon }) => {
        const on = tab === target;
        const isPin = target === 'pins';
        return (
          <button
            key={target}
            className={`bottom-bar__btn ${isPin ? 'bottom-bar__btn--pin' : ''} ${on ? 'is-on' : ''} ${isPin && pinning ? 'is-pinning' : ''}`}
            aria-label={isPin && on ? '지도에 핀 꽂기' : label}
            aria-current={on ? 'page' : undefined}
            aria-pressed={isPin && on ? pinning : undefined}
            onClick={press(target)}
          >
            <Icon aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}

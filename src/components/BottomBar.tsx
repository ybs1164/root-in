import { CalendarDays, MapPin, Sparkles } from 'lucide-react';
import type { AppTab } from '../domain/appTabs';

interface BottomBarProps {
  tab: AppTab;
  pinning: boolean;
  onTab: (tab: AppTab) => void;
  onPin: () => void;
}

/**
 * 📅 달력 · 📍 핀 · ✨ 추천. The side buttons are tabs (tapping the active
 * one again returns to the pin map); the center one is an action.
 */
export default function BottomBar({ tab, pinning, onTab, onPin }: BottomBarProps) {
  const side = (target: AppTab) => () => onTab(tab === target ? 'pins' : target);
  return (
    <nav className="bottom-bar" aria-label="메뉴">
      <button className={`bottom-bar__tab ${tab === 'calendar' ? 'is-on' : ''}`} aria-pressed={tab === 'calendar'} onClick={side('calendar')}>
        <CalendarDays size={24} aria-hidden />
        <span>달력</span>
      </button>
      <button className={`bottom-bar__pin ${pinning ? 'is-on' : ''}`} aria-pressed={pinning} aria-label="지도에 핀 꽂기" onClick={onPin}>
        <MapPin size={28} aria-hidden />
      </button>
      <button
        className={`bottom-bar__tab ${tab === 'influencer' ? 'is-on' : ''}`}
        aria-pressed={tab === 'influencer'}
        onClick={side('influencer')}
      >
        <Sparkles size={24} aria-hidden />
        <span>추천</span>
      </button>
    </nav>
  );
}

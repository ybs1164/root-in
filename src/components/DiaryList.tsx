import { MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { stopCountsByDate } from '../domain/calendar';
import { diaryKind, formatDiaryDate } from '../domain/diary';
import type { DiaryEntry, WishItem } from '../types/diary';
import { WishStar } from './icons';
import MonthCalendar from './MonthCalendar';

export type DiaryListTab = 'entries' | 'wishlist';

interface DiaryListProps {
  tab: DiaryListTab;
  onTab: (tab: DiaryListTab) => void;
  entries: DiaryEntry[];
  wishes: WishItem[];
  wishByDiaryId: Map<string, WishItem>;
  locating: boolean;
  onRouteIn: () => void;
  onPickDate: (key: string) => void;
  onOpenEntry: (entry: DiaryEntry) => void;
  onToggleWish: (entry: DiaryEntry) => void;
  onOpenWish: (item: WishItem) => void;
}

const route = (item: DiaryEntry | WishItem) => item.stops.map((s) => s.place.name).join(' → ');

/** The calendar tab's home: route-in, the month, then the day list / wishlist. */
export default function DiaryList({
  tab,
  onTab,
  entries,
  wishes,
  wishByDiaryId,
  locating,
  onRouteIn,
  onPickDate,
  onOpenEntry,
  onToggleWish,
  onOpenWish,
}: DiaryListProps) {
  const counts = useMemo(() => stopCountsByDate(entries), [entries]);
  const plans = useMemo(() => new Set(entries.filter((e) => diaryKind(e) === 'plan').map((e) => e.date)), [entries]);

  return (
    <div className="diary">
      <button className="btn btn--primary btn--block" onClick={onRouteIn} disabled={locating}>
        <MapPin size={18} aria-hidden />
        {locating ? '위치 찾는 중…' : '지금 여기 루트-인'}
      </button>

      <MonthCalendar counts={counts} plans={plans} onPick={onPickDate} />

      <div className="segmented" role="tablist" aria-label="기록 보기">
        <button role="tab" aria-selected={tab === 'entries'} className={tab === 'entries' ? 'is-on' : ''} onClick={() => onTab('entries')}>
          루트
        </button>
        <button
          role="tab"
          aria-selected={tab === 'wishlist'}
          aria-label="위시리스트"
          className={tab === 'wishlist' ? 'is-on' : ''}
          onClick={() => onTab('wishlist')}
        >
          <WishStar on={tab === 'wishlist'} size={18} />
        </button>
      </div>

      {tab === 'entries' ? (
        entries.length === 0 ? (
          <p className="diary-empty">날짜를 눌러 하루 루트를 짜거나, 루트-인으로 오늘을 기록해 보세요.</p>
        ) : (
          <ul className="day-list">
            {entries.map((entry) => {
              const wished = wishByDiaryId.has(entry.id);
              const plan = diaryKind(entry) === 'plan';
              return (
                <li key={entry.id} className="day-row">
                  <button className="day-row__main" onClick={() => onOpenEntry(entry)}>
                    <span className="day-row__date">
                      {formatDiaryDate(entry.date)}
                      {plan && <span className="badge badge--trip day-row__badge">계획</span>}
                    </span>
                    <span className="day-row__route">{route(entry)}</span>
                  </button>
                  <button
                    className={`icon-btn star-btn ${wished ? 'star-btn--on' : ''}`}
                    aria-pressed={wished}
                    aria-label={wished ? '위시리스트에서 빼기' : '위시리스트에 담기'}
                    onClick={() => onToggleWish(entry)}
                  >
                    <WishStar on={wished} />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : wishes.length === 0 ? (
        <p className="diary-empty">별표한 하루가 여기 모여요.</p>
      ) : (
        <ul className="day-list">
          {wishes.map((item) => (
            <li key={item.id} className="day-row">
              <button className="day-row__main" onClick={() => onOpenWish(item)}>
                <span className="day-row__date">
                  {formatDiaryDate(item.date)}
                  {item.sharedBy && ` · ${item.sharedBy}`}
                </span>
                <span className="day-row__route">{route(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

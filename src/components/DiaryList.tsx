import { formatDiaryDate } from '../domain/diary';
import type { DiaryEntry, WishItem } from '../types/diary';
import { WishStar } from './icons';

export type DiaryListTab = 'entries' | 'wishlist';

interface DiaryListProps {
  tab: DiaryListTab;
  onTab: (tab: DiaryListTab) => void;
  entries: DiaryEntry[];
  wishes: WishItem[];
  wishByDiaryId: Map<string, WishItem>;
  onNewEntry: () => void;
  onOpenEntry: (entry: DiaryEntry) => void;
  onToggleWish: (entry: DiaryEntry) => void;
  onOpenWish: (item: WishItem) => void;
}

const route = (item: DiaryEntry | WishItem) => item.stops.map((s) => s.place.name).join(' → ');

export default function DiaryList({
  tab,
  onTab,
  entries,
  wishes,
  wishByDiaryId,
  onNewEntry,
  onOpenEntry,
  onToggleWish,
  onOpenWish,
}: DiaryListProps) {
  return (
    <div className="diary">
      <div className="segmented" role="tablist" aria-label="기록 보기">
        <button role="tab" aria-selected={tab === 'entries'} className={tab === 'entries' ? 'is-on' : ''} onClick={() => onTab('entries')}>
          기록
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
        <>
          <button className="add-more" onClick={onNewEntry}>
            ＋ 오늘
          </button>
          <ul className="day-list">
            {entries.map((entry) => {
              const wished = wishByDiaryId.has(entry.id);
              return (
                <li key={entry.id} className="day-row">
                  <button className="day-row__main" onClick={() => onOpenEntry(entry)}>
                    <span className="day-row__date">{formatDiaryDate(entry.date)}</span>
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
        </>
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

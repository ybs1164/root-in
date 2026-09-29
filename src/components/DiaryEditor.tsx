import { ChevronLeft, MapPin, Search, Share, Trash2 } from 'lucide-react';
import { removeStop, setStopMemo } from '../domain/course';
import { DIARY_LIMITS, formatDiaryDate, setStopTime, sortStopsByTime } from '../domain/diary';
import type { DiaryDraft } from '../types/diary';
import DiaryTimeline from './DiaryTimeline';
import { WishStar } from './icons';

interface DiaryEditorProps {
  draft: DiaryDraft;
  wished: boolean;
  locating: boolean;
  onChange: (draft: DiaryDraft) => void;
  onBack: () => void;
  onShare: () => void;
  onDelete: () => void;
  onToggleWish: () => void;
  onFocusStop: (index: number) => void;
  onStartSearch: () => void;
  onAddCurrentLocation: () => void;
}

/** Saves itself (see App); the only decisions left are what, when and one line. */
export default function DiaryEditor({
  draft,
  wished,
  locating,
  onChange,
  onBack,
  onShare,
  onDelete,
  onToggleWish,
  onFocusStop,
  onStartSearch,
  onAddCurrentLocation,
}: DiaryEditorProps) {
  const full = draft.stops.length >= DIARY_LIMITS.maxStops;
  const empty = draft.stops.length === 0;

  return (
    <div className="diary">
      <div className="diary-bar">
        <button className="icon-btn" aria-label="목록" onClick={onBack}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <strong className="diary-bar__title">{formatDiaryDate(draft.date)}</strong>
        <button
          className={`icon-btn star-btn ${wished ? 'star-btn--on' : ''}`}
          aria-pressed={wished}
          aria-label={wished ? '위시리스트에서 빼기' : '위시리스트에 담기'}
          disabled={!draft.id}
          onClick={onToggleWish}
        >
          <WishStar on={wished} />
        </button>
        <button className="icon-btn" aria-label="공유" disabled={empty} onClick={onShare}>
          <Share size={21} aria-hidden />
        </button>
        {draft.id && (
          <button className="icon-btn icon-btn--danger" aria-label="이 기록 삭제" onClick={onDelete}>
            <Trash2 size={20} aria-hidden />
          </button>
        )}
      </div>

      {empty ? (
        <p className="diary-empty">지금 있는 곳부터 남겨 보세요.</p>
      ) : (
        <DiaryTimeline
          stops={draft.stops}
          onFocusStop={onFocusStop}
          edit={{
            onTime: (index, time) => onChange({ ...draft, stops: setStopTime(draft.stops, index, time) }),
            onTimeCommit: () => onChange({ ...draft, stops: sortStopsByTime(draft.stops) }),
            onMemo: (index, memo) => onChange({ ...draft, stops: setStopMemo(draft.stops, index, memo) }),
            onRemove: (index) => onChange({ ...draft, stops: removeStop(draft.stops, index) }),
          }}
        />
      )}

      {!full && (
        <div className="diary-add">
          <button className="btn btn--primary" onClick={onAddCurrentLocation} disabled={locating}>
            <MapPin size={18} aria-hidden />
            {locating ? '찾는 중…' : '지금 여기'}
          </button>
          <button className="btn btn--ghost" onClick={onStartSearch}>
            <Search size={18} aria-hidden />
            검색
          </button>
        </div>
      )}
    </div>
  );
}

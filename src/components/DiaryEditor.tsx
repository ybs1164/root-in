import { ChevronLeft, MapPin, MapPinned, Route, Search, Share, Trash2, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { removeStop, setStopMemo } from '../domain/course';
import {
  dateKey,
  DIARY_LIMITS,
  diaryKind,
  formatDiaryDate,
  planProgress,
  setStopTime,
  sortStopsByTime,
  toggleStopChecked,
} from '../domain/diary';
import { categoryStyle, filterPins } from '../domain/pin';
import { orderByNearest } from '../domain/routeOrder';
import type { RouteInChoice } from '../hooks/useDiaryDay';
import type { PlaceRef } from '../types/course';
import type { DiaryDraft } from '../types/diary';
import type { Pin, PinCategory } from '../types/pin';
import CategoryChips from './CategoryChips';
import DiaryTimeline from './DiaryTimeline';
import { WishStar } from './icons';

interface DiaryEditorProps {
  draft: DiaryDraft;
  wished: boolean;
  locating: boolean;
  routeInChoice: RouteInChoice | null;
  pins: Pin[];
  categories: PinCategory[];
  onChange: (draft: DiaryDraft) => void;
  onBack: () => void;
  onShare: () => void;
  onDelete: () => void;
  onToggleWish: () => void;
  onFocusStop: (index: number) => void;
  onStartSearch: () => void;
  onRouteIn: () => void;
  onConfirmRouteIn: (place: PlaceRef) => void;
  onCancelRouteIn: () => void;
  onAddPlace: (place: PlaceRef) => void;
}

/** One day: a record (time · place · one line) or a plan to check off. Saves itself (see useDiaryDay). */
export default function DiaryEditor({
  draft,
  wished,
  locating,
  routeInChoice,
  pins,
  categories,
  onChange,
  onBack,
  onShare,
  onDelete,
  onToggleWish,
  onFocusStop,
  onStartSearch,
  onRouteIn,
  onConfirmRouteIn,
  onCancelRouteIn,
  onAddPlace,
}: DiaryEditorProps) {
  const [pickingPin, setPickingPin] = useState(false);
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const full = draft.stops.length >= DIARY_LIMITS.maxStops;
  const empty = draft.stops.length === 0;
  const plan = diaryKind(draft) === 'plan';
  const isToday = draft.date === dateKey();
  const progress = planProgress(draft.stops);

  const suggestOrder = () => {
    const order = orderByNearest(draft.stops.map((s) => s.place.center));
    onChange({ ...draft, stops: order.map((i) => draft.stops[i]) });
  };

  return (
    <div className="diary">
      <div className="diary-bar">
        <button className="icon-btn" aria-label="달력" onClick={onBack}>
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
          <button className="icon-btn icon-btn--danger" aria-label="이 날 삭제" onClick={onDelete}>
            <Trash2 size={20} aria-hidden />
          </button>
        )}
      </div>

      {/* Past days are records; today can go either way; the future is plan-only. */}
      {draft.date >= dateKey() && (
        <div className="segmented" role="radiogroup" aria-label="종류">
          <button role="radio" aria-checked={!plan} className={!plan ? 'is-on' : ''} onClick={() => onChange({ ...draft, kind: undefined })} disabled={draft.date > dateKey()}>
            기록
          </button>
          <button role="radio" aria-checked={plan} className={plan ? 'is-on' : ''} onClick={() => onChange({ ...draft, kind: 'plan' })}>
            계획
          </button>
        </div>
      )}

      {plan && progress.total > 0 && (
        <p className="summary-line">
          방문 {progress.done}/{progress.total} · 루트-인하면 가까운 계획 장소가 체크돼요
        </p>
      )}

      {routeInChoice && (
        <div className="route-in" role="dialog" aria-label="어디에 계신가요?">
          <div className="route-in__head">
            <strong>어디에 계신가요?</strong>
            <button className="icon-btn" aria-label="루트-인 취소" onClick={onCancelRouteIn}>
              <X size={20} aria-hidden />
            </button>
          </div>
          {routeInChoice.nearby.map((place) => (
            <button key={place.id} className="pin-row" onClick={() => onConfirmRouteIn(place)}>
              <span className="pin-badge" aria-hidden>
                📍
              </span>
              <span className="pin-row__text">
                <strong>{place.name}</strong>
                <span>{[place.category, place.address].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          <button className="btn btn--ghost btn--block" onClick={() => onConfirmRouteIn(routeInChoice.here)}>
            현재 위치 그대로 남기기
          </button>
        </div>
      )}

      {empty ? (
        <p className="diary-empty">{plan ? '가고 싶은 곳을 담아 하루를 짜 보세요.' : '지금 있는 곳부터 남겨 보세요.'}</p>
      ) : (
        <DiaryTimeline
          stops={draft.stops}
          onFocusStop={onFocusStop}
          edit={{
            onTime: (index, time) => onChange({ ...draft, stops: setStopTime(draft.stops, index, time) }),
            // A plan keeps the order the user chose; a record follows the clock.
            onTimeCommit: () => !plan && onChange({ ...draft, stops: sortStopsByTime(draft.stops) }),
            onMemo: (index, memo) => onChange({ ...draft, stops: setStopMemo(draft.stops, index, memo) }),
            onRemove: (index) => onChange({ ...draft, stops: removeStop(draft.stops, index) }),
            onToggleCheck: plan ? (index) => onChange({ ...draft, stops: toggleStopChecked(draft.stops, index) }) : undefined,
          }}
        />
      )}

      {plan && draft.stops.length >= 3 && (
        <button className="pill pill--block" onClick={suggestOrder}>
          <Route size={16} aria-hidden />
          가까운 순서로 정리
        </button>
      )}

      {pickingPin && (
        <div className="pin-picker">
          <CategoryChips
            categories={categories}
            selected={pinFilter}
            allLabel="전체"
            label="핀 카테고리"
            onPick={(id) => setPinFilter(id === '' || id === pinFilter ? null : id)}
          />
          <ul className="pin-list pin-list--compact">
            {filterPins(pins, categories, pinFilter).map((pin) => {
              const style = categoryStyle(categories, pin.categoryId);
              return (
                <li key={pin.id}>
                  <button className="pin-row" disabled={full} onClick={() => onAddPlace(pin.place)}>
                    <span className="pin-badge" style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties} aria-hidden>
                      {style.emoji}
                    </span>
                    <span className="pin-row__text">
                      <strong>{pin.place.name}</strong>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!full && (
        <div className="diary-add">
          {isToday && (
            <button className="btn btn--primary" onClick={onRouteIn} disabled={locating}>
              <MapPin size={18} aria-hidden />
              {locating ? '찾는 중…' : '루트-인'}
            </button>
          )}
          <button className="btn btn--ghost" onClick={onStartSearch}>
            <Search size={18} aria-hidden />
            검색
          </button>
          {pins.length > 0 && (
            <button className={`btn ${pickingPin ? 'btn--secondary' : 'btn--ghost'}`} aria-pressed={pickingPin} onClick={() => setPickingPin((v) => !v)}>
              <MapPinned size={18} aria-hidden />
              핀에서
            </button>
          )}
        </div>
      )}
    </div>
  );
}

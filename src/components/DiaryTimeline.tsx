import { Check, X } from 'lucide-react';
import { DIARY_LIMITS } from '../domain/diary';
import type { DiaryStop } from '../types/diary';

interface DiaryTimelineProps {
  stops: DiaryStop[];
  onFocusStop: (index: number) => void;
  /** Omit for a read-only timeline. */
  edit?: {
    onTime: (index: number, time: string) => void;
    /** Called when a time input loses focus, so reordering doesn't jump while typing. */
    onTimeCommit: () => void;
    onMemo: (index: number, memo: string) => void;
    onRemove: (index: number) => void;
    /** Planned days: stops are checked off as they are visited. */
    onToggleCheck?: (index: number) => void;
  };
}

/** A day as "time · place · one line" — nothing else. */
export default function DiaryTimeline({ stops, onFocusStop, edit }: DiaryTimelineProps) {
  return (
    <ol className="timeline">
      {stops.map((stop, index) => (
        <li key={`${stop.place.id}-${index}`} className={`timeline__item stop-list__item ${stop.checked ? 'timeline__item--done' : ''}`}>
          {edit?.onToggleCheck && (
            <button
              className={`check-btn ${stop.checked ? 'is-on' : ''}`}
              aria-pressed={Boolean(stop.checked)}
              aria-label={`${stop.place.name} ${stop.checked ? '방문 취소' : '방문함'}`}
              onClick={() => edit.onToggleCheck?.(index)}
            >
              <Check size={18} aria-hidden />
            </button>
          )}
          {edit ? (
            <input
              type="time"
              className="timeline__time"
              value={stop.time ?? ''}
              aria-label={`${stop.place.name} 시간`}
              onChange={(e) => edit.onTime(index, e.target.value)}
              onBlur={edit.onTimeCommit}
            />
          ) : (
            <span className="timeline__time">{stop.time ?? ''}</span>
          )}
          <div className="timeline__body">
            <button className="timeline__name" onClick={() => onFocusStop(index)}>
              <span className="timeline__num" aria-hidden>
                {index + 1}
              </span>
              {stop.place.name}
            </button>
            {edit ? (
              <input
                className="timeline__memo"
                value={stop.memo ?? ''}
                maxLength={DIARY_LIMITS.memo}
                placeholder="한 줄"
                aria-label={`${stop.place.name} 메모`}
                onChange={(e) => edit.onMemo(index, e.target.value)}
              />
            ) : (
              stop.memo && <p className="timeline__note">{stop.memo}</p>
            )}
          </div>
          {edit && (
            <button className="icon-btn timeline__remove" aria-label={`${stop.place.name} 빼기`} onClick={() => edit.onRemove(index)}>
              <X size={18} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

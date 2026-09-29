import { COURSE_LIMITS } from '../domain/course';
import { estimateCourse, formatMeters, formatMinutes } from '../domain/geo';
import { kakaoDirectionsUrl, kakaoPlaceUrl } from '../lib/directionsLink';
import { TRAVEL_MODE_LABELS, type CourseStop, type TravelMode } from '../types/course';

interface StopListProps {
  stops: CourseStop[];
  travelMode: TravelMode;
  /** Omit for a read-only list (shared course view). */
  edit?: {
    onMove: (from: number, to: number) => void;
    onRemove: (index: number) => void;
    onMemo: (index: number, memo: string) => void;
  };
  onFocusStop?: (index: number) => void;
}

export default function StopList({ stops, travelMode, edit, onFocusStop }: StopListProps) {
  const { legs } = estimateCourse(
    stops.map((s) => s.place.center),
    travelMode,
  );

  return (
    <ol className="stop-list">
      {stops.map((stop, index) => (
        <li key={`${stop.place.id}-${index}`} className="stop-list__item">
          <div className="stop">
            <button className="stop__num" onClick={() => onFocusStop?.(index)} aria-label={`${index + 1}번 장소 지도에서 보기`}>
              {index + 1}
            </button>
            <div className="stop__body">
              <div className="stop__head">
                <div className="stop__title">
                  <strong>{stop.place.name}</strong>
                  {stop.place.category && <span className="stop__cat">{stop.place.category}</span>}
                </div>
                {edit ? (
                  <div className="stop__tools">
                    <button
                      className="icon-btn"
                      aria-label="위로"
                      disabled={index === 0}
                      onClick={() => edit.onMove(index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="아래로"
                      disabled={index === stops.length - 1}
                      onClick={() => edit.onMove(index, index + 1)}
                    >
                      ↓
                    </button>
                    <button className="icon-btn icon-btn--danger" aria-label="삭제" onClick={() => edit.onRemove(index)}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <a className="text-link" href={kakaoPlaceUrl(stop.place)} target="_blank" rel="noreferrer">
                    정보
                  </a>
                )}
              </div>
              {stop.place.address && <p className="stop__addr">{stop.place.address}</p>}
              {edit ? (
                <input
                  className="stop__memo-input"
                  value={stop.memo ?? ''}
                  maxLength={COURSE_LIMITS.memo}
                  placeholder="한 줄 메모 (예: 창가 자리 추천)"
                  onChange={(e) => edit.onMemo(index, e.target.value)}
                />
              ) : (
                stop.memo && <p className="stop__memo">“{stop.memo}”</p>
              )}
            </div>
          </div>
          {legs[index] && (
            <div className="leg">
              <span className="leg__line" aria-hidden />
              <span className="leg__text">
                {TRAVEL_MODE_LABELS[travelMode]} 약 {formatMinutes(legs[index].minutes)} · {formatMeters(legs[index].meters)}
              </span>
              <a
                className="leg__link"
                href={kakaoDirectionsUrl(stop.place, stops[index + 1].place, travelMode)}
                target="_blank"
                rel="noreferrer"
              >
                길찾기 ↗
              </a>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function CourseSummary({ stops, travelMode }: { stops: CourseStop[]; travelMode: TravelMode }) {
  if (stops.length < 2) return <span>{stops.length}곳</span>;
  const { total } = estimateCourse(
    stops.map((s) => s.place.center),
    travelMode,
  );
  return (
    <span>
      {stops.length}곳 · {TRAVEL_MODE_LABELS[travelMode]} 약 {formatMinutes(total.minutes)} · {formatMeters(total.meters)}
    </span>
  );
}

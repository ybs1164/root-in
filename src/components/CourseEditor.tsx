import {
  COURSE_LIMITS,
  COURSE_PROBLEM_MESSAGES,
  COURSE_THEMES,
  defaultTitle,
  moveStop,
  removeStop,
  setStopMemo,
  TRAVEL_MODES,
  validateCourse,
} from '../domain/course';
import { THEME_LABELS, TRAVEL_MODE_LABELS, type CourseDraft } from '../types/course';
import StopList, { CourseSummary } from './StopList';

interface CourseEditorProps {
  draft: CourseDraft;
  onChange: (draft: CourseDraft) => void;
  onSave: () => void;
  onShare: () => void;
  onReset: () => void;
  onFocusStop: (index: number) => void;
  onStartSearch: () => void;
  dirty: boolean;
}

export default function CourseEditor({
  draft,
  onChange,
  onSave,
  onShare,
  onReset,
  onFocusStop,
  onStartSearch,
  dirty,
}: CourseEditorProps) {
  const problems = validateCourse(draft);
  const canSave = problems.length === 0;

  return (
    <div className="editor">
      <input
        className="title-input"
        value={draft.title}
        maxLength={COURSE_LIMITS.title}
        placeholder={defaultTitle(draft.stops)}
        aria-label="코스 이름"
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />

      <div className="chip-row" role="radiogroup" aria-label="테마">
        {COURSE_THEMES.map((theme) => (
          <button
            key={theme}
            role="radio"
            aria-checked={draft.theme === theme}
            className={`chip ${draft.theme === theme ? 'chip--on' : ''}`}
            onClick={() => onChange({ ...draft, theme })}
          >
            {THEME_LABELS[theme]}
          </button>
        ))}
      </div>

      <div className="segmented" role="radiogroup" aria-label="이동수단">
        {TRAVEL_MODES.map((mode) => (
          <button
            key={mode}
            role="radio"
            aria-checked={draft.travelMode === mode}
            className={draft.travelMode === mode ? 'is-on' : ''}
            onClick={() => onChange({ ...draft, travelMode: mode })}
          >
            {TRAVEL_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {draft.stops.length === 0 ? (
        <button className="empty-state" onClick={onStartSearch}>
          <span className="empty-state__icon" aria-hidden>
            📍
          </span>
          <strong>첫 장소를 검색해 보세요</strong>
          <span>카페, 식당, 공원… 가는 순서대로 추가하면 코스가 됩니다.</span>
        </button>
      ) : (
        <>
          <p className="summary-line">
            <CourseSummary stops={draft.stops} travelMode={draft.travelMode} />
          </p>
          <StopList
            stops={draft.stops}
            travelMode={draft.travelMode}
            onFocusStop={onFocusStop}
            edit={{
              onMove: (from, to) => onChange({ ...draft, stops: moveStop(draft.stops, from, to) }),
              onRemove: (index) => onChange({ ...draft, stops: removeStop(draft.stops, index) }),
              onMemo: (index, memo) => onChange({ ...draft, stops: setStopMemo(draft.stops, index, memo) }),
            }}
          />
          {draft.stops.length < COURSE_LIMITS.maxStops && (
            <button className="add-more" onClick={onStartSearch}>
              ＋ 장소 추가
            </button>
          )}
        </>
      )}

      {!canSave && draft.stops.length > 0 && <p className="hint">{COURSE_PROBLEM_MESSAGES[problems[0]]}</p>}
      <p className="hint hint--muted">시간은 직선거리로 계산한 추정치예요. 정확한 경로는 구간별 "길찾기"로 확인하세요.</p>

      <div className="action-bar">
        <button className="btn btn--ghost" onClick={onReset} disabled={draft.stops.length === 0 && !draft.id}>
          새 코스
        </button>
        <button className="btn btn--secondary" onClick={onSave} disabled={!canSave || !dirty}>
          {draft.id ? (dirty ? '변경 저장' : '저장됨') : '저장'}
        </button>
        <button className="btn btn--primary" onClick={onShare} disabled={!canSave}>
          공유
        </button>
      </div>
    </div>
  );
}

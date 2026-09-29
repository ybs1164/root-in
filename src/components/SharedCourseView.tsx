import { THEME_LABELS, type SharedCourse } from '../types/course';
import StopList, { CourseSummary } from './StopList';

interface SharedCourseViewProps {
  course: SharedCourse;
  saved: boolean;
  onSave: () => void;
  onEditCopy: () => void;
  onClose: () => void;
  onFocusStop: (index: number) => void;
}

export default function SharedCourseView({ course, saved, onSave, onEditCopy, onClose, onFocusStop }: SharedCourseViewProps) {
  return (
    <div className="shared">
      <p className="shared__from">
        <span className={`badge badge--${course.theme}`}>{THEME_LABELS[course.theme]}</span>
        {course.sharedBy ? `${course.sharedBy}님이 공유한 코스` : '공유받은 코스'}
      </p>
      <h2 className="shared__title">{course.title}</h2>
      <p className="summary-line">
        <CourseSummary stops={course.stops} travelMode={course.travelMode} />
      </p>
      {course.note && <p className="shared__note">{course.note}</p>}

      <StopList stops={course.stops} travelMode={course.travelMode} onFocusStop={onFocusStop} />

      <div className="action-bar">
        <button className="btn btn--ghost" onClick={onClose}>
          닫기
        </button>
        <button className="btn btn--secondary" onClick={onEditCopy}>
          수정해서 쓰기
        </button>
        <button className="btn btn--primary" onClick={onSave} disabled={saved}>
          {saved ? '저장됨 ✓' : '내 코스에 저장'}
        </button>
      </div>
    </div>
  );
}

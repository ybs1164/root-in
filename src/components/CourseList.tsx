import { THEME_LABELS, type Course } from '../types/course';
import { CourseSummary } from './StopList';

interface CourseListProps {
  courses: Course[];
  activeId?: string;
  onOpen: (course: Course) => void;
  onRemove: (course: Course) => void;
  onCreate: () => void;
}

export default function CourseList({ courses, activeId, onOpen, onRemove, onCreate }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <button className="empty-state" onClick={onCreate}>
        <span className="empty-state__icon" aria-hidden>
          🗺️
        </span>
        <strong>아직 저장한 코스가 없어요</strong>
        <span>코스를 만들거나, 공유받은 링크에서 저장해 보세요.</span>
      </button>
    );
  }

  return (
    <ul className="course-list">
      {courses.map((course) => (
        <li key={course.id} className={`course-card ${course.id === activeId ? 'course-card--active' : ''}`}>
          <button className="course-card__main" onClick={() => onOpen(course)}>
            <span className="course-card__badges">
              <span className={`badge badge--${course.theme}`}>{THEME_LABELS[course.theme]}</span>
              {course.sharedBy && <span className="badge badge--shared">{course.sharedBy}님 공유</span>}
            </span>
            <strong className="course-card__title">{course.title}</strong>
            <span className="course-card__stops">{course.stops.map((s) => s.place.name).join(' → ')}</span>
            <span className="course-card__meta">
              <CourseSummary stops={course.stops} travelMode={course.travelMode} />
            </span>
          </button>
          <button
            className="icon-btn icon-btn--danger"
            aria-label={`${course.title} 삭제`}
            onClick={() => {
              if (window.confirm(`"${course.title}" 코스를 삭제할까요?`)) onRemove(course);
            }}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

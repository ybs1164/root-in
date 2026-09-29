import type { ComponentProps } from 'react';
import type { useCourseDraft } from '../hooks/useCourseDraft';
import CourseEditor from './CourseEditor';
import CourseList from './CourseList';
import PinsPanel from './PinsPanel';

export type PinsSub = 'pins' | 'edit' | 'list';

interface PinsSheetProps {
  sub: PinsSub;
  onSub: (sub: PinsSub) => void;
  pinCount: number;
  course: ReturnType<typeof useCourseDraft>;
  panel: ComponentProps<typeof PinsPanel>;
  onSaveCourse: () => void;
  onShareCourse: () => void;
  onRemoveCourse: ComponentProps<typeof CourseList>['onRemove'];
  onFocusStop: (index: number) => void;
  onStartSearch: () => void;
}

/** 📍 home tab: my pins, the course being built from them, and saved courses. */
export default function PinsSheet({
  sub,
  onSub,
  pinCount,
  course,
  panel,
  onSaveCourse,
  onShareCourse,
  onRemoveCourse,
  onFocusStop,
  onStartSearch,
}: PinsSheetProps) {
  const { draft, courses } = course;
  const tab = (value: PinsSub, label: string, count: number) => (
    <button role="tab" aria-selected={sub === value} className={sub === value ? 'is-on' : ''} onClick={() => onSub(value)}>
      {label}
      {count > 0 && <span className="tabs__count">{count}</span>}
    </button>
  );

  return (
    <>
      <div className="tabs" role="tablist">
        {tab('pins', '내 핀', pinCount)}
        {tab('edit', draft.id ? '코스 편집' : '코스 짜기', draft.stops.length)}
        {tab('list', '내 코스', courses.length)}
      </div>
      <div className="sheet__content">
        {sub === 'pins' ? (
          <PinsPanel {...panel} />
        ) : sub === 'edit' ? (
          <CourseEditor
            draft={draft}
            dirty={course.dirty}
            onChange={course.setDraft}
            onSave={onSaveCourse}
            onShare={onShareCourse}
            onReset={course.resetDraft}
            onFocusStop={onFocusStop}
            onStartSearch={onStartSearch}
          />
        ) : (
          <CourseList
            courses={courses}
            activeId={draft.id}
            onOpen={(c) => {
              if (course.openCourse(c)) onSub('edit');
            }}
            onRemove={onRemoveCourse}
            onCreate={() => {
              onSub('edit');
              onStartSearch();
            }}
          />
        )}
      </div>
    </>
  );
}

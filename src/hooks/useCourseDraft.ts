import { useCallback, useState } from 'react';
import { emptyDraft } from '../domain/course';
import type { Course, CourseDraft } from '../types/course';
import { useCourses } from './useCourses';

const toDraft = (course: Course): CourseDraft => ({
  id: course.id,
  title: course.title,
  theme: course.theme,
  travelMode: course.travelMode,
  stops: course.stops,
  note: course.note,
  sharedBy: course.sharedBy,
});

const draftKey = (draft: CourseDraft) =>
  JSON.stringify([draft.title.trim(), draft.theme, draft.travelMode, draft.stops, draft.note ?? '']);

/** The course being edited, plus the saved-course list it is compared with. */
export function useCourseDraft() {
  const { courses, save, remove } = useCourses();
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const dirty = savedKey !== draftKey(draft);
  const hasUnsaved = dirty && draft.stops.length > 0;

  const saveDraft = useCallback(async () => {
    const saved = await save(draft);
    const next = toDraft(saved);
    setDraft(next);
    setSavedKey(draftKey(next));
  }, [draft, save]);

  /** Replaces the draft; asks first when that would drop unsaved stops. Returns false if the user declined. */
  const replaceDraft = useCallback(
    (next: CourseDraft, { saved = false, question = '저장하지 않은 변경이 있어요. 계속할까요?' } = {}) => {
      // Re-opening the course already in the editor keeps nothing to lose.
      const sameCourse = next.id !== undefined && next.id === draft.id;
      if (hasUnsaved && !sameCourse && !window.confirm(question)) return false;
      setDraft(next);
      setSavedKey(saved ? draftKey(next) : null);
      return true;
    },
    [hasUnsaved, draft.id],
  );

  const openCourse = useCallback(
    (course: Course) => replaceDraft(toDraft(course), { saved: true, question: '저장하지 않은 변경이 있어요. 이 코스를 열까요?' }),
    [replaceDraft],
  );

  const resetDraft = useCallback(
    () => replaceDraft(emptyDraft(), { question: '저장하지 않은 변경이 있어요. 새 코스를 시작할까요?' }),
    [replaceDraft],
  );

  const removeCourse = useCallback(
    async (course: Course) => {
      await remove(course.id);
      if (draft.id === course.id) setSavedKey(null);
    },
    [remove, draft.id],
  );

  return { courses, save, draft, setDraft, dirty, saveDraft, replaceDraft, openCourse, resetDraft, removeCourse };
}

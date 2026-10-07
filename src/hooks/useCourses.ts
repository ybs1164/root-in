import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUserId } from '../lib/currentUser';
import { courseRepository, type CourseRepository } from '../services/courseRepository';
import { onPulled } from '../services/syncBus';
import type { Course, CourseDraft } from '../types/course';

export function useCourses(repository: CourseRepository = courseRepository) {
  const userId = useMemo(getCurrentUserId, []);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      repository.listByUser(userId).then((list) => {
        if (!cancelled) setCourses(list);
      });
    void load();
    const stop = onPulled((changed) => {
      if (changed.has('routes')) void load();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [repository, userId]);

  const save = useCallback(
    async (draft: CourseDraft) => {
      const saved = await repository.save(userId, draft);
      setCourses((prev) => (prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]));
      return saved;
    },
    [repository, userId],
  );

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id, userId);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    },
    [repository, userId],
  );

  // Newest first reads better on a phone list.
  const sorted = useMemo(
    () => [...courses].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)),
    [courses],
  );

  return { courses: sorted, save, remove };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUserId } from '../lib/currentUser';
import { courseRepository, type CourseRepository } from '../services/courseRepository';
import type { Course, CourseDraft } from '../types/course';

export function useCourses(repository: CourseRepository = courseRepository) {
  const userId = useMemo(getCurrentUserId, []);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    let cancelled = false;
    repository.listByUser(userId).then((list) => {
      if (!cancelled) setCourses(list);
    });
    return () => {
      cancelled = true;
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

  const countShare = useCallback(
    async (id: string) => {
      const shared = await repository.countShare(id, userId);
      if (shared) setCourses((prev) => prev.map((c) => (c.id === id ? shared : c)));
    },
    [repository, userId],
  );

  // Newest first reads better on a phone list.
  const sorted = useMemo(
    () => [...courses].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)),
    [courses],
  );

  return { courses: sorted, save, remove, countShare };
}

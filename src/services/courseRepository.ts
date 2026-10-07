import { defaultTitle } from '../domain/course';
import { cleanRouteLook } from '../domain/routeStyle';
import type { Course, CourseDraft } from '../types/course';
import type { TravelRoute } from '../types/travelRoute';

const STORAGE_KEY = 'goodroot:courses:v2';
const LEGACY_ROUTES_KEY = 'goodroot:travel-routes:v1';

/**
 * Same seam as the old TravelRouteRepository: callers only see this
 * interface, so a server-backed implementation can replace localStorage
 * without touching hooks/components.
 */
export interface CourseRepository {
  listByUser(userId: string): Promise<Course[]>;
  listAll(): Promise<Course[]>;
  /** Creates a course, or updates it when `draft.id` belongs to this user. */
  save(userId: string, draft: CourseDraft): Promise<Course>;
  remove(id: string, userId: string): Promise<void>;
}

/**
 * A share count worth keeping: a whole number of 1 or more, within reason.
 * It is how many times other people opened this route's link — counted by a
 * server once there is one; nothing in the app raises it yet.
 */
const cleanShareCount = (n: unknown): { shareCount?: number } =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 ? { shareCount: Math.min(n, 1_000_000_000) } : {};

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `course-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// v1 stored single origin→destination routes; each becomes a 2-stop course.
const fromLegacyRoute = (route: TravelRoute): Course => ({
  id: route.id,
  userId: route.userId,
  title: route.title,
  theme: 'trip',
  travelMode: 'drive',
  stops: [{ place: route.origin }, { place: route.destination }],
  note: route.note,
  sharedBy: route.sharedBy,
  createdAt: route.createdAt,
});

export class LocalCourseRepository implements CourseRepository {
  private read(): Course[] {
    this.migrateLegacy();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Course[]) : [];
    } catch {
      return [];
    }
  }

  private write(courses: Course[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch {
      // Storage full/disabled: in-memory state still shows the change until reload.
    }
  }

  private migrateLegacy(): void {
    try {
      const legacyRaw = window.localStorage.getItem(LEGACY_ROUTES_KEY);
      if (legacyRaw === null) return;
      const legacy = JSON.parse(legacyRaw) as TravelRoute[];
      const currentRaw = window.localStorage.getItem(STORAGE_KEY);
      const current = currentRaw ? (JSON.parse(currentRaw) as Course[]) : [];
      const known = new Set(current.map((course) => course.id));
      const migrated = Array.isArray(legacy) ? legacy.filter((r) => !known.has(r.id)).map(fromLegacyRoute) : [];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, ...migrated]));
      window.localStorage.removeItem(LEGACY_ROUTES_KEY);
    } catch {
      // Leave the v1 key in place so a later load can retry.
    }
  }

  async listByUser(userId: string): Promise<Course[]> {
    return this.read().filter((course) => course.userId === userId);
  }

  async listAll(): Promise<Course[]> {
    return this.read();
  }

  async save(userId: string, draft: CourseDraft): Promise<Course> {
    const courses = this.read();
    const now = new Date().toISOString();
    const existing = draft.id ? courses.find((c) => c.id === draft.id && c.userId === userId) : undefined;
    const course: Course = {
      id: existing?.id ?? generateId(),
      userId,
      title: draft.title.trim() || defaultTitle(draft.stops),
      theme: draft.theme,
      travelMode: draft.travelMode,
      stops: draft.stops,
      note: draft.note?.trim() || undefined,
      sharedBy: draft.sharedBy?.trim() || undefined,
      ...cleanRouteLook(draft, draft.stops.length),
      ...cleanShareCount(draft.shareCount ?? existing?.shareCount),
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
    };
    this.write(existing ? courses.map((c) => (c.id === course.id ? course : c)) : [...courses, course]);
    return course;
  }

  async remove(id: string, userId: string): Promise<void> {
    this.write(this.read().filter((course) => !(course.id === id && course.userId === userId)));
  }
}

export const courseRepository: CourseRepository = new LocalCourseRepository();

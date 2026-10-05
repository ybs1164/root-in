import type { CourseStop, TravelMode } from './course';

export type DiaryMood = 'great' | 'good' | 'soso' | 'tired';

export const MOOD_LABELS: Record<DiaryMood, { emoji: string; label: string }> = {
  great: { emoji: '😆', label: '최고' },
  good: { emoji: '🙂', label: '좋음' },
  soso: { emoji: '😐', label: '그럭저럭' },
  tired: { emoji: '😮‍💨', label: '피곤' },
};

/** A place visited that day; `time` is local 'HH:MM' when the user noted it. */
export interface DiaryStop extends CourseStop {
  time?: string;
  /** On a planned day: this stop was visited (route-in). */
  checked?: boolean;
}

/**
 * 'plan' = a day laid out ahead of time (stops are to-dos, checked off by
 * route-in); 'log' = a record of where I went. Entries saved before plans
 * existed have no kind and read as 'log'.
 */
export type DiaryKind = 'plan' | 'log';

/** One day's route, written like a diary page. */
export interface DiaryEntry {
  id: string;
  userId: string;
  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string;
  kind?: DiaryKind;
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  /** Free-form diary text. */
  text?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DiaryDraft {
  id?: string;
  date: string;
  kind?: DiaryKind;
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  text?: string;
}

/** Self-contained snapshot carried by a `#diary=…` link. */
export interface SharedDiary {
  date: string;
  kind?: DiaryKind;
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  text?: string;
  sharedBy?: string;
  sharedAt: string;
}

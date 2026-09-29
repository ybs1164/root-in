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
}

/** One day's route, written like a diary page. */
export interface DiaryEntry {
  id: string;
  userId: string;
  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string;
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
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  text?: string;
}

/** Self-contained snapshot carried by a `#diary=…` link. */
export interface SharedDiary {
  date: string;
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  text?: string;
  sharedBy?: string;
  sharedAt: string;
}

/**
 * A daily route kept in the wishlist ("다시 가고 싶은 하루"). It is a
 * snapshot, stored separately from the diary, so routes received from
 * other people can be kept without becoming part of my own diary.
 */
export interface WishItem {
  id: string;
  userId: string;
  /** Set when the item came from one of my own diary entries. */
  sourceDiaryId?: string;
  date: string;
  title: string;
  mood?: DiaryMood;
  travelMode: TravelMode;
  stops: DiaryStop[];
  text?: string;
  /** Set when the item came from someone else's share link. */
  sharedBy?: string;
  addedAt: string;
}

/** Fields a wish item copies from a diary entry or a shared diary. */
export type DiarySnapshot = Pick<DiaryEntry, 'date' | 'title' | 'mood' | 'travelMode' | 'stops' | 'text'> & {
  sharedBy?: string;
};

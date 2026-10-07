import type { RouteEdgeStyle, RouteStopShape } from '../domain/routeStyle';
import type { PlaceRef } from './travelRoute';

export type { PlaceRef };

export type CourseTheme = 'date' | 'trip' | 'food' | 'etc';
export type TravelMode = 'walk' | 'transit' | 'drive';

export const THEME_LABELS: Record<CourseTheme, string> = {
  date: '데이트',
  trip: '여행',
  food: '맛집',
  etc: '기타',
};

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walk: '도보',
  transit: '대중교통',
  drive: '자동차',
};

export interface CourseStop {
  place: PlaceRef;
  memo?: string;
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  theme: CourseTheme;
  travelMode: TravelMode;
  stops: CourseStop[];
  note?: string;
  /** Set when this course was saved from someone else's share link. */
  sharedBy?: string;
  /** How it is drawn on the map (long-press a stop or a line); see domain/routeStyle. */
  stopShapes?: (RouteStopShape | null)[];
  edgeStyles?: (RouteEdgeStyle | null)[];
  /** How many times other people have opened this route's share link (absent = none yet; needs a server to count). */
  shareCount?: number;
  createdAt: string;
  updatedAt?: string;
}

/** What the editor works on before a course is saved (no id/owner yet). */
export interface CourseDraft {
  id?: string;
  title: string;
  theme: CourseTheme;
  travelMode: TravelMode;
  stops: CourseStop[];
  note?: string;
  sharedBy?: string;
  /** Carried through edits; absent keeps the saved count. */
  shareCount?: number;
  stopShapes?: (RouteStopShape | null)[];
  edgeStyles?: (RouteEdgeStyle | null)[];
}

/** Self-contained snapshot carried by a share link. */
export interface SharedCourse {
  title: string;
  theme: CourseTheme;
  travelMode: TravelMode;
  stops: CourseStop[];
  note?: string;
  sharedBy?: string;
  sharedAt: string;
}

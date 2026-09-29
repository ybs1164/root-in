import { defaultTitle } from '../domain/course';
import { defaultDiaryTitle, diaryHeading, formatDiaryDate } from '../domain/diary';
import type { CourseDraft, SharedCourse } from '../types/course';
import type { DiaryDraft, SharedDiary } from '../types/diary';
import type { SharedPinSet } from '../types/pin';
import { courseShareService, encodeSharedCourse, formatCourseShareText } from './courseShareService';
import { diaryShareService, encodeSharedDiary, formatDiaryShareText } from './diaryShareService';
import { encodeSharedPinSet, formatPinSetShareText, pinShareService } from './pinShareService';

// One share sheet for every link type (plan P5). Each kind keeps its own
// link format (`#share=`, `#diary=`, `#pins=`), so old links keep working;
// only the sheet is shared.

export type ShareTarget =
  | { kind: 'course'; draft: CourseDraft }
  | { kind: 'day'; draft: DiaryDraft }
  | { kind: 'pins'; set: SharedPinSet; dropped?: number };

export interface SharePlan {
  heading: string;
  title: string;
  /** One line under the title: the places, in order. */
  summary: string;
  /** Shown when something had to be left out of the link. */
  notice?: string;
  createUrl(): Promise<string>;
  text(url: string): string;
}

const clean = (name: string) => name.trim() || undefined;

export function planShare(target: ShareTarget, sharedBy: string, now: string = new Date().toISOString()): SharePlan {
  const by = clean(sharedBy);
  if (target.kind === 'course') {
    const { draft } = target;
    const course: SharedCourse = {
      title: draft.title.trim() || defaultTitle(draft.stops),
      theme: draft.theme,
      travelMode: draft.travelMode,
      stops: draft.stops,
      note: draft.note,
      sharedBy: by,
      sharedAt: now,
    };
    return {
      heading: '코스 공유',
      title: course.title,
      summary: course.stops.map((s, i) => `${i + 1}. ${s.place.name}`).join('  '),
      notice: encodeSharedCourse(course).memosTrimmed ? '링크가 너무 길어 장소별 메모는 빠졌어요.' : undefined,
      createUrl: () => courseShareService.createShareUrl(course),
      text: (url) => formatCourseShareText(course, url),
    };
  }
  if (target.kind === 'day') {
    const { draft } = target;
    const plan = draft.kind === 'plan';
    const diary: SharedDiary = {
      date: draft.date,
      title: draft.title.trim() || defaultDiaryTitle(draft),
      travelMode: draft.travelMode,
      // A plan is a suggestion for someone else's day: leave out my check-ins.
      stops: plan ? draft.stops.map(({ checked: _c, time: _t, ...stop }) => stop) : draft.stops,
      sharedBy: by,
      sharedAt: now,
    };
    if (plan) diary.kind = 'plan';
    return {
      heading: `${formatDiaryDate(draft.date)} ${plan ? '계획' : '루트'} 공유`,
      title: diaryHeading(diary),
      summary: diary.stops.map((s, i) => `${i + 1}. ${s.time && !plan ? `${s.time} ` : ''}${s.place.name}`).join('  '),
      notice: encodeSharedDiary(diary).trimmed !== 'none' ? '링크가 길어 메모는 빠졌어요.' : undefined,
      createUrl: () => diaryShareService.createShareUrl(diary),
      text: (url) => formatDiaryShareText(diary, url),
    };
  }
  const set: SharedPinSet = { ...target.set, sharedBy: by, sharedAt: now };
  const encoded = encodeSharedPinSet(set);
  const dropped = (target.dropped ?? 0) + encoded.dropped;
  const notices = [
    dropped > 0 ? `핀은 30개까지만 공유돼요 (${dropped}개 제외).` : '',
    encoded.trimmed === 'memos' ? '링크가 길어 메모는 빠졌어요.' : '',
    encoded.trimmed === 'memos-and-addresses' ? '링크가 길어 메모와 주소는 빠졌어요.' : '',
  ].filter(Boolean);
  return {
    heading: '핀셋 공유',
    title: set.title,
    summary: `${set.pins.length}곳 · ${set.categories.map((c) => c.name).join(', ')}`,
    notice: notices.join(' ') || undefined,
    createUrl: () => pinShareService.createShareUrl(set),
    text: (url) => formatPinSetShareText(set, url),
  };
}

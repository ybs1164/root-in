import type { ReactNode } from 'react';
import { formatDiaryDate } from '../domain/diary';
import type { DiarySnapshot } from '../types/diary';
import DiaryTimeline from './DiaryTimeline';

interface DiaryViewProps {
  diary: DiarySnapshot;
  onFocusStop: (index: number) => void;
  /** Leading button (back / close). */
  lead: ReactNode;
  /** Trailing icon buttons in the top bar. */
  tools?: ReactNode;
  /** Optional full-width button under the timeline. */
  footer?: ReactNode;
}

/** Read-only day (received link, wishlist item). */
export default function DiaryView({ diary, onFocusStop, lead, tools, footer }: DiaryViewProps) {
  return (
    <div className="diary">
      <div className="diary-bar">
        {lead}
        <strong className="diary-bar__title">
          {formatDiaryDate(diary.date)}
          {diary.sharedBy && <span className="diary-bar__by"> · {diary.sharedBy}</span>}
        </strong>
        {tools}
      </div>
      <DiaryTimeline stops={diary.stops} onFocusStop={onFocusStop} />
      {footer}
    </div>
  );
}

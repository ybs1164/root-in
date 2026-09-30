import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { monthGrid, shiftMonth } from '../domain/calendar';
import { dateKey } from '../domain/diary';

interface MonthView {
  year: number;
  month: number;
}

interface MonthCalendarProps {
  counts: Map<string, number>;
  plans: Set<string>;
  onPick: (key: string) => void;
  /** Controlled month (optional); otherwise the grid keeps its own. */
  view?: MonthView;
  onView?: (view: MonthView) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** Month grid; dots under a day = places that day, one dot each. */
export default function MonthCalendar({ counts, plans, onPick, view: controlled, onView }: MonthCalendarProps) {
  const today = dateKey();
  const [own, setOwn] = useState<MonthView>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const view = controlled ?? own;
  const setView = (next: MonthView) => (onView ? onView(next) : setOwn(next));
  const days = monthGrid(view.year, view.month);

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button className="icon-btn" aria-label="이전 달" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
          <ChevronLeft size={22} aria-hidden />
        </button>
        <strong aria-live="polite">
          {view.year}년 {view.month + 1}월
        </strong>
        <button className="icon-btn" aria-label="다음 달" onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>
      <div className="calendar__grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="calendar__weekday" role="columnheader">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const count = counts.get(d.key) ?? 0;
          const label = `${d.key}${count ? `, ${count}곳` : ''}${plans.has(d.key) ? ', 계획' : ''}`;
          return (
            <button
              key={d.key}
              role="gridcell"
              aria-label={label}
              data-date={d.key}
              className={[
                'calendar__day',
                d.inMonth ? '' : 'is-out',
                d.key === today ? 'is-today' : '',
                plans.has(d.key) ? 'is-plan' : '',
              ].join(' ')}
              onClick={() => onPick(d.key)}
            >
              <span>{d.day}</span>
              <span className="calendar__dots" aria-hidden>
                {Array.from({ length: count }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

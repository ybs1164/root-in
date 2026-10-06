import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { dayDots, monthGrid, shiftMonth } from '../domain/calendar';
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
/** Space between the stacked months. */
const GAP = 28;
/** A drag this far (or a flick) moves to the month it pulls in. */
const DRAG_PX = 70;
const SLIDE_MS = 280;

/** One month's title and grid; dots under a day = places that day, one dot each (5 a row, 10 at most). */
function MonthBlock({
  view,
  counts,
  plans,
  onPick,
  side,
  onStep,
}: {
  view: MonthView;
  counts: Map<string, number>;
  plans: Set<string>;
  onPick: (key: string) => void;
  /** The faint month above (-1) or below (1), or the one in the middle (0). */
  side: -1 | 0 | 1;
  onStep: (dir: -1 | 1) => void;
}) {
  const today = dateKey();
  const days = monthGrid(view.year, view.month);
  const current = side === 0;
  return (
    <div
      className={`calendar ${current ? 'calendar--current' : `calendar--peek calendar--peek-${side < 0 ? 'above' : 'below'}`}`}
      // A faint neighbour is one big button: tapping it moves to that month.
      onClick={current ? undefined : () => onStep(side)}
      role={current ? undefined : 'button'}
      aria-label={current ? undefined : side < 0 ? '이전 달' : '다음 달'}
    >
      <div className="calendar__head">
        <strong aria-live={current ? 'polite' : undefined}>
          {view.year}년 {view.month + 1}월
        </strong>
      </div>
      <div className="calendar__grid" role={current ? 'grid' : undefined} aria-hidden={!current || undefined}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="calendar__weekday" role={current ? 'columnheader' : undefined}>
            {w}
          </span>
        ))}
        {days.map((d) => {
          const count = counts.get(d.key) ?? 0;
          const label = `${d.key}${count ? `, ${count}곳` : ''}${plans.has(d.key) ? ', 계획' : ''}`;
          return (
            <button
              key={d.key}
              role={current ? 'gridcell' : undefined}
              aria-label={label}
              data-date={current ? d.key : undefined}
              tabIndex={current ? undefined : -1}
              className={[
                'calendar__day',
                d.inMonth ? '' : 'is-out',
                d.key === today ? 'is-today' : '',
                plans.has(d.key) ? 'is-plan' : '',
              ].join(' ')}
              onClick={current ? () => onPick(d.key) : undefined}
            >
              <span>{d.day}</span>
              <span className="calendar__dots" aria-hidden>
                {Array.from({ length: dayDots(count) }, (_, i) => (
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

/**
 * The months stacked top to bottom: this month in the middle, last month
 * peeking faintly above and next month below. Tap a faint one, or drag the
 * stack down / up, and the months slide over by one.
 */
export default function MonthCalendar({ counts, plans, onPick, view: controlled, onView }: MonthCalendarProps) {
  const [own, setOwn] = useState<MonthView>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const view = controlled ?? own;
  const setView = (next: MonthView) => (onView ? onView(next) : setOwn(next));

  const curEl = useRef<HTMLDivElement | null>(null);
  // The stack's offset (px): following a finger, or sliding to the next month.
  const [shift, setShift] = useState<{ y: number; glide: boolean }>({ y: 0, glide: false });
  const sliding = useRef(false);
  // Which way a slide is going: the incoming month brightens as the current one fades.
  const [stepping, setStepping] = useState<-1 | 0 | 1>(0);
  const drag = useRef<{ id: number; y0: number; last: number; prev: number; t: number; pt: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  const step = (dir: -1 | 1) => {
    if (sliding.current) return;
    sliding.current = true;
    const h = (curEl.current?.offsetHeight ?? 360) + GAP;
    // Last month comes down from above (the stack moves down), next month up from below.
    setShift({ y: -dir * h, glide: true });
    setStepping(dir);
    window.setTimeout(() => {
      setView(shiftMonth(view.year, view.month, dir));
      setShift({ y: 0, glide: false });
      setStepping(0);
      sliding.current = false;
    }, SLIDE_MS);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (sliding.current || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = performance.now();
    drag.current = { id: e.pointerId, y0: e.clientY, last: e.clientY, prev: e.clientY, t, pt: t, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < 10) return;
    d.moved = true;
    d.prev = d.last;
    d.pt = d.t;
    d.last = e.clientY;
    d.t = performance.now();
    setShift({ y: dy, glide: false });
  };
  const onPointerEnd = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    // The drag ends in a click on whatever is under the finger: not a pick.
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 0);
    const dy = d.last - d.y0;
    const v = (d.last - d.prev) / Math.max(1, d.t - d.pt);
    if (dy > DRAG_PX || (dy > 24 && v > 0.5)) step(-1);
    else if (dy < -DRAG_PX || (dy < -24 && v < -0.5)) step(1);
    else setShift({ y: 0, glide: true });
  };

  const prev = shiftMonth(view.year, view.month, -1);
  const next = shiftMonth(view.year, view.month, 1);
  const style: CSSProperties = {
    transform: `translateY(${shift.y}px)`,
    transition: shift.glide ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
    ['--stack-gap' as string]: `${GAP}px`,
  };

  return (
    <div
      className={`calendar-stack ${stepping ? `is-stepping is-step-${stepping < 0 ? 'prev' : 'next'}` : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <MonthBlock view={prev} counts={counts} plans={plans} onPick={onPick} side={-1} onStep={step} />
      <div ref={curEl}>
        <MonthBlock view={view} counts={counts} plans={plans} onPick={onPick} side={0} onStep={step} />
      </div>
      <MonthBlock view={next} counts={counts} plans={plans} onPick={onPick} side={1} onStep={step} />
    </div>
  );
}

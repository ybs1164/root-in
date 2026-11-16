import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent } from 'react';
import { addDays, monthGrid, shiftMonth } from '../domain/calendar';
import type { ViewerItem } from './PhotoViewer';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOWS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** A sideways drag on the strip this far (px) pages a week. */
const WEEK_SWIPE_PX = 40;

const partsOf = (key: string) => key.split('-').map(Number) as [number, number, number];
const weekdayOf = (key: string) => {
  const [y, m, d] = partsOf(key);
  return new Date(y, m - 1, d).getDay();
};

/** 'TODAY' for today, else '11.9 MON' — the card's label and the empty card's date. */
export function weekCardDay(key: string, today: string): string {
  if (key === today) return 'TODAY';
  const [, m, d] = partsOf(key);
  return `${m}.${d} ${DOWS_EN[weekdayOf(key)]}`;
}

/** A day's route as the card writes it: every place, or past three the first … the last. */
export function cardRoute(names: readonly string[]): string {
  const shown = names.length > 3 ? [names[0], '…', names[names.length - 1]] : names;
  return shown.join(' → ');
}

/**
 * A photo on a calendar card, as the big photo opens it: its comments, ★ (and ♥
 * on someone else's group photo), and doodles where the photo takes them.
 */
export type CalendarPhoto = ViewerItem & {
  /** Its key for comments, ★ ♥ and doodles (`ping:<id>` for TODAY's, the group photo's path), null = none. */
  path: string | null;
  /** ♥ shown: someone else's photo sent to a group. */
  heart: boolean;
};

/** A card's photos opened big: the list, where it starts, and whether they're a group's (♥, doodles in `decorColor`). */
export interface CalendarPhotos {
  photos: CalendarPhoto[];
  seq: number;
  group?: { decorColor: string | null; inkOf: (userId: string) => string | null };
}

/** What goes under a day: dots (TODAY) or faces (a group), with words for its label. */
export type DayMark = { node: ReactNode; label: string } | null;

interface WeekCalendarProps {
  /** The day picked; its week is the strip. */
  day: string;
  today: string;
  onSelect(day: string): void;
  /** The picked day tapped again: go to it (its TODAY, its group map). */
  onOpen?(day: string): void;
  /**
   * The calendars to switch between (MY first, then my groups), and which one
   * this is: its name stands beside the title and opens the list.
   */
  calendars?: readonly { id: string; name: string }[];
  calendar?: string;
  onCalendar?(id: string): void;
  mark(day: string): DayMark;
  /** Days that can't be picked: the days to come. */
  isDisabled?(day: string): boolean;
  /** Days whose date stands on a yellow star (a group's birthday), with the words for it. */
  starred?(day: string): string | null;
  /** The picked day's preview card. */
  children: ReactNode;
}

/**
 * Calendar H (2026-11-16, output/calendar-drafts-2026-11-15): one week as a
 * strip, with the picked day's preview card taking the rest of the screen.
 * 월 전체 (or pulling the strip down) grows the strip into the whole month;
 * picking a day there folds it back. A sideways drag on the strip pages a
 * week, keeping the weekday. Every day button carries `data-date` (TODAY's
 * pinch finds its day by it).
 */
export default function WeekCalendar({ day, today, onSelect, onOpen, calendars, calendar, onCalendar, mark, isDisabled, starred, children }: WeekCalendarProps) {
  const [open, setOpen] = useState(false);
  // The calendar list (under the name beside the title); a tap anywhere else puts it away.
  const [listing, setListing] = useState(false);
  const switchEl = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!listing) return;
    const away = (e: PointerEvent) => {
      if (!switchEl.current?.contains(e.target as Node)) setListing(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [listing]);
  const current = calendars?.find((c) => c.id === calendar);
  const [view, setView] = useState(() => {
    const [y, m] = partsOf(day);
    return { year: y, month: m - 1 };
  });
  // The month opened is the picked day's.
  useEffect(() => {
    const [y, m] = partsOf(day);
    setView({ year: y, month: m - 1 });
  }, [day]);
  const [y, m] = open ? [view.year, view.month + 1] : partsOf(day);
  const weekStart = addDays(day, -weekdayOf(day));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // A day picks it (its card below); the picked day again goes to it.
  const pick = (key: string) => {
    if (isDisabled?.(key)) return;
    setOpen(false);
    if (key === day && onOpen) return onOpen(key);
    onSelect(key);
  };
  // A week further on can't go past today: the week holding today opens on today.
  const pageWeek = (dir: -1 | 1) => {
    const to = addDays(day, dir * 7);
    if (!isDisabled?.(to)) return onSelect(to);
    if (addDays(to, -weekdayOf(to)) <= today) onSelect(today);
  };

  // The strip's own swipes: paging weeks sideways, pulling down to open the month.
  // Its touches stop here, so the page's swipe back (and TODAY's pinch) leave them be.
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const stopTouch = (e: TouchEvent) => {
    if (e.touches.length <= 1) e.stopPropagation();
  };
  const onDown = (e: ReactPointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) >= WEEK_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swallowClick();
      pageWeek(dx < 0 ? 1 : -1);
    } else if (dy >= WEEK_SWIPE_PX && dy > Math.abs(dx) * 1.5) {
      swallowClick();
      setOpen(true);
    }
  };

  const dayButton = (key: string, inStrip: boolean, outside = false) => {
    const [, , d] = partsOf(key);
    const star = starred?.(key) ?? null;
    const marked = mark(key);
    const disabled = isDisabled?.(key) ?? false;
    const label = `${key}${star ? `, ${star}` : ''}${marked ? `, ${marked.label}` : ''}`;
    return (
      <button
        key={key}
        type="button"
        data-date={key}
        aria-label={label}
        aria-pressed={key === day}
        disabled={disabled}
        className={[
          inStrip ? 'week-cal__day' : 'week-cal__cell',
          key === day ? 'is-picked' : '',
          key === today ? 'is-today' : '',
          outside ? 'is-out' : '',
        ].join(' ')}
        onClick={() => pick(key)}
      >
        {inStrip && <span className="week-cal__dow">{WEEKDAYS[weekdayOf(key)]}</span>}
        <b className={star ? 'born-day' : undefined}>{d}</b>
        <span className="week-cal__mark" aria-hidden>
          {marked?.node}
        </span>
      </button>
    );
  };

  return (
    <div className={`week-cal ${open ? 'is-open' : ''}`}>
      <div className="week-cal__head">
        <button type="button" className="week-cal__title" aria-label="월 전체 보기" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {MONTHS_EN[m - 1]} {y}
        </button>
        {current && (
          <div ref={switchEl} className="week-cal__switch">
            <button type="button" className="week-cal__which" aria-haspopup="listbox" aria-expanded={listing} onClick={() => setListing((l) => !l)}>
              <span>{current.name}</span>
            </button>
            {listing && (
              <ul className="week-cal__list" role="listbox" aria-label="달력 고르기">
                {calendars!.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.id === calendar}
                      className={c.id === calendar ? 'is-on' : ''}
                      onClick={() => {
                        setListing(false);
                        if (c.id !== calendar) onCalendar?.(c.id);
                      }}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button type="button" className="week-cal__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          월 전체
        </button>
      </div>

      {open ? (
        <div className="week-cal__month" data-swipe-keep>
          <div className="week-cal__month-head">
            <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
              <ChevronLeft size={22} aria-hidden />
            </button>
            <strong aria-live="polite" aria-label={`${view.year}년 ${view.month + 1}월`}>
              {view.month + 1}월
            </strong>
            <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
          <div className="week-cal__grid" role="grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="week-cal__weekday" role="columnheader">
                {w}
              </span>
            ))}
            {monthGrid(view.year, view.month).map((cell) => (
              // The picked day's week stays marked as a band, so the strip's week reads in the month.
              <div key={cell.key} className={`week-cal__slot ${cell.key >= weekStart && cell.key < addDays(weekStart, 7) ? 'is-week' : ''}`}>
                {dayButton(cell.key, false, !cell.inMonth)}
              </div>
            ))}
          </div>
          <button type="button" className="week-cal__grabber" aria-label="접기" onClick={() => setOpen(false)} />
        </div>
      ) : (
        <div
          className="week-cal__strip"
          data-swipe-keep
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
          onTouchStart={stopTouch}
          onTouchMove={stopTouch}
          onTouchEnd={stopTouch}
        >
          {week.map((key) => dayButton(key, true))}
        </div>
      )}

      <div className="week-cal__card">{children}</div>
    </div>
  );
}

/** A drag that paged or opened swallows the click its release makes. */
function swallowClick() {
  const swallow = (c: MouseEvent) => {
    c.stopPropagation();
    c.preventDefault();
  };
  document.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
}

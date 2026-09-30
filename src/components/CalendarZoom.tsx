import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { dayTitle, pinchOutcome, pinchProgress, pingsForDate } from '../domain/dayPings';
import { dateKey } from '../domain/diary';
import DayPings from './DayPings';
import MonthCalendar from './MonthCalendar';

type Mode = 'day' | 'month';
type Point = { x: number; y: number };

interface Gesture {
  startDist: number;
  /** Where the fingers first met — the zoom anchor. */
  mid: Point;
  /** Month mode only: the day under `mid`, which a pinch-out opens. */
  target: string | null;
  scale: number;
}

const NO_PLANS = new Set<string>();
const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });

/**
 * 📅 tab. Opens on today's pings ("TODAY"); pinching in zooms out to the
 * month, and tapping or pinching out on a day zooms back into that day.
 * Both screens stay mounted and scale around the day's cell, so switching
 * reads as one continuous zoom. Ctrl+wheel (trackpad pinch) does the same
 * on desktop, and taps cover it without gestures.
 */
export default function CalendarZoom() {
  const today = dateKey();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => monthOf(today));
  const [origin, setOrigin] = useState<Point | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [visit, setVisit] = useState(0);

  const stageEl = useRef<HTMLDivElement | null>(null);
  const monthEl = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const wheelEnd = useRef<number | undefined>(undefined);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // While pinching out of the month, the day screen already shows the day
  // under the fingers, growing out of its cell.
  const shownDate = live !== null && mode === 'month' ? (gesture.current?.target ?? date) : date;
  const pings = pingsForDate(shownDate, today);
  const counts = new Map([[today, pingsForDate(today, today).length]]);

  // Offsets ignore transforms, so this is the cell's resting position even
  // while the month layer is scaled up and hidden.
  const cellCenter = (key: string): Point | null => {
    const layer = monthEl.current;
    const cell = layer?.querySelector<HTMLElement>(`[data-date="${key}"]`);
    if (!layer || !cell) return null;
    let x = cell.offsetWidth / 2;
    let y = cell.offsetHeight / 2;
    for (let n: HTMLElement | null = cell; n && n !== layer; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { x, y };
  };

  const stageCenter = (): Point => ({
    x: (stageEl.current?.clientWidth ?? 0) / 2,
    y: (stageEl.current?.clientHeight ?? 0) / 3,
  });

  const toMonth = () => {
    setOrigin(cellCenter(date) ?? stageCenter());
    setMode('month');
  };

  const toDay = (key: string, at?: Point) => {
    setOrigin(at ?? cellCenter(key) ?? stageCenter());
    setDate(key);
    setMonth(monthOf(key));
    setVisit((v) => v + 1);
    setMode('day');
  };

  // ----- Pinch (touch) and ctrl+wheel (trackpad) -----

  const local = (clientX: number, clientY: number): Point => {
    const box = stageEl.current!.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };

  const dayAt = (clientX: number, clientY: number): string | null =>
    document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null;

  const begin = (clientX: number, clientY: number, startDist: number): boolean => {
    const month = modeRef.current === 'month';
    const target = month ? dayAt(clientX, clientY) : null;
    if (month && !target) return false; // pinching outside the grid does nothing
    const mid = local(clientX, clientY);
    gesture.current = { startDist, mid, target, scale: 1 };
    setOrigin(month ? mid : (cellCenter(date) ?? stageCenter()));
    setLive(1);
    return true;
  };

  const finish = (switched: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setLive(null);
    if (!g || !switched) return;
    if (modeRef.current === 'day') toMonth();
    else if (g.target) toDay(g.target, g.mid);
  };

  const move = (scale: number) => {
    const g = gesture.current;
    if (!g) return;
    // Each screen only zooms the way that leaves it.
    g.scale = modeRef.current === 'day' ? Math.min(1, Math.max(0.3, scale)) : Math.max(1, Math.min(3, scale));
    setLive(g.scale);
    if (pinchOutcome(g.scale, false) === 'switch') finish(true);
  };

  const release = () => {
    const g = gesture.current;
    if (g) finish(pinchOutcome(g.scale, true) === 'switch');
  };

  const fingers = (e: TouchEvent) => {
    const [a, b] = [e.touches[0], e.touches[1]];
    return {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return;
    const f = fingers(e);
    begin(f.x, f.y, f.dist);
  };

  const onTouchMove = (e: TouchEvent) => {
    const g = gesture.current;
    if (!g || e.touches.length !== 2) return;
    move(fingers(e).dist / g.startDist);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) release();
  };

  useEffect(() => {
    const stage = stageEl.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad pinches arrive as ctrl+wheel
      e.preventDefault(); // …and would otherwise zoom the whole page
      if (!gesture.current && !begin(e.clientX, e.clientY, 1)) return;
      const g = gesture.current;
      if (!g) return;
      move(g.scale * Math.exp(-e.deltaY * 0.01));
      window.clearTimeout(wheelEnd.current);
      wheelEnd.current = window.setTimeout(release, 160);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.clearTimeout(wheelEnd.current);
    };
  });

  // ----- Layer transforms -----

  const at = origin ? `${origin.x}px ${origin.y}px` : '50% 30%';
  let dayStyle: CSSProperties;
  let monthStyle: CSSProperties;
  if (live !== null && mode === 'day') {
    const p = pinchProgress(live);
    dayStyle = { transform: `scale(${live})`, opacity: 1 - p * 0.6 };
    monthStyle = { transform: `scale(${4 - 3 * p})`, opacity: p };
  } else if (live !== null) {
    const p = pinchProgress(live);
    monthStyle = { transform: `scale(${live})`, opacity: 1 - p * 0.6 };
    dayStyle = { transform: `scale(${0.25 + 0.75 * p})`, opacity: p };
  } else {
    dayStyle = mode === 'day' ? { transform: 'none', opacity: 1 } : { transform: 'scale(0.25)', opacity: 0 };
    monthStyle = mode === 'month' ? { transform: 'none', opacity: 1 } : { transform: 'scale(4)', opacity: 0 };
  }

  return (
    <div
      ref={stageEl}
      className={`cal-zoom ${live !== null ? 'is-live' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        ref={monthEl}
        className={`cal-zoom__layer cal-zoom__month ${mode === 'month' ? 'is-on' : ''}`}
        style={{ ...monthStyle, transformOrigin: at }}
        aria-hidden={mode !== 'month'}
        inert={mode !== 'month'}
      >
        <MonthCalendar counts={counts} plans={NO_PLANS} onPick={(key) => toDay(key)} view={month} onView={setMonth} />
      </div>

      <section
        className={`cal-zoom__layer cal-zoom__day ${mode === 'day' ? 'is-on' : ''}`}
        style={{ ...dayStyle, transformOrigin: at }}
        aria-hidden={mode !== 'day'}
        inert={mode !== 'day'}
        aria-label={`${shownDate} 기록`}
      >
        <button className="cal-zoom__title" aria-label={`${dayTitle(shownDate, today)}, 달력 보기`} onClick={toMonth}>
          {dayTitle(shownDate, today)}
        </button>
        <DayPings key={`${shownDate}-${visit}`} pings={pings} />
      </section>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';
import { swipeCommits, SWIPE } from '../domain/appTabs';
import { daySwipeTarget, dayTitle, edgeKey, PINCH, pinchOutcome, pinchProgress, pingKey, pingsForDate, type EdgeStyle, type PingShape } from '../domain/dayPings';
import { addDays } from '../domain/calendar';
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
const SLIDE_MS = 260;

/** One-finger sideways drag on a day screen, paging to the day before / after. */
interface DaySwipe {
  x: number;
  y: number;
  axis: 'x' | 'other' | null;
  /** The day being paged to, and the side it comes in from (-1 left, 1 right). */
  to: string | null;
  side: -1 | 1;
  dx: number;
  lastX: number;
  lastT: number;
  prevX: number;
  prevT: number;
}

type LayerLook = { transform: string; opacity: string };

/**
 * Where both screens sit for a mode, or mid-pinch at `scale`. The screen
 * being pinched follows the fingers; the other one comes in (or goes out)
 * in step with the pinch's progress toward its switch point.
 */
function layerLooks(mode: Mode, scale: number | null): { day: LayerLook; month: LayerLook } {
  const look = (s: number, o: number): LayerLook => ({ transform: s === 1 ? 'none' : `scale(${s})`, opacity: String(o) });
  if (scale === null) {
    return mode === 'day' ? { day: look(1, 1), month: look(4, 0) } : { day: look(0.25, 0), month: look(1, 1) };
  }
  const p = pinchProgress(scale);
  return mode === 'day'
    ? { day: look(scale, 1 - p * 0.6), month: look(4 - 3 * p, p) }
    : { day: look(0.25 + 0.75 * p, p), month: look(scale, 1 - p * 0.6) };
}
const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });

/**
 * 📅 tab. Opens on today's pings ("TODAY"); pinching in zooms out to the
 * month, and tapping or pinching out on a day zooms back into that day.
 * Both screens stay mounted and scale around the day's cell, so switching
 * reads as one continuous zoom. Ctrl+wheel (trackpad pinch) does the same
 * on desktop, and taps cover it without gestures.
 */
interface CalendarZoomProps {
  /** Bumped each time the calendar button is tapped again: flips TODAY ↔ month. */
  flip: number;
}

export default function CalendarZoom({ flip }: CalendarZoomProps) {
  const today = dateKey();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => monthOf(today));
  const [origin, setOrigin] = useState<Point | null>(null);
  // Pinching out of the month: the day under the fingers, shown as it grows.
  const [preview, setPreview] = useState<string | null>(null);
  const [visit, setVisit] = useState(0);
  // Chosen ping shapes. Pings aren't stored yet, so this lasts for the session.
  const [shapes, setShapes] = useState<Map<string, PingShape>>(() => new Map());
  const [edgeStyles, setEdgeStyles] = useState<Map<string, EdgeStyle>>(() => new Map());

  // Paging days: the day sliding in beside the current one.
  const [neighbor, setNeighbor] = useState<{ date: string; side: -1 | 1 } | null>(null);
  const daySwipe = useRef<DaySwipe | null>(null);
  const sliding = useRef(false);
  const resetSlide = useRef(false);
  const curEl = useRef<HTMLDivElement | null>(null);
  const nbEl = useRef<HTMLDivElement | null>(null);

  const stageEl = useRef<HTMLDivElement | null>(null);
  const monthEl = useRef<HTMLDivElement | null>(null);
  const dayEl = useRef<HTMLElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const wheelEnd = useRef<number | undefined>(undefined);
  const stall = useRef<number | undefined>(undefined);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const shownDate = preview ?? date;
  // While a pinch-out is only previewing the day, its pins stay out: they
  // drop in once the zoom lands, like every other way of opening a day.
  const pings = preview ? [] : pingsForDate(shownDate, today);
  const counts = new Map(
    [today, addDays(today, -1)].map((key) => [key, pingsForDate(key, today).length] as [string, number]),
  );

  // The layers are moved by writing their style directly, not through
  // React state: a pinch fires dozens of moves a second, and re-rendering
  // the month grid and the ping drawing for each one made the zoom stutter.
  const paint = (scale: number | null, at: Point | null) => {
    const looks = layerLooks(modeRef.current, scale);
    const anchor = at ? `${at.x}px ${at.y}px` : '50% 30%';
    for (const [el, look] of [
      [dayEl.current, looks.day],
      [monthEl.current, looks.month],
    ] as const) {
      if (!el) continue;
      el.style.transformOrigin = anchor;
      el.style.transform = look.transform;
      el.style.opacity = look.opacity;
    }
  };

  // Resting positions; with the live class gone this animates to them.
  useLayoutEffect(() => paint(null, origin), [mode, origin]);

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

  const toMonth = (at?: Point) => {
    setOrigin(at ?? cellCenter(date) ?? stageCenter());
    setMode('month');
  };

  /** Opens a day; remounting the drawing (visit) makes its pins drop in. */
  const toDay = (key: string, at?: Point) => {
    setOrigin(at ?? cellCenter(key) ?? stageCenter());
    setDate(key);
    setMonth(monthOf(key));
    setPreview(null);
    setVisit((v) => v + 1);
    setMode('day');
  };

  // Calendar button again: a day zooms out to the month, the month zooms
  // back into TODAY (not the day last opened).
  const lastFlip = useRef(flip);
  useEffect(() => {
    if (flip === lastFlip.current) return;
    lastFlip.current = flip;
    if (gesture.current) return;
    if (modeRef.current === 'day') toMonth();
    else toDay(today);
  });

  // ----- Paging days (one-finger swipe on a day screen) -----

  // Like the pinch, drawn straight onto the two panels rather than through
  // state, one paint per frame.
  const paintSlide = (dx: number, side: -1 | 1, animate: boolean) => {
    const width = stageEl.current?.clientWidth ?? window.innerWidth;
    const transition = animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none';
    if (curEl.current) {
      curEl.current.style.transition = transition;
      curEl.current.style.transform = dx ? `translateX(${dx}px)` : '';
    }
    if (nbEl.current) {
      nbEl.current.style.transition = transition;
      nbEl.current.style.transform = `translateX(${side * width + dx}px)`;
    }
  };

  // After a page lands, the current panel (now showing the new day) snaps
  // back to the middle in the same frame the neighbour goes away.
  useLayoutEffect(() => {
    if (!resetSlide.current) return;
    resetSlide.current = false;
    if (curEl.current) {
      curEl.current.style.transition = 'none';
      curEl.current.style.transform = '';
    }
  });

  const endDaySwipe = (commit: boolean) => {
    const sw = daySwipe.current;
    daySwipe.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!sw || sw.axis !== 'x' || !sw.to) return;
    const width = stageEl.current?.clientWidth ?? window.innerWidth;
    const to = sw.to;
    sliding.current = true;
    // The current day leaves the way the finger went; the neighbour lands.
    paintSlide(commit ? -sw.side * width : 0, sw.side, true);
    window.setTimeout(() => {
      sliding.current = false;
      if (commit) {
        resetSlide.current = true;
        setDate(to);
        setMonth(monthOf(to));
        setVisit((v) => v + 1); // the new day's pins drop in now
      }
      setNeighbor(null);
    }, SLIDE_MS);
  };

  const onDayTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || modeRef.current !== 'day' || gesture.current || sliding.current) {
      if (daySwipe.current?.axis === 'x') endDaySwipe(false); // a second finger: back off for the pinch
      daySwipe.current = null;
      return;
    }
    const { clientX: x, clientY: y } = e.touches[0];
    const t = performance.now();
    daySwipe.current = { x, y, axis: null, to: null, side: -1, dx: 0, lastX: x, lastT: t, prevX: x, prevT: t };
  };

  const onDayTouchMove = (e: TouchEvent) => {
    const sw = daySwipe.current;
    if (!sw || e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    const mx = x - sw.x;
    if (sw.axis === null) {
      if (Math.abs(mx) < SWIPE.startPx && Math.abs(y - sw.y) < SWIPE.startPx) return;
      const to = Math.abs(mx) > Math.abs(y - sw.y) ? daySwipeTarget(date, today, mx) : null;
      // Not ours (vertical, or right-to-left on TODAY): let the page have it.
      if (!to) {
        sw.axis = 'other';
        return;
      }
      sw.axis = 'x';
      sw.to = to;
      sw.side = mx > 0 ? -1 : 1; // the day before comes in from the left
      setNeighbor({ date: to, side: sw.side });
    }
    if (sw.axis !== 'x') return;
    e.stopPropagation(); // keeps the page's swipe-to-map out of it
    sw.prevX = sw.lastX;
    sw.prevT = sw.lastT;
    sw.lastX = x;
    sw.lastT = performance.now();
    // Dragging back past the start just resists.
    sw.dx = mx * -sw.side > 0 ? mx : mx * 0.15;
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (daySwipe.current === sw) paintSlide(sw.dx, sw.side, false);
      });
    }
  };

  const onDayTouchEnd = (e: TouchEvent) => {
    const sw = daySwipe.current;
    if (!sw || e.touches.length > 0) return;
    if (sw.axis !== 'x') {
      daySwipe.current = null;
      return;
    }
    e.stopPropagation();
    const width = stageEl.current?.clientWidth ?? window.innerWidth;
    const velocity = (sw.lastX - sw.prevX) / Math.max(1, sw.lastT - sw.prevT);
    endDaySwipe(swipeCommits(-sw.side as -1 | 1, sw.dx, width, velocity));
  };

  // ----- Pinch (touch) and ctrl+wheel (trackpad) -----

  const local = (clientX: number, clientY: number): Point => {
    const box = stageEl.current!.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };

  const dayAt = (clientX: number, clientY: number): string | null =>
    document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null;

  const begin = (clientX: number, clientY: number, startDist: number): boolean => {
    const inMonth = modeRef.current === 'month';
    const target = inMonth ? dayAt(clientX, clientY) : null;
    if (inMonth && !target) return false; // pinching outside the grid does nothing
    const mid = inMonth ? local(clientX, clientY) : (cellCenter(date) ?? stageCenter());
    gesture.current = { startDist, mid, target, scale: 1 };
    stageEl.current?.classList.add('is-live');
    paint(1, mid);
    if (target) setPreview(target); // the one render a pinch costs
    return true;
  };

  const finish = (switched: boolean) => {
    const g = gesture.current;
    window.clearTimeout(stall.current);
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    gesture.current = null;
    stageEl.current?.classList.remove('is-live');
    if (!g) return;
    if (!switched) {
      paint(null, g.mid); // spring back from wherever the fingers left it
      setOrigin(g.mid);
      setPreview(null);
    } else if (modeRef.current === 'day') {
      toMonth(g.mid);
    } else if (g.target) {
      toDay(g.target, g.mid);
    }
  };

  const move = (scale: number) => {
    const g = gesture.current;
    if (!g) return;
    // Each screen only zooms the way that leaves it.
    g.scale = modeRef.current === 'day' ? Math.min(1, Math.max(0.3, scale)) : Math.max(1, Math.min(3, scale));
    if (pinchOutcome(g.scale, false) === 'switch') return finish(true);
    // At most one paint per frame, however many touch events arrive.
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (gesture.current === g) paint(g.scale, g.mid);
      });
    }
    // Holding still far enough in finishes the zoom without lifting the fingers.
    window.clearTimeout(stall.current);
    stall.current = window.setTimeout(() => {
      if (gesture.current === g && pinchOutcome(g.scale, true) === 'switch') finish(true);
    }, PINCH.stallMs);
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
    onDayTouchStart(e);
    if (e.touches.length !== 2) return;
    const f = fingers(e);
    begin(f.x, f.y, f.dist);
  };

  const onTouchMove = (e: TouchEvent) => {
    onDayTouchMove(e);
    const g = gesture.current;
    if (!g || e.touches.length !== 2) return;
    move(fingers(e).dist / g.startDist);
  };

  const onTouchEnd = (e: TouchEvent) => {
    onDayTouchEnd(e);
    if (e.touches.length < 2) release();
  };

  // The wheel listener is attached once and reaches the latest handlers
  // through this ref (it has to be non-passive, so it can't be a React prop).
  const wheelHandlers = useRef({ begin, move, release });
  wheelHandlers.current = { begin, move, release };

  useEffect(() => {
    const stage = stageEl.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad pinches arrive as ctrl+wheel
      e.preventDefault(); // …and would otherwise zoom the whole page
      const h = wheelHandlers.current;
      if (!gesture.current && !h.begin(e.clientX, e.clientY, 1)) return;
      const g = gesture.current;
      if (!g) return;
      h.move(g.scale * Math.exp(-e.deltaY * 0.01));
      window.clearTimeout(wheelEnd.current);
      wheelEnd.current = window.setTimeout(() => wheelHandlers.current.release(), 160);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.clearTimeout(stall.current);
      window.clearTimeout(wheelEnd.current);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      ref={stageEl}
      className="cal-zoom"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        ref={monthEl}
        className={`cal-zoom__layer cal-zoom__month ${mode === 'month' ? 'is-on' : ''}`}
        aria-hidden={mode !== 'month'}
        inert={mode !== 'month'}
      >
        <MonthCalendar counts={counts} plans={NO_PLANS} onPick={(key) => toDay(key)} view={month} onView={setMonth} />
      </div>

      <section
        ref={dayEl}
        className={`cal-zoom__layer cal-zoom__day ${mode === 'day' ? 'is-on' : ''}`}
        aria-hidden={mode !== 'day'}
        inert={mode !== 'day'}
        aria-label={`${shownDate} 기록`}
      >
        <div ref={curEl} className="cal-day">
          <button className="cal-zoom__title" aria-label={`${dayTitle(shownDate, today)}, 달력 보기`} onClick={() => toMonth()}>
            {dayTitle(shownDate, today)}
          </button>
          <div className="cal-zoom__pings">
            <DayPings
              key={`${shownDate}-${visit}`}
              pings={pings}
              shapeOf={(ping) => shapes.get(pingKey(shownDate, ping)) ?? 'pin'}
              onShape={(ping, shape) => setShapes((prev) => new Map(prev).set(pingKey(shownDate, ping), shape))}
              edgeStyleOf={(from, to) => edgeStyles.get(edgeKey(shownDate, from, to)) ?? 'solid'}
              onEdgeStyle={(from, to, style) =>
                setEdgeStyles((prev) => new Map(prev).set(edgeKey(shownDate, from, to), style))
              }
              onTap={() => {
                // Recognised on purpose; what a tap opens is decided later.
              }}
              pressable={() => gesture.current === null && daySwipe.current?.axis !== 'x'}
            />
          </div>
        </div>
        {neighbor && (
          // The day sliding in: its title only; its pins drop in once it lands.
          <div
            ref={nbEl}
            className="cal-day cal-day--neighbor"
            style={{ transform: `translateX(${neighbor.side * 100}%)` }}
            aria-hidden
          >
            <span className="cal-zoom__title">{dayTitle(neighbor.date, today)}</span>
          </div>
        )}
      </section>
    </div>
  );
}

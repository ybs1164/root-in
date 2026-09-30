import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';
import { dayTitle, PINCH, pinchOutcome, pinchProgress, pingKey, pingsForDate, type PingShape } from '../domain/dayPings';
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
export default function CalendarZoom() {
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
  const pings = pingsForDate(shownDate, today);
  const counts = new Map([[today, pingsForDate(today, today).length]]);

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

  /** `replay`: remount the drawing so the pins drop in (not when a pinch already showed it). */
  const toDay = (key: string, at?: Point, replay = true) => {
    setOrigin(at ?? cellCenter(key) ?? stageCenter());
    setDate(key);
    setMonth(monthOf(key));
    setPreview(null);
    if (replay) setVisit((v) => v + 1);
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
      toDay(g.target, g.mid, false);
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
        <button className="cal-zoom__title" aria-label={`${dayTitle(shownDate, today)}, 달력 보기`} onClick={() => toMonth()}>
          {dayTitle(shownDate, today)}
        </button>
        <div className="cal-zoom__pings">
          <DayPings
            key={`${shownDate}-${visit}`}
            pings={pings}
            shapeOf={(ping) => shapes.get(pingKey(shownDate, ping)) ?? 'pin'}
            onShape={(ping, shape) => setShapes((prev) => new Map(prev).set(pingKey(shownDate, ping), shape))}
            onTap={() => {
              // Recognised on purpose; what a tap opens is decided later.
            }}
            pressable={() => gesture.current === null}
          />
        </div>
      </section>
    </div>
  );
}

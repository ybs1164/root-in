import { ChevronLeft, ChevronRight, Share } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { swipeCommits, SWIPE } from '../domain/appTabs';
import { daySwipeTarget, dayTitle, edgeKey, PINCH, pinchOutcome, pinchProgress, pingKey, pingsForDate, pingsLandedMs, SAMPLE_PING_DATES } from '../domain/dayPings';
import { addDays } from '../domain/calendar';
import {
  canUndo,
  DEFAULT_PEN,
  EMPTY_DECOR,
  EMPTY_HISTORY,
  recordChange,
  redoDecor,
  undoDecor,
  cleanTextStyle,
  DEFAULT_TEXT_STYLE,
  type DayDecor,
  type DecorHistory,
  type TextStyle,
  type DecorTool,
  type PatternId,
  type PenSettings,
  type ThemeId,
} from '../domain/decor';
import { loadDays, saveDays, type DayStore } from '../services/dayRepository';
import { dateKey } from '../domain/diary';
import DayPings from './DayPings';
import DecorLayer, { type TextFocus } from './DecorLayer';
import { DecorRail, DecorTray } from './DecorTools';
import MonthCalendar from './MonthCalendar';
import { hasHome, type ExcludedPlace } from '../domain/privacy';
import { daySubject, type ShareSubject } from '../domain/shareSubject';

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
/** Sent down from the calendar button's menu; `seq` makes a repeat count. */
export interface CalendarCommand {
  type: 'month' | 'today';
  seq: number;
}

interface CalendarZoomProps {
  command: CalendarCommand | null;
  /** Reports day ↔ month, which decides what the calendar button does next. */
  onMode: (mode: Mode) => void;
  /** Tells the app a decorating tool is out, so it can put the tab buttons away. */
  onDecorating: (on: boolean) => void;
  /** The theme of the day on screen (each day keeps its own); the app wears it. */
  onDayTheme: (theme: ThemeId) => void;
  /** Likewise the day's background pattern, which the app lays across the page. */
  onDayPattern: (pattern: PatternId) => void;
  /** 제외 주소: pings there are left out of the shared card. */
  excluded: ExcludedPlace[];
  /** 공유 pressed before 집 is set (it's required): the app asks for it. */
  onNeedHome: () => void;
  /** 공유: the day as a card (its 꾸미기 carried along), for the app's 꾸미기 screen. */
  onShare: (subject: ShareSubject) => void;
  /** The page is still sliding in: the day's pins, lines and 꾸미기 wait to play until it lands. */
  holdIntro?: boolean;
}

/** How long the sheet takes to go down when switching tools (matches `tray-down` in styles.css). */
const TRAY_SWAP_MS = 170;

export default function CalendarZoom({ command, onMode, onDecorating, onDayTheme, onDayPattern, excluded, onNeedHome, onShare, holdIntro = false }: CalendarZoomProps) {
  const today = dateKey();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => monthOf(today));
  const [origin, setOrigin] = useState<Point | null>(null);
  // Pinching out of the month: the day under the fingers, shown as it grows.
  const [preview, setPreview] = useState<string | null>(null);
  const [visit, setVisit] = useState(0);
  // Everything made of each day (ping shapes, line styles, stickers, strokes,
  // theme), kept per date in storage so a day looks the same when reopened.
  const [days, setDays] = useState<DayStore>(loadDays);
  const loaded = useRef(true);
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    saveDays(days);
  }, [days]);
  // Undo / redo per day, for this visit only.
  const [history, setHistory] = useState<Record<string, DecorHistory>>({});
  // 꾸미기: which tool is out.
  // and which tool is out.
  const [tool, setTool] = useState<DecorTool | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [pen, setPen] = useState<PenSettings>(DEFAULT_PEN);
  // Text tool: the box picked or being typed in, and how the next new box looks.
  const [textFocus, setTextFocus] = useState<TextFocus>(null);
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  // A sticker or text box is being dragged: the tool sheet steps aside for the trash.
  const [draggingPiece, setDraggingPiece] = useState(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Paging days: the day sliding in beside the current one.
  const [neighbor, setNeighbor] = useState<{ date: string; side: -1 | 1 } | null>(null);
  const daySwipe = useRef<DaySwipe | null>(null);
  const sliding = useRef(false);
  const resetSlide = useRef(false);
  const curEl = useRef<HTMLDivElement | null>(null);
  const nbEl = useRef<HTMLDivElement | null>(null);

  const stageEl = useRef<HTMLDivElement | null>(null);
  // The page this calendar sits on: 공유 goes there (see below).
  const [pageEl, setPageEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const page = stageEl.current?.closest<HTMLElement>('.page');
    setPageEl(page?.querySelector<HTMLElement>('.page-bar__row') ?? page ?? null);
  }, []);
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
  const pings = preview || holdIntro ? [] : pingsForDate(shownDate);
  // Landed: remount the drawing so the pins drop, the lines draw and the
  // 꾸미기 settles now, not unseen under the sliding page.
  const held = useRef(holdIntro);
  useEffect(() => {
    if (held.current && !holdIntro) setVisit((v) => v + 1);
    held.current = holdIntro;
  }, [holdIntro]);
  const counts = new Map(
    Object.entries(SAMPLE_PING_DATES).map(([key, pings]) => [key, pings.length] as [string, number]),
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

  // Resting positions; with the live class gone this animates to them. The
  // first one lands without a transition: the layers start unstyled (the
  // month full size), and animating from there showed a zoom on every open.
  const painted = useRef(false);
  useLayoutEffect(() => {
    if (painted.current) return paint(null, origin);
    painted.current = true;
    const layers = [dayEl.current, monthEl.current];
    layers.forEach((el) => el && (el.style.transition = 'none'));
    paint(null, origin);
    layers.forEach((el) => {
      if (!el) return;
      void el.offsetWidth;
      el.style.transition = '';
    });
  }, [mode, origin]);

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

  // Commands from the calendar button's menu (and TODAY from the month).
  const lastCommand = useRef(command?.seq ?? 0);
  useEffect(() => {
    if (!command || command.seq === lastCommand.current) return;
    lastCommand.current = command.seq;
    if (gesture.current) return;
    if (command.type === 'month' && modeRef.current === 'day') toMonth();
    else if (command.type === 'today') toDay(today);
  });

  useEffect(() => onMode(mode), [mode]);

  const dayDecor = days.decor[shownDate] ?? EMPTY_DECOR;
  const dayHistory = history[shownDate] ?? EMPTY_HISTORY;
  const setDayDecor = (next: DayDecor) => setDays((d) => ({ ...d, decor: { ...d.decor, [shownDate]: next } }));
  // A drawing change: undo can bring back what was there; redo is forgotten.
  const changeDecor = (next: DayDecor) => {
    setHistory((h) => ({ ...h, [shownDate]: recordChange(dayHistory, dayDecor) }));
    setDayDecor(next);
  };
  const step = (result: { history: DecorHistory; decor: DayDecor } | null) => {
    if (!result) return;
    setHistory((h) => ({ ...h, [shownDate]: result.history }));
    setDayDecor(result.decor);
  };

  // The app shows the day's theme while the day is on screen; the month and
  // the rest of the app stay default.
  const dayTheme = mode === 'day' ? (dayDecor.theme ?? 'default') : 'default';
  useEffect(() => onDayTheme(dayTheme), [dayTheme]);
  useEffect(() => () => onDayTheme('default'), []);
  // While a pinch-out only previews a day, its pattern waits for the landing, like its pins.
  const dayPattern = mode === 'day' && !preview ? (dayDecor.pattern ?? 'none') : 'none';
  useEffect(() => onDayPattern(dayPattern), [dayPattern]);
  useEffect(() => () => onDayPattern('none'), []);

  // The text tool's toolbar is for a written box that's been picked: it
  // stays down while nothing is picked, and while typing (the keyboard is up).
  const pickedText = textFocus && !textFocus.editing ? (dayDecor.texts ?? []).find((t) => t.id === textFocus.id) : undefined;
  const sheetTool = tool === 'text' && !pickedText ? null : tool;
  const sheetTextStyle: TextStyle = pickedText ?? textStyle;
  const changeTextStyle = (patch: Partial<TextStyle>) => {
    const next = cleanTextStyle({ ...sheetTextStyle, ...patch });
    setTextStyle(next);
    if (pickedText) {
      const { id } = pickedText;
      const texts = (dayDecor.texts ?? []).map((t) => {
        if (t.id !== id) return t;
        const { bold: _b, italic: _i, underline: _u, strike: _s, ...rest } = t;
        return { ...rest, ...next };
      });
      changeDecor({ ...dayDecor, texts });
    }
  };

  // The app hides the tab buttons while a tool is out. Leaving the day
  // screen (to the month) puts the tools away.
  useEffect(() => onDecorating(tool !== null), [tool]);
  // The sheet shows `trayTool`, which trails `tool`: switching tools sends the
  // open sheet down first, then the new one comes up.
  const [trayTool, setTrayTool] = useState<DecorTool | null>(null);
  const [trayLeaving, setTrayLeaving] = useState(false);
  useEffect(() => {
    if (!sheetTool || !trayTool) {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
      return;
    }
    if (sheetTool === trayTool) return;
    setTrayLeaving(true);
    const swap = window.setTimeout(() => {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
    }, TRAY_SWAP_MS);
    return () => window.clearTimeout(swap);
  }, [sheetTool]);
  // Touching anywhere but the drawing box or the tools puts the tool away,
  // and the tab buttons come back.
  useEffect(() => {
    if (!tool) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.decor, .decor-tray, .decor-rail, .color-picker')) return;
      setTool(null);
      // That touch only closes: its click shouldn't also open something
      // (the title would zoom out to the month). Dropped if no click follows.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 500);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [tool]);
  useEffect(() => {
    if (mode !== 'day') setTool(null);
  }, [mode]);
  useEffect(() => () => onDecorating(false), []);

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

  /**
   * The < > beside a day: pages to the day before / after the way a swipe
   * does (this day slides off, the neighbour slides in, its pins drop).
   * Today has no day after it.
   */
  const stepDay = (step: -1 | 1) => {
    if (sliding.current || daySwipe.current || toolRef.current) return;
    const to = step < 0 ? addDays(date, -1) : date !== today ? addDays(date, 1) : null;
    if (!to) return;
    sliding.current = true;
    setNeighbor({ date: to, side: step });
    // Once the neighbour is on the page beside this day, both slide over.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        paintSlide(-step * (stageEl.current?.clientWidth ?? window.innerWidth), step, true);
        window.setTimeout(() => {
          sliding.current = false;
          resetSlide.current = true;
          setDate(to);
          setMonth(monthOf(to));
          setVisit((v) => v + 1);
          setNeighbor(null);
        }, SLIDE_MS);
      }),
    );
  };

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
    if (e.touches.length !== 1 || modeRef.current !== 'day' || gesture.current || sliding.current || toolRef.current) {
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
    // No zooming while a sticker or pen is out: fingers belong to the drawing.
    if (e.touches.length !== 2 || toolRef.current) return;
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
      if (!e.ctrlKey || toolRef.current) return; // trackpad pinches arrive as ctrl+wheel
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
        {!tool && (
          <>
            <button className="route-step route-step--prev day-step" aria-label="전날" onClick={() => stepDay(-1)}>
              <ChevronLeft size={30} strokeWidth={2.2} aria-hidden />
            </button>
            {date !== today && (
              <button className="route-step route-step--next day-step" aria-label="다음 날" onClick={() => stepDay(1)}>
                <ChevronRight size={30} strokeWidth={2.2} aria-hidden />
              </button>
            )}
          </>
        )}
        <DecorRail
          tool={tool}
          onTool={(next) => {
            setTool(next);
            setArmed(null);
            setTextFocus(null);
          }}
        />
        {/* 공유, a round button as on a route: makes the day's card, its 꾸미기 carried along, and opens it there.
            At the right end of the page's bottom row (App), out of the clipped calendar
            area, sliding with the page. */}
        {!tool && createPortal(
          <button
            className="day-share"
            aria-label="공유"
            onClick={() => {
              if (!hasHome(excluded)) return onNeedHome();
              onShare(
                daySubject(
                  date,
                  pingsForDate(date),
                  (ping) => days.shapes[pingKey(date, ping)] ?? 'pin',
                  (from, to) => days.edges[edgeKey(date, from, to)] ?? 'solid',
                  excluded,
                  days.decor[date] ?? EMPTY_DECOR,
                ),
              );
            }}
          >
            <Share size={24} strokeWidth={2.2} aria-hidden />
          </button>,
          pageEl ?? document.body,
        )}
        <div ref={curEl} className="cal-day">
          <button className="cal-zoom__title" aria-label={`${dayTitle(shownDate, today)}, 달력 보기`} onClick={() => toMonth()}>
            {dayTitle(shownDate, today)}
          </button>
          <div className="cal-zoom__pings">
            <DayPings
              key={`${shownDate}-${visit}`}
              pings={pings}
              shapeOf={(ping) => days.shapes[pingKey(shownDate, ping)] ?? 'pin'}
              onShape={(ping, shape) => setDays((d) => ({ ...d, shapes: { ...d.shapes, [pingKey(shownDate, ping)]: shape } }))}
              edgeStyleOf={(from, to) => days.edges[edgeKey(shownDate, from, to)] ?? 'solid'}
              onEdgeStyle={(from, to, style) =>
                setDays((d) => ({ ...d, edges: { ...d.edges, [edgeKey(shownDate, from, to)]: style } }))
              }
              onTap={() => {
                // Recognised on purpose; what a tap opens is decided later.
              }}
              pressable={() => gesture.current === null && daySwipe.current?.axis !== 'x' && !toolRef.current}
            >
              {!holdIntro && (
                <DecorLayer
                  decor={dayDecor}
                  tool={tool}
                  armed={armed}
                  pen={pen}
                  onChange={changeDecor}
                  enterDelayMs={pingsLandedMs(pings.length)}
                  textFocus={textFocus}
                  onTextFocus={setTextFocus}
                  textStyle={textStyle}
                  onDragging={setDraggingPiece}
                />
              )}
            </DayPings>
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

      {trayTool && (
        <DecorTray
          key={trayTool}
          leaving={trayLeaving}
          away={draggingPiece}
          tool={trayTool}
          armed={armed}
          onArm={setArmed}
          pen={pen}
          onPen={setPen}
          canUndo={canUndo(dayHistory, dayDecor)}
          onUndo={() => step(undoDecor(dayHistory, dayDecor))}
          canRedo={dayHistory.future.length > 0}
          onRedo={() => step(redoDecor(dayHistory, dayDecor))}
          canClear={dayDecor.strokes.length > 0}
          onClear={() => changeDecor({ ...dayDecor, strokes: [] })}
          theme={dayTheme}
          onTheme={(theme) => setDayDecor({ ...dayDecor, theme: theme === 'default' ? undefined : theme })}
          pattern={dayDecor.pattern ?? 'none'}
          onPattern={(pattern) => setDayDecor({ ...dayDecor, pattern: pattern === 'none' ? undefined : pattern })}
          textStyle={sheetTextStyle}
          onTextStyle={changeTextStyle}
          onClose={() => setTool(null)}
        />
      )}

    </div>
  );
}

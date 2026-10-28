import { ChevronLeft, ChevronRight, Share } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { dayTitle, edgeKey, photoPingTarget, PINCH, pinchOutcome, pinchProgress, pingCounts, pingKey, pingsForDate, pingsLandedMs, todayCandidates, type DayPing } from '../domain/dayPings';
import { useStoredPings } from '../hooks/useStoredPings';
import { loadPings, recordPing, recordPlacePing, removePing, todayPingOfPin } from '../services/pingRepository';
import { PING_PHOTO_PX, savePingPhoto } from '../services/pingPhotoRepository';
import { usePingPhotos } from '../hooks/usePingPhotos';
import { avatarFromFile } from '../lib/avatarImage';
import { pointPlace } from '../services/placeSearch/placeSearchService';
import { pinStyle, UNCATEGORIZED } from '../domain/pin';
import type { Pin, PinCategory } from '../types/pin';
import type { PlaceRef } from '../types/course';
import ConfirmDialog from './ConfirmDialog';
import PlacePickDialog from './PlacePickDialog';
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
import { onPulled } from '../services/syncBus';
import { dateKey } from '../domain/diary';
import DayPings from './DayPings';
import type { StickerDrop } from '../domain/stickerSheets';
import DecorLayer, { type TextFocus } from './DecorLayer';
import { DecorRail, DecorTray } from './DecorTools';
import MonthCalendar from './MonthCalendar';
import type { ExcludedPlace } from '../domain/privacy';

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
  /**
   * A ping is picked (tapped, or picked up to drag): `remove` deletes it, and
   * the app shows its calendar button as ✕. null when nothing is picked.
   */
  onPingPicked?: (remove: (() => void) | null) => void;
  /** The calendar button (✕ while a ping is picked): drop a dragged ping on it to delete it. */
  pingDropZone?: () => Element | null;
  onPingDropHover?: (over: boolean) => void;
  /** The theme of the day on screen (each day keeps its own); the app wears it. */
  onDayTheme: (theme: ThemeId) => void;
  /** Likewise the day's background pattern, which the app lays across the page. */
  onDayPattern: (pattern: PatternId) => void;
  /** 제외 주소: pings there are left out of the shared card (and added ones stay on this phone). */
  excluded: ExcludedPlace[];
  /** Where you are (null: unknown); TODAY offers your pins within 50m of it. */
  here: [number, number] | null;
  pins: Pin[];
  categories: PinCategory[];
  /** The page is still sliding in: the day's pins, lines and 꾸미기 wait to play until it lands. */
  holdIntro?: boolean;
  /**
   * Handed the way to take a photo while TODAY's own day screen is up (null
   * otherwise): the app shows its camera button only then.
   */
  onCamera?: (shoot: (() => void) | null) => void;
  /** The name of a spot (its address lookup), for a photo's ping where there's no pin. */
  nameAt?: (center: [number, number]) => Promise<PlaceRef | null>;
  /** A short line at the bottom (the photo's ping, or why there isn't one). */
  onToast?: (text: string) => void;
}

/** How long the sheet takes to go down when switching tools (matches `tray-down` in styles.css). */
const TRAY_SWAP_MS = 170;

export default function CalendarZoom({ command, onMode, onDecorating, onPingPicked, pingDropZone, onPingDropHover, onDayTheme, onDayPattern, excluded, here, pins, categories, holdIntro = false, onCamera, nameAt, onToast }: CalendarZoomProps) {
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
  // Signed in, another phone's decorations can arrive: show them (without writing them back).
  useEffect(
    () =>
      onPulled((changed) => {
        if (!changed.has('days')) return;
        loaded.current = true;
        setDays(loadDays());
      }),
    [],
  );
  // Undo / redo per day, for this visit only.
  const [history, setHistory] = useState<Record<string, DecorHistory>>({});
  // 꾸미기: which tool is out.
  // and which tool is out.
  const [tool, setTool] = useState<DecorTool | null>(null);
  // The drawing's way in for a sticker peeled off the sheet.
  const placeSticker = useRef<((drop: StickerDrop) => void) | null>(null);
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
  // The month view's year on its way out (and which way the months went: 1 = on to a later year).
  const [yearOut, setYearOut] = useState<{ year: number; dir: -1 | 1 } | null>(null);
  const yearShown = useRef(month.year);
  useEffect(() => {
    if (month.year === yearShown.current) return;
    setYearOut({ year: yearShown.current, dir: month.year > yearShown.current ? 1 : -1 });
    yearShown.current = month.year;
  }, [month.year]);
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
  const stored = useStoredPings();
  const pings = preview || holdIntro ? [] : pingsForDate(shownDate, stored);
  // TODAY's 후보군: your pins within 50m not in today yet. One see-through ping
  // stands for them (at the pin when there's one, else where you are).
  const candidates = todayCandidates(pins, here, stored.filter((p) => p.day === today));
  const [choosing, setChoosing] = useState(false);
  const addToToday = (pin: Pin) => recordPing(pin, excluded);
  const photos = usePingPhotos();
  // 카메라: a photo taken on TODAY pings where you are at once — your pin
  // there if there is one (no 위치 선택 to answer), or the spot itself.
  const camera = useRef<HTMLInputElement | null>(null);
  const photoPing = async (file: File) => {
    const target = photoPingTarget(pins, here, stored.filter((p) => p.day === today));
    if (!target) return onToast?.('위치를 몰라서 핑을 찍지 못했어요');
    const photo = await avatarFromFile(file, PING_PHOTO_PX, 0.8);
    let pingId: string | null;
    let name: string;
    if (target.kind === 'pin') {
      recordPing(target.pin, excluded);
      pingId = todayPingOfPin(target.pin.id);
      name = target.pin.place.name;
    } else if (target.kind === 'same') {
      pingId = target.pingId;
      name = stored.find((p) => p.id === pingId)?.name ?? '';
    } else {
      const named = await nameAt?.(target.center);
      const place = named ? { ...named, center: target.center } : pointPlace(target.center);
      pingId = recordPlacePing(place, excluded);
      name = place.name;
    }
    if (!pingId) return onToast?.('핑을 찍지 못했어요');
    if (!photo && target.kind === 'same') return onToast?.('사진을 읽지 못했어요');
    if (photo) savePingPhoto(pingId, photo, new Set(loadPings().map((p) => p.id)));
    onToast?.(target.kind === 'same' ? `'${name}' 핑에 사진을 붙였어요` : `'${name}' 핑을 찍었어요`);
  };
  // Taking a ping out of the day (its ✕, the calendar button's ✕, or a drop on
  // it) asks first, like deleting a pin on the map.
  const [deleting, setDeleting] = useState<DayPing | null>(null);
  // A ping set to 투명 shows its pin's own look, as on the map (a 미분류 pin by
  // its kind of place; the plain 미분류 pin if the pin is gone).
  const pinLookOf = (ping: DayPing) => {
    const pin = pins.find((p) => p.id === ping.pinId);
    return pinStyle(categories, pin?.categoryId ?? UNCATEGORIZED.id, pin?.place);
  };
  // Landed: remount the drawing so the pins drop, the lines draw and the
  // 꾸미기 settles now, not unseen under the sliding page.
  const held = useRef(holdIntro);
  useEffect(() => {
    if (held.current && !holdIntro) setVisit((v) => v + 1);
    held.current = holdIntro;
  }, [holdIntro]);
  const counts = pingCounts(stored);

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

  // The camera is TODAY's alone (a photo is taken now, so it pings today).
  const canShoot = !!onCamera && shownDate === today && mode === 'day' && !preview && !holdIntro && !tool;
  useEffect(() => {
    onCamera?.(canShoot ? () => camera.current?.click() : null);
  }, [canShoot]);
  useEffect(() => () => onCamera?.(null), []);

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

  // The sheet shows `trayTool`, which trails `tool`: switching tools sends the
  // open sheet down first, then the new one comes up.
  const [trayTool, setTrayTool] = useState<DecorTool | null>(null);
  const [trayLeaving, setTrayLeaving] = useState(false);
  // The app hides the tab buttons while a tool is out, and until its sheet
  // has gone down after. (Leaving the day screen puts the tools away.)
  useEffect(() => onDecorating(tool !== null || trayTool !== null), [tool, trayTool]);
  // Putting a tool away (its button again, or a touch outside) sends the sheet
  // down too, and the buttons below only come back once it's gone. A sheet
  // pulled down by its edge has already slid away itself: it just goes.
  const trayPulledAway = useRef(false);
  useEffect(() => {
    if (!trayTool) {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
      return;
    }
    if (sheetTool === trayTool) {
      setTrayLeaving(false);
      return;
    }
    if (!sheetTool && trayPulledAway.current) {
      trayPulledAway.current = false;
      setTrayTool(null);
      setTrayLeaving(false);
      return;
    }
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

  // ----- Paging days (the < > beside a day; a swipe now changes the screen, App) -----

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
    if (sliding.current || toolRef.current) return;
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
    // No zooming while a sticker or pen is out: fingers belong to the drawing.
    if (e.touches.length !== 2 || toolRef.current) return;
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
        {/* The year up top, where TODAY / DAY n stand on the day screen; the grid names only the month. */}
        {/* Tapping the year goes back to TODAY, whichever year is showing. */}
        <button className="cal-zoom__title cal-zoom__year" aria-label="오늘로" onClick={() => toDay(today)}>
          {/* Crossing into another year, the old one slides off and the new one
              in from the side the months went, as TODAY pages to DAY n. */}
          {yearOut && (
            <span
              key={`out-${yearOut.year}`}
              className="cal-zoom__year-num is-out"
              style={{ '--dir': yearOut.dir } as CSSProperties}
              onAnimationEnd={() => setYearOut(null)}
            >
              {yearOut.year}
            </span>
          )}
          <span key={month.year} className={`cal-zoom__year-num ${yearOut ? 'is-in' : ''}`} style={{ '--dir': yearOut?.dir ?? 1 } as CSSProperties}>
            {month.year}
          </span>
        </button>
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
            setTextFocus(null);
          }}
          labels={{
            names: !dayDecor.hideNames,
            times: !dayDecor.hideTimes,
            onNames: () => {
              const { hideNames, ...rest } = dayDecor;
              changeDecor(hideNames ? rest : { ...rest, hideNames: true });
            },
            onTimes: () => {
              const { hideTimes, ...rest } = dayDecor;
              changeDecor(hideTimes ? rest : { ...rest, hideTimes: true });
            },
          }}
        />
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
              pinLookOf={pinLookOf}
              photoOf={(ping) => (ping.id ? photos[ping.id] : undefined)}
              onDelete={(ping) => ping.id && setDeleting(ping)}
              onPickedChange={(ping) => onPingPicked?.(ping?.id ? () => setDeleting(ping) : null)}
              dropZone={pingDropZone}
              onDropHover={onPingDropHover}
              pressable={() => gesture.current === null && !toolRef.current}
              showNames={!dayDecor.hideNames}
              showTimes={!dayDecor.hideTimes}
              ghost={
                shownDate === today && mode === 'day' && !preview && !holdIntro && !tool && candidates.length
                  ? candidates.length === 1
                    ? candidates[0].place.center
                    : here
                  : null
              }
              onGhost={() => (candidates.length === 1 ? addToToday(candidates[0]) : setChoosing(true))}
            >
              {!holdIntro && (
                <DecorLayer
                  decor={dayDecor}
                  tool={tool}
                  placeRef={placeSticker}
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

      {deleting?.id && (
        <ConfirmDialog
          label="장소 삭제"
          message={`'${deleting.name}' 장소를 삭제합니다.`}
          detail="삭제한 장소는 복구할 수 없어요."
          onConfirm={() => deleting.id && removePing(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* The phone's camera straight away (a file picker on desktop). */}
      <input
        ref={camera}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void photoPing(file);
        }}
      />

      {choosing && candidates.length > 0 && (
        <PlacePickDialog places={candidates} categories={categories} onPick={addToToday} onClose={() => setChoosing(false)} />
      )}

      {trayTool && (
        <DecorTray
          key={trayTool}
          leaving={trayLeaving}
          away={draggingPiece}
          tool={trayTool}
          onPlace={(drop) => placeSticker.current?.(drop)}
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
          onClose={() => {
            trayPulledAway.current = true;
            setTool(null);
          }}
        />
      )}

    </div>
  );
}

import { CalendarDays, MapPin, Share, Users, X } from 'lucide-react';
import CameraButton from './CameraButton';
import { useLayoutEffect, useRef } from 'react';
import { barSlot, barTurn, type AppTab, type BarButton } from '../domain/appTabs';
import { CalendarToday } from './icons';

const BUTTONS: BarButton[] = ['pins', 'people'];
/** One turn of the row. */
const TURN_MS = 300;
/** The small buttons' size, and how far past the row's ends (from the middle) a wrapping one goes. */
const SMALL_PX = 44;
const OFF_PX = 122;

interface BottomBarProps {
  tab: AppTab;
  /**
   * TODAY opened from We Now: the row is only the big calendar button (day ⇄
   * month) and 공유; the pin and people buttons step out.
   */
  today?: boolean;
  /** Day screen or month: what the big calendar button does next. */
  calendarMode: 'day' | 'month';
  /** The calendar button on TODAY: on to the month, or back to TODAY. */
  onCalendar: () => void;
  /** The pin, small on the other screens: back to the map. */
  onMap: () => void;
  /** The blue pin in the middle of the map's row: a new pin where the map is looking. */
  onPin: () => void;
  /** The two-people button: to the people screen. */
  onPeople: () => void;
  /** A day on TODAY: 공유 at the row's right end. */
  onShare?: () => void;
  /** A ping is picked on the day screen: the calendar button is ✕ and deletes it. */
  onDeletePing?: () => void;
  /** A ping is being dragged over the ✕. */
  deleteHot?: boolean;
}

/**
 * The row along the bottom of every screen: the current screen's button big
 * in the dead centre, the other small beside it — map 핑 사람, people 핑 사람
 * (`barSlot`; the calendar button is gone from it, test build 2026-10-19).
 * Pressing the side button slides the row toward it: it grows into the
 * centre and the centre one shrinks to the other side. The buttons stay
 * mounted so the swap is animated. On TODAY (`today`) the row is the big
 * calendar button and 공유 instead.
 */
export default function BottomBar({ tab, today = false, calendarMode, onCalendar, onMap, onPin, onPeople, onShare, onDeletePing, deleteHot = false }: BottomBarProps) {
  const cal = today;
  const map = tab === 'pins';
  // Every move is played from where each button is on screen right now
  // (FLIP): its box is read before the new places land, so a press in the
  // middle of a turn carries on from there instead of jumping. The button
  // that wraps round grows in on the near side while a copy of it (the ghost)
  // slides off the far side at the same time, so the three read as one loop.
  const nav = useRef<HTMLElement>(null);
  const els = useRef<Partial<Record<BarButton, HTMLButtonElement | null>>>({});
  const shown = useRef(tab);
  const before = useRef<{ from: AppTab; rects: Partial<Record<BarButton, DOMRect>> } | null>(null);
  if (tab !== shown.current && !before.current) {
    const rects: Partial<Record<BarButton, DOMRect>> = {};
    for (const b of BUTTONS) {
      const el = els.current[b];
      if (el) rects[b] = el.getBoundingClientRect();
    }
    before.current = { from: shown.current, rects };
  }
  useLayoutEffect(() => {
    const snap = before.current;
    before.current = null;
    shown.current = tab;
    const box = nav.current;
    if (!snap || !box) return;
    const turn = barTurn(snap.from, tab);
    if (!turn) return;
    const navBox = box.getBoundingClientRect();
    const mid = navBox.left + navBox.width / 2;
    const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    const wrapping = BUTTONS.find((b) => barSlot(b, snap.from) === (turn === 1 ? 'r' : 'l'));
    for (const b of BUTTONS) {
      const el = els.current[b];
      const old = snap.rects[b];
      if (!el || !old) continue;
      el.getAnimations().forEach((a) => a.cancel());
      const now = el.getBoundingClientRect();
      const nowX = now.left + now.width / 2;
      if (b === wrapping) {
        // In from just past the near edge, growing up out of its bottom.
        const dx = mid - turn * OFF_PX - nowX;
        el.animate(
          [{ transform: `translateX(${dx}px) scale(0)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: TURN_MS, easing: ease },
        );
        // …while its ghost leaves from wherever it was, off the far edge.
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.className = 'bar-btn bar-ghost';
        ghost.removeAttribute('aria-label');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.tabIndex = -1;
        const oldX = old.left + old.width / 2;
        Object.assign(ghost.style, {
          left: `${oldX - navBox.left - SMALL_PX / 2}px`,
          top: `${old.bottom - navBox.top - SMALL_PX}px`,
          bottom: 'auto',
        });
        box.appendChild(ghost);
        const from = old.width / SMALL_PX;
        ghost
          .animate(
            [
              { transform: `scale(${from})`, opacity: 1 },
              { transform: `translateX(${mid + turn * OFF_PX - oldX}px) scale(0)`, opacity: 0 },
            ],
            { duration: TURN_MS, easing: ease, fill: 'forwards' },
          )
          .finished.then(() => ghost.remove(), () => ghost.remove());
      } else {
        const dx = old.left + old.width / 2 - nowX;
        const dy = old.bottom - now.bottom;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${old.width / now.width})` }, { transform: 'none' }],
          { duration: TURN_MS, easing: ease },
        );
      }
    }
  }, [tab]);
  const cls = (button: BarButton) => `bar-btn bar-slot-${barSlot(button, tab)}`;
  return (
    <nav ref={nav} className={`bottom-bar ${map ? '' : 'bottom-bar--page'} ${cal ? 'bottom-bar--cal' : ''}`} aria-label="메뉴">
      {cal ? (
        <button
          className={`bar-btn bar-slot-c bar-cal ${onDeletePing ? 'is-delete' : ''} ${onDeletePing && deleteHot ? 'is-hot' : ''}`}
          aria-label={onDeletePing ? '핑 삭제' : calendarMode === 'day' ? '월 달력' : '오늘'}
          onClick={onDeletePing ?? onCalendar}
        >
          {/* Shows where the press goes: the month grid from a day, today's date
              from the month; ✕ while a ping is picked (tap it or drop the ping on it). */}
          {onDeletePing ? <X strokeWidth={2.4} aria-hidden /> : calendarMode === 'day' ? <CalendarDays strokeWidth={2.2} aria-hidden /> : <CalendarToday />}
        </button>
      ) : (
        <>
          <button ref={(el) => void (els.current.pins = el)} className={`${cls('pins')} bar-pin`} aria-label={map ? '지도에 핀 꽂기' : '지도'} onClick={map ? onPin : onMap}>
            <MapPin strokeWidth={2.2} aria-hidden />
          </button>
          <button
            ref={(el) => void (els.current.people = el)}
            className={`${cls('people')} bar-people`}
            aria-label="We Now"
            aria-current={tab === 'people' ? 'page' : undefined}
            onClick={tab === 'people' ? undefined : onPeople}
          >
            <Users strokeWidth={2.2} aria-hidden />
          </button>
        </>
      )}
      {/* The map and We Now share the camera at the row's right end (TODAY has 공유 there). */}
      {!cal && <CameraButton className="bar-camera" />}
      {onShare && (
        <button className="bar-share" aria-label="공유" onClick={onShare}>
          <Share size={24} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    </nav>
  );
}

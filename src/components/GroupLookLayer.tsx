import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { EDGE_STYLES, PING_SHAPES, PRESS, type LineLook, type PingLook } from '../domain/dayPings';
import { edgeLookKey, pingLookKey, type GroupLooks, type GroupPing } from '../domain/groups';
import { PingIcon } from './DayPings';
import { pingCentre } from './GroupLines';
import { distanceToSegment, EdgeSample } from './RouteStyleLayer';

/** How near a line a press must be to count as on it. */
const EDGE_HIT_PX = 16;

type Target = { kind: 'ping'; seq: number } | { kind: 'edge'; seq: number };

interface GroupLookLayerProps {
  /** The group's map (the atlas): presses count only there. */
  rootRef: RefObject<HTMLElement | null>;
  /** My user id: only my own pings and lines are pressed into shape. */
  me: string;
  /** My pings on the map, in order (`seq` as the markers carry it). */
  pings: GroupPing[];
  looks?: GroupLooks;
  onLook(kind: 'ping' | 'edge', key: string, look: PingLook | LineLook | null): void;
}

/**
 * What a press at a screen point is on: one of my pin pings (not my latest,
 * drawn as my face, nor a place shared with someone, drawn for everyone),
 * else the nearest leg of my day close enough — but not where anyone's pin,
 * face or photo is (a tap there opens that place). A photo over a ping is
 * the photo's, not the ping's.
 */
export function lookTargetAt(x: number, y: number, me: string, count: number): Target | null {
  for (const photo of document.querySelectorAll<HTMLElement>('.group-ping__photo')) {
    const r = photo.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return null;
  }
  const sel = `.group-ping[data-member="${CSS.escape(me)}"]:not(.group-ping--face):not(.is-together):not(.group-ping--ghost) .group-ping__pin`;
  for (const pin of document.querySelectorAll<HTMLElement>(sel)) {
    const r = pin.getBoundingClientRect();
    if (x < r.left - 6 || x > r.right + 6 || y < r.top - 6 || y > r.bottom + 6) continue;
    const seq = Number(pin.closest<HTMLElement>('.group-ping')?.dataset.seq);
    if (Number.isInteger(seq)) return { kind: 'ping', seq };
  }
  // Anyone's pin, face or photo is over the lines: a tap there is for that ping.
  for (const part of document.querySelectorAll<HTMLElement>('.group-ping:not(.group-ping--ghost) > :not(.group-ping__label)')) {
    const r = part.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return null;
  }
  let best: Target | null = null;
  let bestD = EDGE_HIT_PX;
  for (let k = 0; k < count - 1; k += 1) {
    const a = pingCentre(me, k);
    const b = pingCentre(me, k + 1);
    if (!a || !b) continue;
    const d = distanceToSegment({ x, y }, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    if (d < bestD) {
      bestD = d;
      best = { kind: 'edge', seq: k };
    }
  }
  return best;
}

/**
 * A group's map, my own day: tap or long-press one of my pings for its shape (핀 ·
 * 점 · 별 · 하트, or 투명) or a line between two for its style (실선 · 파선 ·
 * 점선 · 굵은 선, or 투명) — the same picker as TODAY's and a route's. The
 * look is this group's (everyone in it sees it). Presses are watched on the
 * document (the pings let them through to the atlas); the click after is
 * swallowed, and App leaves such a tap be rather than reading it as a tap on
 * the map (it asks `lookTargetAt` too).
 */
export default function GroupLookLayer({ rootRef, me, pings, looks, onLook }: GroupLookLayerProps) {
  const [picking, setPicking] = useState<(Target & { x: number; y: number }) | null>(null);
  const count = useRef(pings.length);
  count.current = pings.length;

  useEffect(() => {
    let press: { x: number; y: number; timer: number; open(): void } | null = null;
    const cancel = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
    };
    const down = (e: PointerEvent) => {
      cancel();
      const root = rootRef.current;
      if (!e.isPrimary || !root || !root.contains(e.target as Node)) return;
      // A touch that only closes an open picker doesn't open another; nor does a doodle on the day's board.
      if (document.querySelector('.group-look-picker, .group-board.is-drawing')) return;
      const target = lookTargetAt(e.clientX, e.clientY, me, count.current);
      if (!target) return;
      const p = {
        x: e.clientX,
        y: e.clientY,
        timer: 0,
        open() {
          window.clearTimeout(p.timer);
          press = null;
          setPicking({ ...target, x: p.x, y: p.y });
          navigator.vibrate?.(10);
          const swallow = (c: MouseEvent) => {
            c.stopPropagation();
            c.preventDefault();
          };
          document.addEventListener('click', swallow, { capture: true, once: true });
          window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 600);
        },
      };
      // Held: opens while still down. Let go sooner (without moving off): opens then.
      p.timer = window.setTimeout(() => p.open(), PRESS.longMs);
      press = p;
    };
    const move = (e: PointerEvent) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS.slopPx) cancel();
    };
    const up = (e: PointerEvent) => {
      if (press && e.isPrimary) press.open();
      else cancel();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
  }, [rootRef, me]);

  // A touch anywhere but the picker closes it (App lets that touch be, rather than reading it as a tap on the map).
  useEffect(() => {
    if (!picking) return;
    const away = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.group-look-picker')) return;
      setPicking(null);
    };
    // Next tick: the long press's own pointer is still down.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', away, true));
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [picking]);

  // The day moved on under it (a ping deleted, another day): the picker's ping may be gone.
  const from = picking ? pings[picking.seq] : undefined;
  const to = picking?.kind === 'edge' ? pings[picking.seq + 1] : undefined;
  if (!picking || !from || (picking.kind === 'edge' && !to)) return null;
  const key = picking.kind === 'ping' ? pingLookKey(from) : edgeLookKey(from, to!);
  const now = picking.kind === 'ping' ? (looks?.pings[key] ?? 'pin') : (looks?.edges[key] ?? 'solid');
  const choose = (look: PingLook | LineLook) => {
    const plain = picking.kind === 'ping' ? 'pin' : 'solid';
    onLook(picking.kind, key, look === plain ? null : look);
    setPicking(null);
  };
  const style = { '--x': `${picking.x}px`, '--y': `${picking.y}px` } as CSSProperties;
  return (
    <div className="ping-picker route-style-picker group-look-picker" role="dialog" aria-label={picking.kind === 'ping' ? '핑 모양' : '선 스타일'} style={style}>
      <button
        className={`ping-picker__opt ${now === 'transparent' ? 'is-on' : ''}`}
        aria-label={picking.kind === 'ping' ? '투명 핑' : '투명 선'}
        aria-pressed={now === 'transparent'}
        onClick={() => choose('transparent')}
      />
      {picking.kind === 'ping'
        ? PING_SHAPES.map(({ shape, label }) => (
            <button key={shape} className={`ping-picker__opt ${now === shape ? 'is-on' : ''}`} aria-label={label} aria-pressed={now === shape} onClick={() => choose(shape)}>
              <PingIcon shape={shape} />
            </button>
          ))
        : EDGE_STYLES.map(({ style: s, label }) => (
            <button key={s} className={`ping-picker__opt ${now === s ? 'is-on' : ''}`} aria-label={label} aria-pressed={now === s} onClick={() => choose(s)}>
              <EdgeSample style={s} />
            </button>
          ))}
    </div>
  );
}

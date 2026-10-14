import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  classifyPress,
  EDGE_STYLES,
  latestPingIndex,
  layoutPings,
  PING_SHAPES,
  PRESS,
  type DayPing,
  type EdgeStyle,
  type LineLook,
  type PingLook,
  type PingShape,
} from '../domain/dayPings';
import { pinColorCss } from '../domain/pin';
import { HEART_PATH, PIN_PATH, STAR_PATH } from '../lib/pingPaths';
import { labelSide } from '../domain/stopLabels';
import type { PinIcon, PinTint } from '../types/pin';
import PinGlyph from './PinGlyph';

export function PingIcon({ shape, className }: { shape: PingShape; className?: string }) {
  if (shape === 'pin') {
    return (
      <svg className={className} viewBox="4 1.5 16 20.5" aria-hidden>
        <path d={PIN_PATH} />
        <circle className="ping__hole" cx="12" cy="10" r="3" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="1.5 1.5 21 21" aria-hidden>
      {shape === 'dot' && <circle cx="12" cy="12" r="8.5" />}
      {shape === 'star' && <path d={STAR_PATH} />}
      {shape === 'heart' && <path d={HEART_PATH} />}
    </svg>
  );
}

interface DayPingsProps {
  pings: DayPing[];
  shapeOf: (ping: DayPing) => PingLook;
  onShape: (ping: DayPing, shape: PingLook) => void;
  /** Style of the line from `pings[i]` to `pings[i + 1]`. */
  edgeStyleOf: (from: DayPing, to: DayPing) => LineLook;
  onEdgeStyle: (from: DayPing, to: DayPing, style: LineLook) => void;
  /** The place's own pin icon and colour, shown when its ping is set to 투명. */
  pinLookOf?: (ping: DayPing) => { icon: PinIcon; color: PinTint };
  /** The ✕ on a ping whose picker is open (or a ping dropped on `dropZone`): takes the place out of the day. */
  onDelete?: (ping: DayPing) => void;
  /** Which ping is picked (its picker open), or null: the app turns its calendar button into ✕. */
  onPickedChange?: (ping: DayPing | null) => void;
  /** Where a dragged ping is dropped to delete it (the calendar button turned ✕). */
  dropZone?: () => Element | null;
  /** A dragged ping is over `dropZone` (it lights up). */
  onDropHover?: (over: boolean) => void;
  /** False while a pinch or a day swipe is running, so its fingers don't count as presses. */
  pressable: () => boolean;
  /** Drawn inside the same box, above the pins (stickers and pen strokes). */
  children?: ReactNode;
  /** The day's 텍스트 / 시간 switches: the place names and visit times under the pings. */
  showNames?: boolean;
  showTimes?: boolean;
  /**
   * TODAY's 후보군 waiting to be added: one see-through ping at this place,
   * hanging where a ping drops from, not joined to the others. Laid out with
   * the day's pings, so it lands on the same spot once added.
   */
  ghost?: [number, number] | null;
  onGhost?: () => void;
}

/** What a press is on: a ping, or the line leaving ping `index` for the next one. */
type Target = { kind: 'ping' | 'edge'; index: number };

interface Press {
  target: Target;
  x: number;
  y: number;
  start: number;
  timer: number;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const same = (a: Target | null, b: Target) => a !== null && a.kind === b.kind && a.index === b.index;

/** A short sample of a line style, for the picker. */
function EdgeSample({ style }: { style: EdgeStyle }) {
  return (
    <svg viewBox="0 0 28 12" aria-hidden>
      <line className={`pings__seg pings__seg--${style}`} x1="3" y1="6" x2="25" y2="6" />
    </svg>
  );
}

/**
 * A day's pings drawn without a map, spread over the drawing in their
 * relative directions and joined in visiting order; the latest is bigger.
 * Mounted fresh on each visit so the pins drop in and the line draws itself
 * again. Long-press a ping to change its shape, or a line to change its
 * style; a short tap on a ping is reported through `onTap`.
 */
export default function DayPings({ pings, shapeOf, onShape, edgeStyleOf, onEdgeStyle, pinLookOf, onDelete, onPickedChange, dropZone, onDropHover, pressable, children, showNames = true, showTimes = true, ghost = null, onGhost }: DayPingsProps) {
  const latest = latestPingIndex(pings);
  const laid = layoutPings([...pings.map((p) => p.center), ...(ghost ? [ghost] : [])]);
  const points = laid.slice(0, pings.length);
  const ghostAt = ghost ? laid[pings.length] : null;
  // Pings there when this drawing mounted play the visit's intro together;
  // ones added after (a 후보군 picked) drop on their own and draw their line.
  const atMount = useRef(pings.length);
  const settled = Math.min(atMount.current, pings.length);
  const maskId = `pings-reveal-${useId().replace(/:/g, '')}`;
  const press = useRef<Press | null>(null);
  const [pressed, setPressed] = useState<Target | null>(null);
  const [picking, setPicking] = useState<Target | null>(null);
  // A ping being dragged (pressed and moved): it follows the finger; dropped on
  // the ✕ (the calendar button) it's deleted, anywhere else it goes back.
  const [drag, setDrag] = useState<{ index: number; dx: number; dy: number; over: boolean } | null>(null);
  const dragging = useRef(false);

  // The picked ping, for the app's ✕. A ping gone from the list (deleted) unpicks.
  const pickedPing = picking?.kind === 'ping' ? pings[picking.index] : undefined;
  const idsKey = pings.map((p) => p.id ?? `${p.time}|${p.name}`).join(',');
  useEffect(() => setPicking(null), [idsKey]);
  // Keyed by identity, not the object: the list is rebuilt on every render.
  const pickedKey = pickedPing ? (pickedPing.id ?? `${pickedPing.time}|${pickedPing.name}`) : null;
  useEffect(() => {
    onPickedChange?.(pickedPing ?? null);
  }, [pickedKey]);
  useEffect(() => () => onPickedChange?.(null), []);

  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(null);
  };

  useEffect(() => () => endPress(), []);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const overDrop = (x: number, y: number) => {
    const r = dropZone?.()?.getBoundingClientRect();
    return !!r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8;
  };

  const stopDrag = () => {
    dragging.current = false;
    setDrag(null);
    onDropHover?.(false);
  };

  const onPointerDown = (target: Target) => (e: PointerEvent) => {
    if (!e.isPrimary || !pressable()) return;
    endPress();
    // Keep getting the moves when the finger leaves the ping (a drag to the ✕).
    if (target.kind === 'ping') {
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer (synthetic): moves still come while over the ping.
      }
    }
    const timer = window.setTimeout(() => {
      if (!press.current || !pressable()) return endPress();
      endPress();
      setPicking(target);
      navigator.vibrate?.(15);
    }, PRESS.longMs);
    press.current = { target, x: e.clientX, y: e.clientY, start: performance.now(), timer };
    setPressed(target);
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    const [dx, dy] = [e.clientX - p.x, e.clientY - p.y];
    if (dragging.current) {
      const over = overDrop(e.clientX, e.clientY);
      setDrag({ index: p.target.index, dx, dy, over });
      onDropHover?.(over);
      return;
    }
    if (classifyPress(0, Math.hypot(dx, dy)) !== 'none') return;
    // A ping pressed and moved is picked up (and picked: the calendar button turns ✕).
    if (p.target.kind === 'ping' && onDelete && pressable()) {
      window.clearTimeout(p.timer);
      dragging.current = true;
      setPressed(null);
      setPicking(p.target);
      setDrag({ index: p.target.index, dx, dy, over: false });
      return;
    }
    endPress();
  };

  const onPointerUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (dragging.current) {
      const ping = pings[p.target.index];
      const dropped = overDrop(e.clientX, e.clientY);
      press.current = null;
      stopDrag();
      if (dropped && ping) onDelete?.(ping);
      return;
    }
    const kind = classifyPress(performance.now() - p.start, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    endPress();
    // A tap opens the same picker a long press does (shape / line style, and a ping's ✕).
    if (kind === 'tap' && pressable()) setPicking(p.target);
  };

  const pressHandlers = (target: Target) => ({
    onPointerDown: onPointerDown(target),
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => {
      stopDrag();
      endPress();
    },
    // Captured while dragging, so leaving the ping doesn't end it.
    onPointerLeave: () => dragging.current || endPress(),
    // A press on a ping is the ping's: no day swipe or page swipe starts from it.
    ...(target.kind === 'ping' ? { onTouchStart: stop, onTouchMove: stop, onTouchEnd: stop } : {}),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Keyboard stand-ins for the tap: Enter, Space or the menu key.
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ContextMenu' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setPicking(target);
      }
    },
  });

  const segments = points.slice(1).map((to, i) => ({ from: points[i], to, i }));
  const pointsAttr = points
    .slice(0, settled)
    .map((p) => `${p.x * 100},${p.y * 100}`)
    .join(' ');
  const lineOf = (i: number) => (
    <line
      key={i}
      className={`pings__seg pings__seg--${edgeStyleOf(pings[i], pings[i + 1])} ${same(pressed, { kind: 'edge', index: i }) ? 'is-pressed' : ''}`}
      x1={points[i].x * 100}
      y1={points[i].y * 100}
      x2={points[i + 1].x * 100}
      y2={points[i + 1].y * 100}
    />
  );

  // Where the open picker sits: above its ping, or above the middle of its line.
  let pickerAt: { x: number; y: number } | null = null;
  if (picking?.kind === 'ping') pickerAt = points[picking.index];
  else if (picking?.kind === 'edge') {
    const [a, b] = [points[picking.index], points[picking.index + 1]];
    pickerAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  return (
    <div className={`pings ${picking || drag ? 'is-picking' : ''}`} role="list" aria-label={pings.length ? `${pings.length}곳` : '기록 없음'}>
      {points.length > 1 && (
        <svg className="pings__line" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {/* The draw-in runs on this mask, so each line keeps its own dash pattern. */}
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
              <polyline className="pings__reveal" pathLength={1} points={pointsAttr} />
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>{segments.filter(({ i }) => i + 1 < settled).map(({ i }) => lineOf(i))}</g>
          {/* A line to a ping added later draws itself once that ping has landed. */}
          {segments
            .filter(({ i }) => i + 1 >= settled)
            .map(({ from, to, i }) => (
              <g key={`late-${i}`}>
                <mask id={`${maskId}-${i}`} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
                  <polyline className="pings__reveal pings__reveal--late" pathLength={1} points={`${from.x * 100},${from.y * 100} ${to.x * 100},${to.y * 100}`} />
                </mask>
                <g mask={`url(#${maskId}-${i})`}>{lineOf(i)}</g>
              </g>
            ))}
          {/* Wide invisible strokes to press; the pins sit above them. */}
          {segments.map(({ from, to, i }) => (
            <line
              key={`hit-${i}`}
              className="pings__hitline"
              x1={from.x * 100}
              y1={from.y * 100}
              x2={to.x * 100}
              y2={to.y * 100}
              role="button"
              tabIndex={0}
              aria-label={`${pings[i].name}에서 ${pings[i + 1].name}까지 선`}
              aria-haspopup="dialog"
              {...pressHandlers({ kind: 'edge', index: i })}
            />
          ))}
        </svg>
      )}
      {pings.map((ping, i) => {
        const shape = shapeOf(ping);
        const own = shape === 'transparent' ? (pinLookOf?.(ping) ?? { icon: 'pin' as PinIcon, color: 0 as PinTint }) : null;
        // Its name goes below it unless one of its lines leaves that way (as a route's stops do).
        const side = labelSide(points[i], [points[i - 1], points[i + 1]].filter((p): p is { x: number; y: number } => !!p));
        return (
          <div
            key={`${ping.time}-${ping.name}`}
            className={[
              'ping',
              `ping--${shape}`,
              `ping--label-${side}`,
              i === latest ? 'ping--latest' : '',
              i >= settled ? 'ping--late' : '',
              same(pressed, { kind: 'ping', index: i }) ? 'is-pressed' : '',
              same(picking, { kind: 'ping', index: i }) ? 'is-picked' : '',
              drag?.index === i ? `is-dragging ${drag.over ? 'is-over' : ''}` : '',
            ].join(' ')}
            role="listitem"
            style={{
              left: drag?.index === i ? `calc(${points[i].x * 100}% + ${drag.dx}px)` : `${points[i].x * 100}%`,
              top: drag?.index === i ? `calc(${points[i].y * 100}% + ${drag.dy}px)` : `${points[i].y * 100}%`,
              ...(i < settled ? { animationDelay: `${120 + i * 110}ms` } : {}),
            }}
          >
            <button
              className="ping__hit"
              aria-label={`${ping.time} ${ping.name}`}
              aria-haspopup="dialog"
              {...pressHandlers({ kind: 'ping', index: i })}
            >
              {own ? (
                <span className="ping__icon ping__own" style={{ '--pin': pinColorCss(own.color) } as CSSProperties}>
                  <PinGlyph icon={own.icon} />
                </span>
              ) : (
                <PingIcon shape={shape as PingShape} className="ping__icon" />
              )}
            </button>
            {(showNames || showTimes) && (
              <span className="ping__label" aria-hidden>
                {showNames && ping.name}
                {showTimes && <small>{ping.time}</small>}
              </span>
            )}
          </div>
        );
      })}

      {ghostAt && (
        // Drawn as the newest it'll become (bigger), see-through and held up.
        <div className="ping ping--pin ping--latest ping--ghost" style={{ left: `${ghostAt.x * 100}%`, top: `${ghostAt.y * 100}%` }}>
          <button className="ping__hit" aria-label="여기 있는 장소를 오늘에 추가" onClick={() => pressable() && onGhost?.()}>
            <PingIcon shape="pin" className="ping__icon" />
          </button>
        </div>
      )}

      {children}

      {picking && pickerAt && !drag && (
        <>
          <div className="ping-picker__backdrop" onPointerDown={() => setPicking(null)} aria-hidden />
          {picking.kind === 'ping' && onDelete && (
            // On the icon's top-right corner, overlapping it a little (above the backdrop).
            <button
              className={`ping__delete ${shapeOf(pings[picking.index]) === 'pin' ? '' : 'ping__delete--round'} ${picking.index === latest ? 'ping__delete--latest' : ''}`}
              style={{ left: `${pickerAt.x * 100}%`, top: `${pickerAt.y * 100}%` }}
              aria-label={`${pings[picking.index].name} 삭제`}
              onClick={() => {
                onDelete(pings[picking.index]);
                setPicking(null);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
          )}
          <div
            className={`ping-picker ${picking.kind === 'edge' ? 'ping-picker--edge' : ''}`}
            role="dialog"
            aria-label={
              picking.kind === 'ping'
                ? `${pings[picking.index].name} 핑 모양`
                : `${pings[picking.index].name}–${pings[picking.index + 1].name} 선 스타일`
            }
            // Centred right over its ping (or its line's middle). --rise: how far the
            // icon stands above its point (a pin stands on it, the round shapes centre on it).
            style={
              {
                left: `${pickerAt.x * 100}%`,
                top: `${pickerAt.y * 100}%`,
                '--rise':
                  picking.kind === 'ping'
                    ? `${(shapeOf(pings[picking.index]) === 'pin' ? 44 : 15) * (picking.index === latest ? 1.4 : 1)}px`
                    : '0px',
              } as CSSProperties
            }
          >
            {/* 투명: the empty first slot, as on a route — the place's own icon, or no line. */}
            {(() => {
              const on =
                picking.kind === 'ping'
                  ? shapeOf(pings[picking.index]) === 'transparent'
                  : edgeStyleOf(pings[picking.index], pings[picking.index + 1]) === 'transparent';
              return (
                <button
                  className={`ping-picker__opt ${on ? 'is-on' : ''}`}
                  aria-label={picking.kind === 'ping' ? '투명 · 장소 아이콘' : '투명 선'}
                  aria-pressed={on}
                  onClick={() => {
                    if (picking.kind === 'ping') onShape(pings[picking.index], 'transparent');
                    else onEdgeStyle(pings[picking.index], pings[picking.index + 1], 'transparent');
                    setPicking(null);
                  }}
                />
              );
            })()}
            {picking.kind === 'ping'
              ? PING_SHAPES.map(({ shape, label }) => {
                  const ping = pings[picking.index];
                  const on = shapeOf(ping) === shape;
                  return (
                    <button
                      key={shape}
                      className={`ping-picker__opt ${on ? 'is-on' : ''}`}
                      aria-label={label}
                      aria-pressed={on}
                      onClick={() => {
                        onShape(ping, shape);
                        setPicking(null);
                      }}
                    >
                      <PingIcon shape={shape} />
                    </button>
                  );
                })
              : EDGE_STYLES.map(({ style, label }) => {
                  const [from, to] = [pings[picking.index], pings[picking.index + 1]];
                  const on = edgeStyleOf(from, to) === style;
                  return (
                    <button
                      key={style}
                      className={`ping-picker__opt ${on ? 'is-on' : ''}`}
                      aria-label={label}
                      aria-pressed={on}
                      onClick={() => {
                        onEdgeStyle(from, to, style);
                        setPicking(null);
                      }}
                    >
                      <EdgeSample style={style} />
                    </button>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
}

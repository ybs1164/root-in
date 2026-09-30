import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import {
  classifyPress,
  EDGE_STYLES,
  latestPingIndex,
  layoutPings,
  PING_SHAPES,
  PRESS,
  type DayPing,
  type EdgeStyle,
  type PingShape,
} from '../domain/dayPings';

const PIN_PATH = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';
// Lucide geometry (ISC).
const STAR_PATH =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';
const HEART_PATH =
  'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5';

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
  shapeOf: (ping: DayPing) => PingShape;
  onShape: (ping: DayPing, shape: PingShape) => void;
  /** Style of the line from `pings[i]` to `pings[i + 1]`. */
  edgeStyleOf: (from: DayPing, to: DayPing) => EdgeStyle;
  onEdgeStyle: (from: DayPing, to: DayPing, style: EdgeStyle) => void;
  /** Short tap on a ping. Recognised only for now; what it does comes later. */
  onTap: (ping: DayPing) => void;
  /** False while a pinch or a day swipe is running, so its fingers don't count as presses. */
  pressable: () => boolean;
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
export default function DayPings({ pings, shapeOf, onShape, edgeStyleOf, onEdgeStyle, onTap, pressable }: DayPingsProps) {
  const latest = latestPingIndex(pings);
  const points = layoutPings(pings.map((p) => p.center));
  const maskId = `pings-reveal-${useId().replace(/:/g, '')}`;
  const press = useRef<Press | null>(null);
  const [pressed, setPressed] = useState<Target | null>(null);
  const [picking, setPicking] = useState<Target | null>(null);

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

  const onPointerDown = (target: Target) => (e: PointerEvent) => {
    if (!e.isPrimary || !pressable()) return;
    endPress();
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
    if (p && classifyPress(0, Math.hypot(e.clientX - p.x, e.clientY - p.y)) === 'none') endPress();
  };

  const onPointerUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    const kind = classifyPress(performance.now() - p.start, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    endPress();
    // Taps only mean something on pings (for now); a tapped line does nothing.
    if (kind === 'tap' && p.target.kind === 'ping' && pressable()) onTap(pings[p.target.index]);
  };

  const pressHandlers = (target: Target) => ({
    onPointerDown: onPointerDown(target),
    onPointerMove,
    onPointerUp,
    onPointerCancel: endPress,
    onPointerLeave: endPress,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Keyboard stand-ins: Enter = tap, Shift+Enter or the menu key = long press.
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ContextMenu' || (e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault();
        setPicking(target);
      } else if ((e.key === 'Enter' || e.key === ' ') && target.kind === 'ping') {
        e.preventDefault();
        onTap(pings[target.index]);
      }
    },
  });

  const segments = points.slice(1).map((to, i) => ({ from: points[i], to, i }));
  const pointsAttr = points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  // Where the open picker sits: above its ping, or above the middle of its line.
  let pickerAt: { x: number; y: number } | null = null;
  if (picking?.kind === 'ping') pickerAt = points[picking.index];
  else if (picking?.kind === 'edge') {
    const [a, b] = [points[picking.index], points[picking.index + 1]];
    pickerAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  return (
    <div className="pings" role="list" aria-label={pings.length ? `${pings.length}곳` : '기록 없음'}>
      {points.length > 1 && (
        <svg className="pings__line" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {/* The draw-in runs on this mask, so each line keeps its own dash pattern. */}
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
              <polyline className="pings__reveal" pathLength={1} points={pointsAttr} />
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {segments.map(({ from, to, i }) => (
              <line
                key={i}
                className={`pings__seg pings__seg--${edgeStyleOf(pings[i], pings[i + 1])} ${same(pressed, { kind: 'edge', index: i }) ? 'is-pressed' : ''}`}
                x1={from.x * 100}
                y1={from.y * 100}
                x2={to.x * 100}
                y2={to.y * 100}
              />
            ))}
          </g>
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
        return (
          <div
            key={`${ping.time}-${ping.name}`}
            className={[
              'ping',
              `ping--${shape}`,
              i === latest ? 'ping--latest' : '',
              same(pressed, { kind: 'ping', index: i }) ? 'is-pressed' : '',
            ].join(' ')}
            role="listitem"
            style={{ left: `${points[i].x * 100}%`, top: `${points[i].y * 100}%`, animationDelay: `${120 + i * 110}ms` }}
          >
            <button
              className="ping__hit"
              aria-label={`${ping.time} ${ping.name}`}
              aria-haspopup="dialog"
              {...pressHandlers({ kind: 'ping', index: i })}
            >
              <PingIcon shape={shape} className="ping__icon" />
            </button>
            <span className="ping__label" aria-hidden>
              {ping.name}
              <small>{ping.time}</small>
            </span>
          </div>
        );
      })}

      {picking && pickerAt && (
        <>
          <div className="ping-picker__backdrop" onPointerDown={() => setPicking(null)} aria-hidden />
          <div
            className={`ping-picker ${picking.kind === 'edge' ? 'ping-picker--edge' : ''}`}
            role="dialog"
            aria-label={
              picking.kind === 'ping'
                ? `${pings[picking.index].name} 핑 모양`
                : `${pings[picking.index].name}–${pings[picking.index + 1].name} 선 스타일`
            }
            // --x feeds a clamp() in CSS that keeps the picker inside the box.
            style={{ '--x': `${pickerAt.x * 100}%`, top: `${pickerAt.y * 100}%` } as CSSProperties}
          >
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

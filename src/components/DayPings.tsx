import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { classifyPress, latestPingIndex, layoutPings, PING_SHAPES, PRESS, type DayPing, type PingShape } from '../domain/dayPings';

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
  /** Short tap on a ping. Recognised only for now; what it does comes later. */
  onTap: (ping: DayPing) => void;
  /** False while a pinch is running, so its fingers don't count as presses. */
  pressable: () => boolean;
}

interface Press {
  index: number;
  x: number;
  y: number;
  start: number;
  timer: number;
}

/**
 * A day's pings drawn without a map: pins at their relative real positions
 * around the latest one, joined in visiting order. Mounted fresh on each
 * visit so the pins drop in and the line draws itself again. Long-press a
 * ping to change its shape; a short tap is reported through `onTap`.
 */
export default function DayPings({ pings, shapeOf, onShape, onTap, pressable }: DayPingsProps) {
  const latest = latestPingIndex(pings);
  const points = layoutPings(
    pings.map((p) => p.center),
    latest,
  );
  const press = useRef<Press | null>(null);
  const [pressed, setPressed] = useState(-1);
  const [picking, setPicking] = useState(-1);

  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(-1);
  };

  useEffect(() => () => endPress(), []);

  useEffect(() => {
    if (picking < 0) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(-1);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const onPointerDown = (index: number) => (e: PointerEvent) => {
    if (!e.isPrimary || !pressable()) return;
    endPress();
    const timer = window.setTimeout(() => {
      if (!press.current || !pressable()) return endPress();
      endPress();
      setPicking(index);
      navigator.vibrate?.(15);
    }, PRESS.longMs);
    press.current = { index, x: e.clientX, y: e.clientY, start: performance.now(), timer };
    setPressed(index);
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
    if (kind === 'tap' && pressable()) onTap(pings[p.index]);
  };

  const picked = picking >= 0 ? pings[picking] : null;

  return (
    <div className="pings" role="list" aria-label={pings.length ? `${pings.length}곳` : '기록 없음'}>
      {points.length > 1 && (
        <svg className="pings__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline pathLength={1} points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
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
              i === pressed ? 'is-pressed' : '',
            ].join(' ')}
            role="listitem"
            style={{ left: `${points[i].x * 100}%`, top: `${points[i].y * 100}%`, animationDelay: `${120 + i * 110}ms` }}
          >
            <button
              className="ping__hit"
              aria-label={`${ping.time} ${ping.name}`}
              aria-haspopup="dialog"
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={endPress}
              onPointerLeave={endPress}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                // Keyboard stand-ins: Enter = tap, Shift+Enter or the menu key = long press.
                if (e.key === 'ContextMenu' || (e.key === 'Enter' && e.shiftKey)) {
                  e.preventDefault();
                  setPicking(i);
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTap(ping);
                }
              }}
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

      {picked && (
        <>
          <div className="ping-picker__backdrop" onPointerDown={() => setPicking(-1)} aria-hidden />
          <div
            className="ping-picker"
            role="dialog"
            aria-label={`${picked.name} 핑 모양`}
            // --x feeds a clamp() in CSS that keeps the picker inside the box.
            style={{ '--x': `${points[picking].x * 100}%`, top: `${points[picking].y * 100}%` } as CSSProperties}
          >
            {PING_SHAPES.map(({ shape, label }) => (
              <button
                key={shape}
                className={`ping-picker__opt ${shapeOf(picked) === shape ? 'is-on' : ''}`}
                aria-label={label}
                aria-pressed={shapeOf(picked) === shape}
                onClick={() => {
                  onShape(picked, shape);
                  setPicking(-1);
                }}
              >
                <PingIcon shape={shape} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

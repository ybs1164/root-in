import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { EDGE_STYLES, PING_SHAPES, PRESS, type EdgeStyle } from '../domain/dayPings';
import type { RouteEdgeStyle, RouteStopShape } from '../domain/routeStyle';
import { PingIcon } from './DayPings';
import { stopCentre } from './StopLines';

interface RouteStyleLayerProps {
  mapEl: HTMLElement | null;
  stopCount: number;
  stopShapes?: (RouteStopShape | null)[];
  edgeStyles?: (RouteEdgeStyle | null)[];
  onStopShape: (index: number, shape: RouteStopShape | null) => void;
  onEdgeStyle: (index: number, style: RouteEdgeStyle | null) => void;
}

type Target = { kind: 'stop' | 'edge'; index: number };

/** How near a line a press must be to count as on it. */
const EDGE_HIT_PX = 16;

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** What a press at a screen point is on: a stop marker, else the nearest line close enough. */
function targetAt(x: number, y: number, el: Element | null, stopCount: number): Target | null {
  const stop = el?.closest<HTMLElement>('.map-marker[data-stop]');
  if (stop) return { kind: 'stop', index: Number(stop.dataset.stop) - 1 };
  let best: Target | null = null;
  let bestD = EDGE_HIT_PX;
  for (let i = 0; i < stopCount - 1; i += 1) {
    const a = stopCentre(i + 1);
    const b = stopCentre(i + 2);
    if (!a || !b) continue;
    const d = distanceToSegment({ x, y }, a, b);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'edge', index: i };
    }
  }
  return best;
}

/** A short sample of a line style, for the picker. */
function EdgeSample({ style }: { style: EdgeStyle }) {
  return (
    <svg viewBox="0 0 28 12" aria-hidden>
      <line className={`pings__seg pings__seg--${style}`} x1="3" y1="6" x2="25" y2="6" />
    </svg>
  );
}

/**
 * Restyling a saved route on the map, as on a calendar day: long-press a stop
 * for its shape (or back to its number), or a line for its style. Presses
 * are watched on the document (capture) but only count on the map; the click
 * after a long press is swallowed so the stop doesn't also act on it.
 */
export default function RouteStyleLayer({ mapEl, stopCount, stopShapes, edgeStyles, onStopShape, onEdgeStyle }: RouteStyleLayerProps) {
  const [picking, setPicking] = useState<(Target & { x: number; y: number }) | null>(null);
  const countRef = useRef(stopCount);
  countRef.current = stopCount;

  useEffect(() => {
    if (!mapEl) return;
    let press: { target: Target; x: number; y: number; timer: number } | null = null;
    const cancel = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
    };
    const down = (e: PointerEvent) => {
      cancel();
      if (!e.isPrimary || !mapEl.contains(e.target as Node)) return;
      const target = targetAt(e.clientX, e.clientY, e.target as Element, countRef.current);
      if (!target) return;
      const p = { target, x: e.clientX, y: e.clientY, timer: 0 };
      p.timer = window.setTimeout(() => {
        press = null;
        setPicking({ ...target, x: p.x, y: p.y });
        navigator.vibrate?.(10);
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 600);
      }, PRESS.longMs);
      press = p;
    };
    const move = (e: PointerEvent) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS.slopPx) cancel();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', cancel, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
  }, [mapEl]);

  // A touch anywhere but the picker closes it.
  useEffect(() => {
    if (!picking) return;
    const away = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.route-style-picker')) return;
      setPicking(null);
    };
    // Next tick: the long press's own pointer is still down.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', away, true));
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [picking]);

  if (!picking) return null;
  const style = { '--x': `${picking.x}px`, '--y': `${picking.y}px` } as CSSProperties;
  return (
    <div className="ping-picker route-style-picker" role="dialog" aria-label={picking.kind === 'stop' ? `${picking.index + 1}번 장소 모양` : '선 스타일'} style={style}>
      <button
        className={`ping-picker__opt ${(picking.kind === 'stop' ? stopShapes?.[picking.index] : edgeStyles?.[picking.index]) === 'transparent' ? 'is-on' : ''}`}
        aria-label={picking.kind === 'stop' ? '투명 · 개별 핀 아이콘' : '투명 선'}
        aria-pressed={(picking.kind === 'stop' ? stopShapes?.[picking.index] : edgeStyles?.[picking.index]) === 'transparent'}
        onClick={() => {
          if (picking.kind === 'stop') onStopShape(picking.index, 'transparent');
          else onEdgeStyle(picking.index, 'transparent');
          setPicking(null);
        }}
      />
      {picking.kind === 'stop' ? (
        <>
          <button
            className={`ping-picker__opt route-style-picker__num ${!stopShapes?.[picking.index] ? 'is-on' : ''}`}
            aria-label="번호"
            aria-pressed={!stopShapes?.[picking.index]}
            onClick={() => {
              onStopShape(picking.index, null);
              setPicking(null);
            }}
          >
            {picking.index + 1}
          </button>
          {PING_SHAPES.map(({ shape, label }) => {
            const on = stopShapes?.[picking.index] === shape;
            return (
              <button
                key={shape}
                className={`ping-picker__opt ${on ? 'is-on' : ''}`}
                aria-label={label}
                aria-pressed={on}
                onClick={() => {
                  onStopShape(picking.index, shape);
                  setPicking(null);
                }}
              >
                <PingIcon shape={shape} />
              </button>
            );
          })}
        </>
      ) : (
        EDGE_STYLES.map(({ style: s, label }) => {
          const on = (edgeStyles?.[picking.index] ?? 'solid') === s;
          return (
            <button
              key={s}
              className={`ping-picker__opt ${on ? 'is-on' : ''}`}
              aria-label={label}
              aria-pressed={on}
              onClick={() => {
                onEdgeStyle(picking.index, s === 'solid' ? null : s);
                setPicking(null);
              }}
            >
              <EdgeSample style={s} />
            </button>
          );
        })
      )}
    </div>
  );
}

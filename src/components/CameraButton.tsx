import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { PRESS } from '../domain/dayPings';

/** A short hold, quicker than the long press elsewhere: the camera should feel at hand. */
const HOLD_MS = 280;

/**
 * The camera at the bottom-right of the map and We Now (and a group's map).
 * A short hold will switch to the camera — shoot a photo, decorate it, send
 * it to a group with a ping of where you are. Only the button for now:
 * `onHold` is left unset until camera mode exists.
 */
export default function CameraButton({ className = '', onHold }: { className?: string; onHold?: () => void }) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return (
    <button
      type="button"
      className={`camera-btn ${className}`}
      aria-label="카메라"
      onPointerDown={(e) => {
        if (!e.isPrimary) return;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => {
          timer.current = null;
          onHold?.();
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > PRESS.slopPx) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Camera size={24} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

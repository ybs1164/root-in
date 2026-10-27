import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { PRESS } from '../domain/dayPings';

/** A short hold, quicker than the long press elsewhere: the camera should feel at hand. */
const HOLD_MS = 280;

/**
 * The camera at the bottom-right of the map and We Now (and a group's map).
 * A tap opens the camera screen; so does a short hold, which fires before the
 * finger lifts (the click after it is swallowed so it doesn't open twice).
 */
export default function CameraButton({ className = '', onOpen }: { className?: string; onOpen?: () => void }) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
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
        held.current = false;
        timer.current = window.setTimeout(() => {
          timer.current = null;
          held.current = true;
          onOpen?.();
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > PRESS.slopPx) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onClick={() => {
        if (held.current) held.current = false;
        else onOpen?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Camera size={24} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

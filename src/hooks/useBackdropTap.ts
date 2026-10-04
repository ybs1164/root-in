import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';

/**
 * A modal <dialog> that closes on a tap outside it: the click lands on the
 * dialog element itself (its backdrop). But a press that started inside
 * (a button held, a row dragged) and was let go out there also clicks the
 * dialog — the common ancestor — and would close it. So it only counts when
 * the press both began and ended on the backdrop; anything else does nothing.
 */
export function useBackdropTap(dialogRef: RefObject<HTMLDialogElement | null>) {
  const down = useRef<EventTarget | null>(null);
  const up = useRef<EventTarget | null>(null);

  const onPointerDown = useCallback((event: PointerEvent) => {
    down.current = event.target;
    up.current = null;
  }, []);

  const onPointerUp = useCallback((event: PointerEvent) => {
    up.current = event.target;
  }, []);

  const isBackdropTap = useCallback(
    (target: EventTarget) => {
      const dialog = dialogRef.current;
      return !!dialog && target === dialog && down.current === dialog && up.current === dialog;
    },
    [dialogRef],
  );

  return { onPointerDown, onPointerUp, isBackdropTap };
}

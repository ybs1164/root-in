import { useEffect, useRef } from 'react';

/**
 * The black 'copied' pill route-making uses, in the middle of the screen for
 * a moment. A popover, so it sits in the top layer over any modal dialog
 * (the group settings popup, the 대화 screen). Shown while `notice` is set;
 * `onDone` clears it.
 */
export default function CopiedPill({ notice, onDone }: { notice: string | null; onDone(): void }) {
  const pill = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = pill.current;
    if (!notice || !el) return;
    try {
      el.showPopover?.();
    } catch {
      // Already showing: it just stays up.
    }
    const t = window.setTimeout(() => {
      try {
        el.hidePopover?.();
      } catch {
        // Gone with its dialog.
      }
      onDone();
    }, 1600);
    return () => window.clearTimeout(t);
  }, [notice, onDone]);

  return (
    <div ref={pill} popover="manual" className="copied-pill" role="status" aria-live="polite">
      {notice}
    </div>
  );
}

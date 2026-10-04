import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';

interface ConfirmDialogProps {
  /** Read out for the dialog (it shows no title). */
  label: string;
  message: string;
  /** A second, quieter line under the message. */
  detail?: string;
  onConfirm: () => void;
  /** Closed either way: after 확인, 취소, Esc or a tap outside. */
  onClose: () => void;
}

type Side = 'cancel' | 'confirm';

/** How long the torn-off half takes to fall away (`ticket-tear` in styles.css). */
const TEAR_MS = 460;

/**
 * A destructive confirm as a boarding pass (`ticket-dialog`): the message,
 * then the stub torn in two like the tab bar — 취소 | 확인, the confirm half
 * in red. A native modal <dialog>, so it sits in the top layer above any
 * sheet (and its slide-in transform), with Esc and focus handling built in.
 * Mount it to ask; it opens itself. 취소 or 확인 tears its half of the
 * stub off along the perforation, and the dialog closes once it has fallen.
 */
export default function ConfirmDialog({ label, message, detail, onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // The half being torn off, where it sat in the dialog.
  const [torn, setTorn] = useState<{ side: Side; box: CSSProperties } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const finish = (side: Side) => {
    if (side === 'confirm') onConfirm();
    dialogRef.current?.close();
  };

  const tear = (event: MouseEvent<HTMLButtonElement>, side: Side) => {
    if (torn) return;
    const dialog = dialogRef.current;
    if (!dialog || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish(side);
    const half = event.currentTarget.getBoundingClientRect();
    const whole = dialog.getBoundingClientRect();
    setTorn({
      side,
      box: { left: half.left - whole.left, top: half.top - whole.top, width: half.width, height: half.height },
    });
    timer.current = window.setTimeout(() => finish(side), TEAR_MS);
  };
  // No close() in cleanup: it would fire onClose during StrictMode's
  // mount→unmount→mount check; unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`confirm-dialog ticket-dialog ${torn ? 'is-tearing' : ''}`}
      aria-label={label}
      // React passes a dialog's close / cancel up through its component
      // tree: stop them here, or closing this would close a dialog it sits in
      // (the category sheet).
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <p className="ticket-dialog__main">
        {message}
        {detail && (
          <>
            <br />
            <span>{detail}</span>
          </>
        )}
      </p>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button className={torn?.side === 'cancel' ? 'is-gone' : ''} disabled={!!torn} onClick={(e) => tear(e, 'cancel')}>
          취소
        </button>
        <button
          className={`is-danger ${torn?.side === 'confirm' ? 'is-gone' : ''}`}
          disabled={!!torn}
          onClick={(e) => tear(e, 'confirm')}
        >
          확인
        </button>
      </div>
      {/* The torn-off half: drawn over the dialog (the stub's mask would clip it as it falls). */}
      {torn && (
        <div className={`confirm-dialog__torn is-${torn.side}`} style={torn.box} aria-hidden>
          {torn.side === 'confirm' ? '확인' : '취소'}
        </div>
      )}
    </dialog>
  );
}

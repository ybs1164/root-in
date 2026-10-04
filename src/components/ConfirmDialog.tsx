import { useEffect, useRef, type ReactNode } from 'react';
import { useBackdropTap } from '../hooks/useBackdropTap';

interface ConfirmDialogProps {
  /** Read out for the dialog (it shows no title). */
  label: string;
  message: string;
  /** Quieter lines under the message (a string's line breaks are kept; markup can pick words out). */
  detail?: ReactNode;
  /** The confirm half's word (확인 unless given)… */
  confirmLabel?: string;
  /** …and whether it's red (deleting, the default) or the accent (going somewhere). */
  tone?: 'danger' | 'action';
  onConfirm: () => void;
  /** Closed either way: after 확인, 취소, Esc or a tap outside. */
  onClose: () => void;
}

/**
 * A destructive confirm as a boarding pass (`ticket-dialog`): the message,
 * then the stub torn in two like the tab bar — 취소 | 확인, the confirm half
 * in red. A native modal <dialog>, so it sits in the top layer above any
 * sheet (and its slide-in transform), with Esc and focus handling built in.
 * Mount it to ask; it opens itself.
 */
export default function ConfirmDialog({ label, message, detail, confirmLabel = '확인', tone = 'danger', onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  // No close() in cleanup: it would fire onClose during StrictMode's
  // mount→unmount→mount check; unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog ticket-dialog"
      aria-label={label}
      // React passes a dialog's close / cancel up through its component
      // tree: stop them here, or closing this would close a dialog it sits in
      // (the category sheet).
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
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
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button
          className={tone === 'danger' ? 'is-danger' : 'is-action'}
          onClick={() => {
            onConfirm();
            dialogRef.current?.close();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
